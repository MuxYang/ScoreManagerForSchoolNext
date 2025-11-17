import express, { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import db from '../models/database';
import logger from '../utils/logger';
import { 
  normalizeClassName, 
  normalizeTeachingClasses,
  matchStudentInfo,
  matchTeacherAndSubject
} from '../utils/pinyinMatcher';

const router = express.Router();

// 配置 multer 用于文件上传（内存存储）
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 限制
});

// 导出学生数据为 Excel
router.get('/students/excel', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const students = db.prepare('SELECT * FROM students ORDER BY class, name').all();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('学生名单');

    // 设置列头
    if (students.length > 0) {
      const columns = Object.keys(students[0] as object).map(key => ({
        header: key,
        key: key,
        width: 15
      }));
      worksheet.columns = columns;
      worksheet.addRows(students);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    res.send(buffer);

    logger.info('Student data exported successfully');
  } catch (error) {
    logger.error('Failed to export student data:', error);
    res.status(500).json({ error: '导出学生数据失败' });
  }
});

// 导出积分数据为 Excel（支持日期范围过滤，排除占位记录）
router.get('/scores/excel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 构建查询条件
    let query = `
      SELECT 
        s.id,
        s.date as '日期',
        st.student_id as '学号',
        st.name as '姓名',
        st.class as '班级',
        s.points as '分数',
        s.reason as '原因',
        s.teacher_name as '记录教师',
        s.created_at as '创建时间'
      FROM scores s
      JOIN students st ON s.student_id = st.id
      WHERE s.date != '1970-01-01'
    `;
    const params: any[] = [];

    // 添加日期范围过滤
    if (startDate) {
      query += ' AND s.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND s.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY s.date DESC, s.created_at DESC';

    const scores = db.prepare(query).all(...params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('学生量化记录');

    // 设置列定义（使用中文列头）
    worksheet.columns = [
      { header: '日期', key: '日期', width: 12 },
      { header: '学号', key: '学号', width: 15 },
      { header: '姓名', key: '姓名', width: 10 },
      { header: '班级', key: '班级', width: 12 },
      { header: '分数', key: '分数', width: 8 },
      { header: '原因', key: '原因', width: 30 },
      { header: '记录教师', key: '记录教师', width: 10 },
    ];

    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // 添加数据行（不包含具体时间）
    scores.forEach((score: any) => {
      worksheet.addRow({
        '日期': score['日期'],
        '学号': score['学号'],
        '姓名': score['姓名'],
        '班级': score['班级'],
        '分数': score['分数'],
        '原因': score['原因'],
        '记录教师': score['记录教师']
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // 生成文件名
    let filename = '学生量化记录';
    if (startDate && endDate) {
      filename += `_${startDate}_至_${endDate}`;
    } else if (startDate) {
      filename += `_${startDate}_之后`;
    } else if (endDate) {
      filename += `_${endDate}_之前`;
    } else {
      filename += `_全部`;
    }
    filename += '.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.send(buffer);

    logger.info('Score data exported successfully', { 
      count: scores.length, 
      startDate, 
      endDate 
    });
  } catch (error) {
    logger.error('Failed to export score data:', error);
    res.status(500).json({ error: '导出积分数据失败' });
  }
});

// 解析 Excel/CSV 文件并返回预览
router.post('/parse', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未提供文件' });
    }

    const buffer = req.file.buffer;
    const filename = req.file.originalname.toLowerCase();

    const workbook = new ExcelJS.Workbook();
    
    // 根据文件类型读取
    if (filename.endsWith('.csv')) {
      const Readable = require('stream').Readable;
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      await workbook.xlsx.load(buffer as any);
    } else {
      return res.status(400).json({ error: '不支持的文件格式，请使用 CSV、XLS 或 XLSX 格式' });
    }

    const worksheet = workbook.worksheets[0];
    
    if (!worksheet || worksheet.rowCount === 0) {
      return res.status(400).json({ error: '文件为空' });
    }

    // 获取表头（第一行）
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers.push(cell.value?.toString() || `列${colNumber}`);
    });

    // 读取所有数据行
    const data: any[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        rowData[header] = cell.value?.toString() || '';
      });
      data.push(rowData);
    }

    res.json({ 
      headers: headers,
      preview: data.slice(0, 50), // 返回前50行预览
      totalRows: data.length,
      allData: data // 返回所有数据供前端使用
    });

    logger.info('File parsed successfully', { filename, rows: data.length });
  } catch (error: any) {
    logger.error('Failed to parse file:', error);
    res.status(500).json({ error: 'Failed to parse file: ' + error.message });
  }
});

// AI 文本解析（stub - 将来可集成真实 AI）
router.post('/parse-text', authenticateToken, (req: Request, res: Response) => {
  try {
    const { text, dataType } = req.body;

    if (!text) {
      return res.status(400).json({ error: '未提供文本数据' });
    }

    // 简单的文本解析逻辑（stub）
    const lines = text.trim().split('\n');
    const data: any[] = [];

    for (const line of lines) {
      const parts = line.split(/[\t,]/); // 支持 tab 和逗号分隔

      if (dataType === 'students' && parts.length >= 3) {
        data.push({
          studentId: parts[0].trim(),
          name: parts[1].trim(),
          class: parts[2].trim()
        });
      } else if (dataType === 'scores' && parts.length >= 3) {
        data.push({
          studentId: parts[0].trim(),
          points: parseFloat(parts[1].trim()),
          reason: parts[2]?.trim() || '',
          teacherName: parts[3]?.trim() || '',
          date: parts[4]?.trim() || new Date().toISOString().split('T')[0]
        });
      }
    }

    res.json({ 
      preview: data.slice(0, 10),
      totalRows: data.length,
      message: '文本解析完成（使用简单解析逻辑）'
    });

    logger.info('Text parsed successfully', { rows: data.length, dataType });
  } catch (error) {
    logger.error('Failed to parse text:', error);
    res.status(500).json({ error: '解析文本失败' });
  }
});

// 批量导入学生
router.post('/students/import', authenticateToken, (req: Request, res: Response) => {
  try {
    const { data, mapping } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '未提供导入数据' });
    }

    if (!mapping || !mapping.name || !mapping.studentId || !mapping.class) {
      return res.status(400).json({ error: '字段映射不完整，需要：姓名、学号、班级' });
    }

    const authReq = req as AuthRequest;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // 使用事务处理批量插入
    // 注意：学生数据导入时，遇到重名不做特殊处理，按学号唯一性导入
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO students (student_id, name, class)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction((students: any[]) => {
      for (const row of students) {
        try {
          const studentId = row[mapping.studentId]?.toString().trim();
          const name = row[mapping.name]?.toString().trim();
          const studentClass = normalizeClassName(row[mapping.class]?.toString().trim() || '');

          // 基本验证
          if (!studentId || !name || !studentClass) {
            failCount++;
            errors.push(`跳过空数据行（缺少学号、姓名或班级）：${JSON.stringify(row)}`);
            continue;
          }

          const result = insertStmt.run(studentId, name, studentClass);
          if (result.changes > 0) {
            successCount++;
          } else {
            failCount++;
            errors.push(`学号已存在：${studentId} (${name})`);
          }
        } catch (error: any) {
          failCount++;
          errors.push(`导入失败：${error.message}`);
        }
      }
    });

    transaction(data);

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'BATCH_IMPORT_STUDENTS', JSON.stringify({ 
        successCount, 
        failCount,
        total: data.length 
      }));

    logger.info('Batch import students completed', { successCount, failCount, total: data.length });

    res.json({ 
      success: true,
      successCount,
      failCount,
      errors: errors.slice(0, 10), // 只返回前10个错误
      message: `成功导入 ${successCount} 条，失败 ${failCount} 条`
    });

  } catch (error: any) {
    logger.error('Failed to batch import students:', error);
    res.status(500).json({ error: 'Failed to batch import students: ' + error.message });
  }
});

// 批量导入教师
router.post('/teachers/import', authenticateToken, (req: Request, res: Response) => {
  try {
    const { data, mapping } = req.body;
    
    // 记录接收到的原始数据（用于调试）
    logger.info('Received teacher import request', { 
      dataCount: data?.length || 0,
      mapping,
      firstRow: data?.[0] || null
    });
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '未提供导入数据' });
    }

    if (!mapping || !mapping.name || !mapping.subject || !mapping.teachingClasses) {
      return res.status(400).json({ error: '字段映射不完整，需要：姓名、科目、任教班级' });
    }

    const authReq = req as AuthRequest;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // 使用事务处理批量插入
    const insertStmt = db.prepare(`
      INSERT INTO teachers (name, subject, teaching_classes)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction((teachers: any[]) => {
      for (const row of teachers) {
        try {
          const name = row[mapping.name]?.toString().trim();
          const subject = row[mapping.subject]?.toString().trim();
          
          // 处理任教班级，支持多种分隔符并标准化
          let teachingClasses = '';
          const rawTeachingClasses = row[mapping.teachingClasses];
          if (mapping.teachingClasses && rawTeachingClasses) {
            teachingClasses = normalizeTeachingClasses(rawTeachingClasses.toString());
          }

          // 验证必填字段：姓名和科目必须有值，任教班级允许为空
          if (!name || !subject) {
            failCount++;
            const errorMsg = `跳过数据行 - 姓名:${name || '空'}, 科目:${subject || '空'}`;
            errors.push(errorMsg);
            logger.warn('Teacher import validation failed: Missing required fields', { 
              name, 
              subject, 
              rawTeachingClasses,
              row 
            });
            continue;
          }

          logger.debug('尝试插入教师', { name, subject, teachingClasses: teachingClasses || '(无固定班级)' });
          const result = insertStmt.run(name, subject, teachingClasses || '');
          if (result.changes > 0) {
            successCount++;
          } else {
            failCount++;
            errors.push(`插入失败但无异常：${name}`);
          }
        } catch (error: any) {
          failCount++;
          const errorMsg = `导入 ${row[mapping.name] || '未知'} 失败：${error.message}`;
          errors.push(errorMsg);
          logger.error('Teacher import exception', { error: error.message, row, mapping });
        }
      }
    });

    transaction(data);

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'BATCH_IMPORT_TEACHERS', JSON.stringify({ 
        successCount, 
        failCount,
        total: data.length 
      }));

    logger.info('Batch import teachers completed', { successCount, failCount, total: data.length });

    res.json({ 
      success: true,
      successCount,
      failCount,
      errors: errors.slice(0, 20), // 返回前20个错误
      allErrors: errors.length > 20 ? `共 ${errors.length} 个错误` : undefined,
      message: `成功导入 ${successCount} 条，失败 ${failCount} 条`
    });

  } catch (error: any) {
    logger.error('Failed to batch import teachers:', error);
    res.status(500).json({ error: 'Failed to batch import teachers: ' + error.message });
  }
});

export default router;
