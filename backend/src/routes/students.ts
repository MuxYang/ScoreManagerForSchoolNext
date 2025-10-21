import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { validateInput, sanitizeForLogging } from '../utils/inputValidation';

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
    logger.error('获取学生信息失败:', error);
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
      logger.warn('添加学生被阻止：学号包含非法字符', { 
        studentIdHash: sanitizeForLogging(studentId, { type: 'hash' }),
        ip: (req as any).ip
      });
      return res.status(400).json({ error: '学号包含非法字符' });
    }

    const nameValidation = validateInput(name, { maxLength: 50 });
    if (!nameValidation.valid) {
      logger.warn('添加学生被阻止：姓名包含非法字符', { 
        nameHash: sanitizeForLogging(name, { type: 'hash' }),
        ip: (req as any).ip
      });
      return res.status(400).json({ error: '姓名包含非法字符' });
    }

    const classValidation = validateInput(studentClass, { maxLength: 50 });
    if (!classValidation.valid) {
      logger.warn('添加学生被阻止：班级包含非法字符', { 
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

    logger.info('添加学生成功', { studentId, name });

    res.status(201).json({ 
      id: result.lastInsertRowid,
      message: '学生添加成功' 
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: '学号已存在' });
    }
    logger.error('添加学生失败:', error);
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

    logger.info('更新学生成功', { id: req.params.id });

    res.json({ message: '学生信息更新成功' });
  } catch (error) {
    logger.error('更新学生失败:', error);
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

    logger.info('删除学生成功', { id: req.params.id });

    res.json({ message: '学生删除成功' });
  } catch (error) {
    logger.error('删除学生失败:', error);
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

    logger.info('批量导入学生成功', { count: students.length });

    res.json({ message: `成功导入 ${students.length} 名学生` });
  } catch (error) {
    logger.error('批量导入学生失败:', error);
    res.status(500).json({ error: '批量导入学生失败' });
  }
});

export default router;
