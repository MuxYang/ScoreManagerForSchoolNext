import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// JWT_SECRET 必须通过环境变量设置，不允许使用默认值
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET 环境变量未设置！');
  throw new Error('JWT_SECRET 环境变量未设置，应用无法安全启动。请在 .env 文件中设置 JWT_SECRET');
}

if (JWT_SECRET.length < 32) {
  logger.error('FATAL: JWT_SECRET 长度不足（当前: ' + JWT_SECRET.length + '，要求: >= 32）');
  throw new Error('JWT_SECRET 长度必须至少 32 个字符，以确保安全性');
}

logger.info('JWT_SECRET 验证通过', { length: JWT_SECRET.length });

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // 优先从 Cookie 读取 token
  let token = req.cookies?.token;
  
  // 如果 Cookie 中没有，则从 Authorization header 读取（兼容现有实现）
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number; username: string };
    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).username = decoded.username;
    next();
  } catch (error) {
    logger.error('Token 验证失败:', error);
    return res.status(403).json({ error: '无效的认证令牌' });
  }
}
