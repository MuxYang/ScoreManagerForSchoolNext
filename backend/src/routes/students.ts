import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { validateInput, sanitizeForLogging } from '../utils/inputValidation';
import ExcelJS from 'exceljs';

const router = express.Router();

// 获取所有学生（包含积分总和）
router.get('/', authenticateToken, (_req: Request, res: Response) => {
  try {
    const students = db.prepare(`
      SELECT 
        s.*,
        COALESCE(SUM(sc.points), 0) as total_points
      FROM students s
      LEFT JOIN scores sc ON s.id = sc.student_id
      GROUP BY s.id
      ORDER BY s.class, s.name
    `).all();
    return res.json(students);
  } catch (error) {
    logger.error('Failed to get student list:', error);
    return res.status(500).json({ error: 'Failed to get student list' });
  }
});

// 获取单个学生
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }
    res.json(student);
  } catch (error) {
    logger.error('Failed to get student info:', error);
    res.status(500).json({ error: '获取学生信息失败' });
  }
});

// 添加学生
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { studentId, name, studentClass } = req.body;

    if (!studentId || !name || !studentClass) {
      return res.status(400).json({ error: '学号、姓名和班级是必填的' });
    }

    // 安全检查：学号、姓名、班级
    const studentIdValidation = validateInput(studentId, { maxLength: 50 });
    if (!studentIdValidation.valid) {
      logger.warn('Add student blocked: Student ID contains illegal characters', { 
        studentIdHash: sanitizeForLogging(studentId, { type: 'hash' }),
        ip: (req as any).ip
      });
      return res.status(400).json({ error: '学号包含非法字符' });
    }

    const nameValidation = validateInput(name, { maxLength: 50 });
    if (!nameValidation.valid) {
      logger.warn('Add student blocked: Name contains illegal characters', { 
        nameHash: sanitizeForLogging(name, { type: 'hash' }),
        ip: (req as any).ip
      });
      return res.status(400).json({ error: '姓名包含非法字符' });
    }

    const classValidation = validateInput(studentClass, { maxLength: 50 });
    if (!classValidation.valid) {
      logger.warn('Add student blocked: Class contains illegal characters', { 
        classHash: sanitizeForLogging(studentClass, { type: 'hash' }),
        ip: (req as any).ip
      });
      return res.status(400).json({ error: '班级包含非法字符' });
    }

    const result = db.prepare(`
      INSERT INTO students (student_id, name, class)
      VALUES (?, ?, ?)
    `).run(studentId, name, studentClass);

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'ADD_STUDENT', JSON.stringify({ studentId, name, studentClass }));

    logger.info('Student added successfully', { studentId, name });

    res.status(201).json({ 
      id: result.lastInsertRowid,
      message: '学生添加成功' 
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: '学号已存在' });
    }
    logger.error('Failed to add student:', error);
    res.status(500).json({ error: '添加学生失败' });
  }
});

// 更新学生
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { studentId, name, studentClass } = req.body;

    const result = db.prepare(`
      UPDATE students 
      SET student_id = ?, name = ?, class = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(studentId, name, studentClass, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '学生不存在' });
    }

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'UPDATE_STUDENT', JSON.stringify({ id: req.params.id, studentId, name, studentClass }));

    logger.info('Student updated successfully', { id: req.params.id });

    res.json({ message: '学生信息更新成功' });
  } catch (error) {
    logger.error('Failed to update student:', error);
    res.status(500).json({ error: '更新学生失败' });
  }
});

// 删除学生
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '学生不存在' });
    }

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'DELETE_STUDENT', JSON.stringify({ id: req.params.id }));

    logger.info('Student deleted successfully', { id: req.params.id });

    res.json({ message: '学生删除成功' });
  } catch (error) {
    logger.error('Failed to delete student:', error);
    res.status(500).json({ error: '删除学生失败' });
  }
});

// 批量导入学生
router.post('/batch', authenticateToken, (req: Request, res: Response) => {
  try {
    const students = req.body.students;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: '学生数据格式错误' });
    }

    const insert = db.prepare(`
      INSERT INTO students (student_id, name, class)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((students: any[]) => {
      for (const student of students) {
        insert.run(student.studentId, student.name, student.class);
      }
    });

    insertMany(students);

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'BATCH_IMPORT_STUDENTS', JSON.stringify({ count: students.length }));

    logger.info('Batch import students succeeded', { count: students.length });

    res.json({ message: `成功导入 ${students.length} 名学生` });
  } catch (error) {
    logger.error('Failed to batch import students:', error);
    res.status(500).json({ error: '批量导入学生失败' });
  }
});

// Export student quantification records
router.post('/export-records', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供开始日期和结束日期' });
    }

    logger.info('Export student quantification records', { startDate, endDate });

    // 获取指定时间范围内有量化记录的学生及其记录（排除占位记录）
    const records = db.prepare(`
      SELECT 
        st.class,
        st.name,
        st.student_id,
        s.points,
        s.reason,
        s.date,
        s.teacher_name
      FROM scores s
      INNER JOIN students st ON s.student_id = st.id
      WHERE s.date BETWEEN ? AND ? AND s.date != '1970-01-01'
      ORDER BY st.class, st.name, s.date
    `).all(startDate, endDate) as any[];

    if (records.length === 0) {
      return res.status(404).json({ error: '指定时间范围内没有量化记录' });
    }

    // 按学生分组数据
    const dataByStudent: Record<string, {
      class: string;
      name: string;
      studentId: string;
      records: any[];
    }> = {};

    records.forEach(record => {
      const key = `${record.class}-${record.name}-${record.student_id}`;
      if (!dataByStudent[key]) {
        dataByStudent[key] = {
          class: record.class,
          name: record.name,
          studentId: record.student_id,
          records: []
        };
      }
      dataByStudent[key].records.push(record);
    });

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('学生量化记录');

    // 设置列宽
    worksheet.columns = [
      { width: 12 }, // 班级
      { width: 12 }, // 学生姓名
      { width: 15 }, // 学号
    ];

    // 添加表头
    const headerRow = worksheet.addRow(['班级', '学生姓名', '学号']);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 按班级和姓名排序
    const sortedKeys = Object.keys(dataByStudent).sort((a, b) => {
      const [classA, nameA] = a.split('-');
      const [classB, nameB] = b.split('-');
      if (classA !== classB) return classA.localeCompare(classB, 'zh-CN');
      return nameA.localeCompare(nameB, 'zh-CN');
    });

    // 填充数据
    sortedKeys.forEach(key => {
      const studentData = dataByStudent[key];
      const row: any[] = [
        studentData.class,
        studentData.name,
        studentData.studentId
      ];

      // 添加量化记录（格式：日期学生姓名原因分数）
      studentData.records.forEach(record => {
        const dateStr = record.date.replace(/-/g, ''); // 20251023
        const teacherName = record.teacher_name || '未知';
        const reason = record.reason || '无';
        const points = record.points;
        row.push(`${dateStr}${teacherName}${reason}${points}分`);
      });

      worksheet.addRow(row);
    });

    // 设置响应头
    const fileName = `学生量化记录-${startDate}-${endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    // 生成Excel并发送
    await workbook.xlsx.write(res);
    res.end();

    logger.info('Student quantification records exported successfully', { startDate, endDate, studentCount: sortedKeys.length });
  } catch (error: any) {
    logger.error('Export student quantification records失败', { error: error.message });
    res.status(500).json({ error: '导出失败: ' + error.message });
  }
});

export default router;
