import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { validateInput } from '../utils/inputValidation';

const router = express.Router();

// 获取所有积分记录
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { studentId, startDate, endDate, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT s.*, st.student_id, st.name, st.class 
      FROM scores s
      JOIN students st ON s.student_id = st.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (studentId) {
      query += ' AND s.student_id = ?';
      params.push(studentId);
    }

    if (startDate) {
      query += ' AND s.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND s.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY s.date DESC, s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const scores = db.prepare(query).all(...params);
    res.json(scores);
  } catch (error) {
    logger.error('获取积分记录失败:', error);
    res.status(500).json({ error: '获取积分记录失败' });
  }
});

// 获取学生积分统计
router.get('/statistics/:studentId', authenticateToken, (req: Request, res: Response) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        SUM(points) as total_points,
        AVG(points) as average_points,
        MAX(points) as max_points,
        MIN(points) as min_points
      FROM scores
      WHERE student_id = ?
    `).get(req.params.studentId);

    res.json(stats);
  } catch (error) {
    logger.error('获取积分统计失败:', error);
    res.status(500).json({ error: '获取积分统计失败' });
  }
});

// 添加积分记录
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { studentId, points, reason, teacherName, date } = req.body;

    if (!studentId || points === undefined) {
      return res.status(400).json({ error: '学生ID和积分是必填的' });
    }

    // 安全检查
    if (reason) {
      const reasonValidation = validateInput(reason, { maxLength: 200 });
      if (!reasonValidation.valid) {
        logger.warn('添加积分被阻止：原因包含非法字符', { reason });
        return res.status(400).json({ error: '原因包含非法字符' });
      }
    }

    if (teacherName) {
      const teacherValidation = validateInput(teacherName, { maxLength: 50 });
      if (!teacherValidation.valid) {
        logger.warn('添加积分被阻止：教师姓名包含非法字符', { teacherName });
        return res.status(400).json({ error: '教师姓名包含非法字符' });
      }
    }

    const result = db.prepare(`
      INSERT INTO scores (student_id, points, reason, teacher_name, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, points, reason, teacherName, date || new Date().toISOString().split('T')[0]);

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'ADD_SCORE', JSON.stringify({ studentId, points, reason }));

    logger.info('添加积分记录成功', { studentId, points });

    res.status(201).json({ 
      id: result.lastInsertRowid,
      message: '积分记录添加成功' 
    });
  } catch (error) {
    logger.error('添加积分记录失败:', error);
    res.status(500).json({ error: '添加积分记录失败' });
  }
});

// 更新积分记录
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { points, reason, teacherName, date } = req.body;

    const result = db.prepare(`
      UPDATE scores 
      SET points = ?, reason = ?, teacher_name = ?, date = ?
      WHERE id = ?
    `).run(points, reason, teacherName, date, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '积分记录不存在' });
    }

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'UPDATE_SCORE', JSON.stringify({ id: req.params.id, points, reason }));

    logger.info('更新积分记录成功', { id: req.params.id });

    res.json({ message: '积分记录更新成功' });
  } catch (error) {
    logger.error('更新积分记录失败:', error);
    res.status(500).json({ error: '更新积分记录失败' });
  }
});

// 删除积分记录
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM scores WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '积分记录不存在' });
    }

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'DELETE_SCORE', JSON.stringify({ id: req.params.id }));

    logger.info('删除积分记录成功', { id: req.params.id });

    res.json({ message: '积分记录删除成功' });
  } catch (error) {
    logger.error('删除积分记录失败:', error);
    res.status(500).json({ error: '删除积分记录失败' });
  }
});

// 批量导入积分记录
router.post('/batch', authenticateToken, (req: Request, res: Response) => {
  try {
    const scores = req.body.scores;

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: '积分数据格式错误' });
    }

    const insert = db.prepare(`
      INSERT INTO scores (student_id, points, reason, teacher_name, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((scores: any[]) => {
      for (const score of scores) {
        insert.run(
          score.studentId, 
          score.points, 
          score.reason, 
          score.teacherName,
          score.date || new Date().toISOString().split('T')[0]
        );
      }
    });

    insertMany(scores);

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'BATCH_IMPORT_SCORES', JSON.stringify({ count: scores.length }));

    logger.info('批量导入积分记录成功', { count: scores.length });

    res.json({ message: `成功导入 ${scores.length} 条积分记录` });
  } catch (error) {
    logger.error('批量导入积分记录失败:', error);
    res.status(500).json({ error: '批量导入积分记录失败' });
  }
});

// 获取首页统计数据
router.get('/dashboard-stats', authenticateToken, (req: Request, res: Response) => {
  try {
    // 学生总数
    const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number };
    
    // 教师总数
    const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
    
    // 积分记录总数
    const scoreCount = db.prepare('SELECT COUNT(*) as count FROM scores').get() as { count: number };
    
    // 达标人数（总积分 >= 6）
    const qualifiedStudents = db.prepare(`
      SELECT 
        st.id,
        st.name,
        st.student_id,
        st.class,
        SUM(s.points) as total_points
      FROM students st
      LEFT JOIN scores s ON st.id = s.student_id
      GROUP BY st.id
      HAVING total_points >= 6
      ORDER BY total_points DESC
    `).all() as any[];
    
    // 积分排名（前10）
    const topRankings = db.prepare(`
      SELECT 
        st.id,
        st.name,
        st.student_id,
        st.class,
        COALESCE(SUM(s.points), 0) as total_points,
        COUNT(s.id) as record_count
      FROM students st
      LEFT JOIN scores s ON st.id = s.student_id
      GROUP BY st.id
      ORDER BY total_points DESC
      LIMIT 10
    `).all();
    
    // 最近积分记录（最近10条）
    const recentScores = db.prepare(`
      SELECT 
        s.*,
        st.name as student_name,
        st.student_id as student_number,
        st.class
      FROM scores s
      JOIN students st ON s.student_id = st.id
      ORDER BY s.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      studentCount: studentCount.count,
      teacherCount: teacherCount.count,
      scoreCount: scoreCount.count,
      qualifiedCount: qualifiedStudents.length,
      qualifiedStudents: qualifiedStudents,
      topRankings: topRankings,
      recentScores: recentScores
    });
  } catch (error) {
    logger.error('获取首页统计数据失败:', error);
    res.status(500).json({ error: '获取首页统计数据失败' });
  }
});

export default router;
