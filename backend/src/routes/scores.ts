import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { validateInput } from '../utils/inputValidation';
import { matchStudentForAIImport, normalizeClassName } from '../utils/pinyinMatcher';

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

// AI批量导入扣分记录（智能匹配，未匹配的进入待处理）
router.post('/ai-import', authenticateToken, (req: Request, res: Response) => {
  try {
    const { records } = req.body;
    const authReq = req as AuthRequest;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: '导入数据格式错误' });
    }

    let successCount = 0;
    let pendingCount = 0;
    const errors: string[] = [];
    const pendingRecords: any[] = [];

    const insertScore = db.prepare(`
      INSERT INTO scores (student_id, points, reason, teacher_name, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertPending = db.prepare(`
      INSERT INTO pending_scores (student_name, class_name, teacher_name, points, reason, date, raw_data, match_suggestions, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((records: any[]) => {
      for (const record of records) {
        try {
          const { name, className, teacherName, points, reason, date } = record;

          if (!name || points === undefined) {
            errors.push(`跳过无效记录：缺少姓名或扣分`);
            continue;
          }

          // 使用严格匹配模式（姓名拼音+班级）
          const matchResult = matchStudentForAIImport(
            db,
            name,
            className,
            teacherName
          );

          if (matchResult.matched && matchResult.student) {
            // 匹配成功，直接导入
            insertScore.run(
              matchResult.student.id,
              points,
              reason || '',
              teacherName || '',
              date || new Date().toISOString().split('T')[0]
            );
            successCount++;
          } else {
            // 匹配失败，移入待处理
            const normalizedClass = className ? normalizeClassName(className) : '';
            insertPending.run(
              name,
              normalizedClass,
              teacherName || '',
              points,
              reason || '',
              date || new Date().toISOString().split('T')[0],
              JSON.stringify(record),
              JSON.stringify(matchResult.suggestions || []),
              authReq.userId
            );
            pendingCount++;
            pendingRecords.push({
              name,
              className: normalizedClass,
              points,
              suggestions: matchResult.suggestions || []
            });
          }
        } catch (error: any) {
          errors.push(`导入失败：${error.message}`);
        }
      }
    });

    transaction(records);

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'AI_IMPORT_SCORES', JSON.stringify({
        total: records.length,
        successCount,
        pendingCount,
        errorCount: errors.length
      }));

    logger.info('AI批量导入扣分记录完成', {
      total: records.length,
      successCount,
      pendingCount,
      errorCount: errors.length
    });

    res.json({
      success: true,
      successCount,
      pendingCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
      pendingRecords: pendingRecords.slice(0, 10),
      message: `成功导入 ${successCount} 条，${pendingCount} 条待处理，${errors.length} 条失败`
    });

  } catch (error: any) {
    logger.error('AI批量导入扣分记录失败:', error);
    res.status(500).json({ error: 'AI批量导入失败: ' + error.message });
  }
});

// 获取待处理记录列表
router.get('/pending', authenticateToken, (req: Request, res: Response) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT * FROM pending_scores
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const records = db.prepare(query).all(status, Number(limit), Number(offset));
    
    // 解析 JSON 字段并转换字段名为前端期望的格式
    const parsedRecords = records.map((record: any) => ({
      id: record.id,
      studentName: record.student_name,
      class: record.class_name,
      teacherName: record.teacher_name,
      points: record.points,
      reason: record.reason,
      date: record.date,
      status: record.status,
      createdAt: record.created_at,
      rawData: record.raw_data ? JSON.parse(record.raw_data) : null,
      matchSuggestions: record.match_suggestions ? JSON.parse(record.match_suggestions) : []
    }));

    const totalCount = db.prepare('SELECT COUNT(*) as count FROM pending_scores WHERE status = ?')
      .get(status) as { count: number };

    res.json({
      records: parsedRecords,
      total: totalCount.count,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    logger.error('获取待处理记录失败:', error);
    res.status(500).json({ error: '获取待处理记录失败' });
  }
});

// 手动处理待处理记录（确认匹配）
router.post('/pending/:id/resolve', authenticateToken, (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    const pendingId = req.params.id;
    const authReq = req as AuthRequest;

    if (!studentId) {
      return res.status(400).json({ error: '必须提供学生ID' });
    }

    // 获取待处理记录
    const pending = db.prepare('SELECT * FROM pending_scores WHERE id = ?').get(pendingId) as any;

    if (!pending) {
      return res.status(404).json({ error: '待处理记录不存在' });
    }

    // 验证学生存在
    const student = db.prepare('SELECT id, student_id, name, class FROM students WHERE id = ?').get(studentId) as any;
    if (!student) {
      return res.status(400).json({ error: '学生不存在' });
    }

    // 创建扣分记录
    const scoreResult = db.prepare(`
      INSERT INTO scores (student_id, points, reason, teacher_name, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(student.id, pending.points, pending.reason, pending.teacher_name, pending.date);

    // 更新待处理记录状态
    db.prepare(`
      UPDATE pending_scores
      SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?
    `).run(authReq.userId, pendingId);

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'RESOLVE_PENDING_SCORE', JSON.stringify({ pendingId, studentId }));

    logger.info('处理待处理记录成功', { pendingId, studentId, studentName: student.name });

    res.json({ 
      success: true, 
      message: '记录已处理',
      scoreId: scoreResult.lastInsertRowid,
      studentName: student.name,
      studentClass: student.class
    });
  } catch (error) {
    logger.error('处理待处理记录失败:', error);
    res.status(500).json({ error: '处理待处理记录失败' });
  }
});

// 拒绝待处理记录
router.post('/pending/:id/reject', authenticateToken, (req: Request, res: Response) => {
  try {
    const pendingId = req.params.id;
    const authReq = req as AuthRequest;

    const result = db.prepare(`
      UPDATE pending_scores
      SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?
    `).run(authReq.userId, pendingId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '待处理记录不存在' });
    }

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'REJECT_PENDING_SCORE', JSON.stringify({ pendingId }));

    logger.info('拒绝待处理记录', { pendingId });

    res.json({ success: true, message: '记录已拒绝' });
  } catch (error) {
    logger.error('拒绝待处理记录失败:', error);
    res.status(500).json({ error: '拒绝待处理记录失败' });
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
