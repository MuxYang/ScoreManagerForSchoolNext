import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();

// 获取所有教师（按科目分组，包含积分统计）
router.get('/', authenticateToken, (_req: Request, res: Response) => {
  try {
    // 获取所有教师及其积分总和
    const teachers = db.prepare(`
      SELECT 
        t.*,
        COALESCE(SUM(s.points), 0) as total_points
      FROM teachers t
      LEFT JOIN scores s ON t.name = s.teacher_name
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
    logger.error('获取教师信息失败', { error: error.message });
    res.status(500).json({ error: '获取教师信息失败' });
  }
});

// 创建教师
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { name, subject, phone, email } = req.body;
    
    if (!name || !subject) {
      return res.status(400).json({ error: '姓名和科目为必填项' });
    }
    
    const result = db.prepare(
      'INSERT INTO teachers (name, subject, phone, email) VALUES (?, ?, ?, ?)'
    ).run(name, subject, phone || null, email || null);
    
    const authReq = req as AuthRequest;
    logger.info('教师创建成功', { 
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
    logger.error('创建教师失败', { error: error.message });
    res.status(500).json({ error: '创建教师失败' });
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
    logger.info('教师信息更新成功', { 
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
    logger.error('更新教师信息失败', { error: error.message });
    res.status(500).json({ error: '更新教师信息失败' });
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
    logger.info('教师删除成功', { 
      teacherId: req.params.id,
      userId: authReq.userId 
    });
    
    res.json({ message: '教师删除成功' });
  } catch (error: any) {
    logger.error('删除教师失败', { error: error.message });
    res.status(500).json({ error: '删除教师失败' });
  }
});

export default router;
