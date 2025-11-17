import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { validateInput } from '../utils/inputValidation';
import ExcelJS from 'exceljs';

const router = express.Router();

// 获取所有教师（按科目分组，包含积分统计）
router.get('/', authenticateToken, (_req: Request, res: Response) => {
  try {
    // 获取所有教师及其量化记录数量（由积分加和改为计数，排除占位记录）
    const teachers = db.prepare(`
      SELECT 
        t.*,
        COALESCE(COUNT(s.id), 0) as total_points
      FROM teachers t
      LEFT JOIN scores s ON t.name = s.teacher_name AND s.date != '1970-01-01'
      GROUP BY t.id
      ORDER BY t.subject, t.name
    `).all();

    // 按科目分组
    const groupedBySubject: Record<string, any> = {};
    teachers.forEach((teacher: any) => {
      const subject = teacher.subject || '未分类';
      if (!groupedBySubject[subject]) {
        groupedBySubject[subject] = {
          subject: subject,
          teachers: [],
          total_points: 0
        };
      }
      groupedBySubject[subject].teachers.push(teacher);
      groupedBySubject[subject].total_points += teacher.total_points;
    });

    // 转换为数组格式
    const result = Object.values(groupedBySubject);
    
    return res.json({
      teachers: teachers,  // 原始教师列表
      grouped: result      // 按科目分组的数据
    });
  } catch (error: any) {
    logger.error('Failed to get teacher list', { error: error.message });
    return res.status(500).json({ error: 'Failed to get teacher list' });
  }
});

// 获取单个教师
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(req.params.id);
    
    if (!teacher) {
      return res.status(404).json({ error: '教师不存在' });
    }
    
    res.json(teacher);
  } catch (error: any) {
    logger.error('Failed to get teacher info', { error: error.message });
    res.status(500).json({ error: 'Failed to get teacher info' });
  }
});

// 创建教师
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { name, subject, phone, email } = req.body;
    
    if (!name || !subject) {
      return res.status(400).json({ error: '姓名和科目为必填项' });
    }
    
    // 安全检查
    const nameValidation = validateInput(name, { maxLength: 50 });
    if (!nameValidation.valid) {
      logger.warn('Add teacher blocked: Name contains illegal characters', { name });
      return res.status(400).json({ error: '姓名包含非法字符' });
    }

    const subjectValidation = validateInput(subject, { maxLength: 50 });
    if (!subjectValidation.valid) {
      logger.warn('Add teacher blocked: Subject contains illegal characters', { subject });
      return res.status(400).json({ error: '科目包含非法字符' });
    }

    if (phone) {
      const phoneValidation = validateInput(phone, { maxLength: 20 });
      if (!phoneValidation.valid) {
        logger.warn('Add teacher blocked: Phone contains illegal characters', { phone });
        return res.status(400).json({ error: '电话包含非法字符' });
      }
    }

    if (email) {
      const emailValidation = validateInput(email, { maxLength: 100 });
      if (!emailValidation.valid) {
        logger.warn('Add teacher blocked: Email contains illegal characters', { email });
        return res.status(400).json({ error: '邮箱包含非法字符' });
      }
    }
    
    const result = db.prepare(
      'INSERT INTO teachers (name, subject, phone, email) VALUES (?, ?, ?, ?)'
    ).run(name, subject, phone || null, email || null);
    
    const authReq = req as AuthRequest;
    logger.info('Teacher created successfully', { 
      teacherId: result.lastInsertRowid, 
      name,
      userId: authReq.userId 
    });
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      name,
      subject,
      phone,
      email
    });
  } catch (error: any) {
    logger.error('Failed to create teacher', { error: error.message });
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// 更新教师
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { name, subject, phone, email } = req.body;
    
    if (!name || !subject) {
      return res.status(400).json({ error: '姓名和科目为必填项' });
    }
    
    const result = db.prepare(
      'UPDATE teachers SET name = ?, subject = ?, phone = ?, email = ? WHERE id = ?'
    ).run(name, subject, phone || null, email || null, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '教师不存在' });
    }
    
    const authReq = req as AuthRequest;
    logger.info('Teacher info updated successfully', { 
      teacherId: req.params.id,
      userId: authReq.userId 
    });
    
    res.json({ 
      id: req.params.id,
      name,
      subject,
      phone,
      email
    });
  } catch (error: any) {
    logger.error('Failed to update teacher info', { error: error.message });
    res.status(500).json({ error: 'Failed to update teacher info' });
  }
});

// 删除教师
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM teachers WHERE id = ?').run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '教师不存在' });
    }
    
    const authReq = req as AuthRequest;
    logger.info('Teacher deleted successfully', { 
      teacherId: req.params.id,
      userId: authReq.userId 
    });
    
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error: any) {
    logger.error('Failed to delete teacher', { error: error.message });
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// Export teacher quantification records
router.post('/export-records', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供开始日期和结束日期' });
    }

    logger.info('Export teacher quantification records', { startDate, endDate });

    // 获取所有教师及其科目
    const teachers = db.prepare(`
      SELECT id, name, subject
      FROM teachers
      ORDER BY subject, name
    `).all() as { id: number; name: string; subject: string }[];

    // 获取指定时间范围内的量化记录（排除占位记录）
    const records = db.prepare(`
      SELECT 
        s.teacher_name,
        s.points,
        s.reason,
        s.date,
        st.name as student_name
      FROM scores s
      LEFT JOIN students st ON s.student_id = st.id
      WHERE s.date BETWEEN ? AND ? AND s.date != '1970-01-01'
      ORDER BY s.teacher_name, s.date
    `).all(startDate, endDate) as any[];

    // 按科目和教师分组数据
    const dataBySubject: Record<string, {
      subjectTotal: number;
      teachers: Record<string, {
        name: string;
        total: number;
        records: any[];
      }>;
    }> = {};

    teachers.forEach(teacher => {
      const subject = teacher.subject || '未分类';
      if (!dataBySubject[subject]) {
        dataBySubject[subject] = {
          subjectTotal: 0,
          teachers: {}
        };
      }
      dataBySubject[subject].teachers[teacher.name] = {
        name: teacher.name,
        total: 0,
        records: []
      };
    });

    // 填充量化记录
    records.forEach(record => {
      const teacherName = record.teacher_name;
      if (!teacherName) return;

      // 找到教师所属科目
      const teacher = teachers.find(t => t.name === teacherName);
      if (!teacher) return;

      const subject = teacher.subject || '未分类';
      if (dataBySubject[subject] && dataBySubject[subject].teachers[teacherName]) {
        dataBySubject[subject].teachers[teacherName].records.push(record);
        dataBySubject[subject].teachers[teacherName].total += record.points;
        dataBySubject[subject].subjectTotal += record.points;
      }
    });

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('教师量化记录');

    // 设置列宽
    worksheet.columns = [
      { width: 15 }, // 科目组
      { width: 12 }, // 科目组累计分数
      { width: 12 }, // 教师
      { width: 12 }, // 教师分数
    ];

    // 添加表头
    const headerRow = worksheet.addRow(['科目组', '科目组累计分数', '教师', '教师分数']);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // 填充数据
    Object.keys(dataBySubject).sort().forEach(subject => {
      const subjectData = dataBySubject[subject];
      const teacherNames = Object.keys(subjectData.teachers).sort();

      teacherNames.forEach((teacherName, index) => {
        const teacherData = subjectData.teachers[teacherName];
        const row: any[] = [
          index === 0 ? subject : '', // 科目组（只在第一行显示）
          index === 0 ? subjectData.subjectTotal : '', // 科目组累计分数
          teacherName, // 教师
          teacherData.total // 教师分数
        ];

        // 添加量化记录（格式：日期学生姓名原因分数）
        teacherData.records.forEach(record => {
          const dateStr = record.date.replace(/-/g, ''); // 20251023
          const studentName = record.student_name || '未知';
          const reason = record.reason || '无';
          const points = record.points;
          row.push(`${dateStr}${studentName}${reason}${points}分`);
        });

        worksheet.addRow(row);
      });
    });

    // 设置响应头
    const fileName = `教师量化记录-${startDate}-${endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    // 生成Excel并发送
    await workbook.xlsx.write(res);
    res.end();

    logger.info('Teacher quantification records exported successfully', { startDate, endDate });
  } catch (error: any) {
    logger.error('Export teacher quantification records失败', { error: error.message });
    res.status(500).json({ error: '导出失败: ' + error.message });
  }
});

export default router;
