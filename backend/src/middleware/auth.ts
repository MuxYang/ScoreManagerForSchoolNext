import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).username = decoded.username;
    next();
  } catch (error) {
    logger.error('Token 验证失败:', error);
    return res.status(403).json({ error: '无效的认证令牌' });
  }
}
