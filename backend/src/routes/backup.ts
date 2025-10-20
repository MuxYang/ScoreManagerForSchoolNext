import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import db from '../models/database';
import logger from '../utils/logger';

const router = express.Router();
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || './backups');
const DB_PATH = path.resolve(process.env.DB_PATH || './data/database.db');

// 确保备份目录存在
try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('创建备份目录成功', { path: BACKUP_DIR });
  }
} catch (error) {
  logger.error('创建备份目录失败:', error);
}

// 创建备份
router.post('/create', authenticateToken, (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);

    logger.info('开始创建备份', { 
      filename, 
      backupPath,
      dbPath: DB_PATH,
      backupDirExists: fs.existsSync(BACKUP_DIR)
    });

    // 执行备份 - 使用文件复制（最稳定的方式）
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`数据库文件不存在: ${DB_PATH}`);
    }

    // 复制数据库文件
    fs.copyFileSync(DB_PATH, backupPath);
    
    // 验证备份文件是否创建成功
    if (!fs.existsSync(backupPath)) {
      throw new Error('备份文件创建失败');
    }

    const stats = fs.statSync(backupPath);

    // 记录备份信息
    db.prepare(`
      INSERT INTO backups (filename, file_size, created_by)
      VALUES (?, ?, ?)
    `).run(filename, stats.size, authReq.userId);

    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'CREATE_BACKUP', JSON.stringify({ filename }));

    logger.info('创建备份成功', { filename, size: stats.size });

    res.json({ 
      message: '备份创建成功',
      filename,
      size: stats.size 
    });
  } catch (error: any) {
    logger.error('创建备份失败:', error);
    res.status(500).json({ error: `创建备份失败: ${error.message}` });
  }
});

// 获取备份列表
router.get('/list', authenticateToken, (req: Request, res: Response) => {
  try {
    const backups = db.prepare(`
      SELECT b.*, u.username as created_by_username
      FROM backups b
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC
    `).all();

    res.json(backups);
  } catch (error) {
    logger.error('获取备份列表失败:', error);
    res.status(500).json({ error: '获取备份列表失败' });
  }
});

// 恢复备份
router.post('/restore/:filename', authenticateToken, (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }

    // 在恢复前创建当前数据库的备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const autoBackupFilename = `auto-backup-before-restore-${timestamp}.db`;
    const autoBackupPath = path.join(BACKUP_DIR, autoBackupFilename);
    
    const dbPath = process.env.DB_PATH || './data/database.db';
    fs.copyFileSync(dbPath, autoBackupPath);

    const authReq = req as AuthRequest;
    const stats = fs.statSync(autoBackupPath);
    
    db.prepare(`
      INSERT INTO backups (filename, file_size, created_by)
      VALUES (?, ?, ?)
    `).run(autoBackupFilename, stats.size, authReq.userId);

    // 关闭当前数据库连接
    db.close();

    // 恢复备份
    fs.copyFileSync(backupPath, dbPath);

    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'RESTORE_BACKUP', JSON.stringify({ 
        filename, 
        autoBackup: autoBackupFilename 
      }));

    logger.info('恢复备份成功', { filename, autoBackup: autoBackupFilename });

    res.json({ 
      message: '备份恢复成功，当前数据库已自动备份',
      autoBackup: autoBackupFilename
    });
  } catch (error) {
    logger.error('恢复备份失败:', error);
    res.status(500).json({ error: '恢复备份失败' });
  }
});

// 删除备份
router.delete('/:filename', authenticateToken, (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }

    fs.unlinkSync(backupPath);

    db.prepare('DELETE FROM backups WHERE filename = ?').run(filename);

    const authReq = req as AuthRequest;
    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'DELETE_BACKUP', JSON.stringify({ filename }));

    logger.info('删除备份成功', { filename });

    res.json({ message: '备份删除成功' });
  } catch (error) {
    logger.error('删除备份失败:', error);
    res.status(500).json({ error: '删除备份失败' });
  }
});

// 获取数据库统计信息
router.get('/database-stats', authenticateToken, (req: Request, res: Response) => {
  try {
    // 获取各表的记录数
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get() as { count: number };
    const teacherCount = db.prepare('SELECT COUNT(*) as count FROM teachers').get() as { count: number };
    const scoreCount = db.prepare('SELECT COUNT(*) as count FROM scores').get() as { count: number };
    const backupCount = db.prepare('SELECT COUNT(*) as count FROM backups').get() as { count: number };
    const logCount = db.prepare('SELECT COUNT(*) as count FROM logs').get() as { count: number };

    // 获取数据库文件大小
    const dbPath = process.env.DB_PATH || './data/database.db';
    const stats = fs.statSync(dbPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    // 获取最后更新时间
    const lastModified = stats.mtime.toISOString();

    // 获取最近的操作
    const recentLogs = db.prepare(`
      SELECT action, created_at 
      FROM logs 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();

    res.json({
      tableStats: {
        users: userCount.count,
        students: studentCount.count,
        teachers: teacherCount.count,
        scores: scoreCount.count,
        backups: backupCount.count,
        logs: logCount.count,
      },
      fileInfo: {
        size: fileSizeInMB,
        path: dbPath,
        lastModified,
      },
      recentActivity: recentLogs,
    });
  } catch (error) {
    logger.error('获取数据库统计信息失败:', error);
    res.status(500).json({ error: '获取数据库统计信息失败' });
  }
});

// 优化数据库
router.post('/optimize', authenticateToken, (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    
    // 执行 VACUUM 命令优化数据库
    db.prepare('VACUUM').run();
    
    // 执行 ANALYZE 命令更新统计信息
    db.prepare('ANALYZE').run();

    db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
      .run(authReq.userId, 'OPTIMIZE_DATABASE', JSON.stringify({ success: true }));

    logger.info('数据库优化成功', { userId: authReq.userId });

    res.json({ message: '数据库优化成功' });
  } catch (error) {
    logger.error('数据库优化失败:', error);
    res.status(500).json({ error: '数据库优化失败' });
  }
});

export default router;
