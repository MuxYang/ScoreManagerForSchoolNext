import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { 
  decryptCookie, 
  validateCookie, 
  extractBrowserFingerprint,
  createCookieData,
  encryptCookie,
  getCookieMaxAge
} from '../utils/cookieEncryption';
import db from '../models/database';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET 环境变量未设置！');
    return res.status(500).json({ error: '服务器安全配置错误，请联系管理员。' });
  }

  if (JWT_SECRET.length < 32) {
    logger.error('FATAL: JWT_SECRET 长度不足（当前: ' + JWT_SECRET.length + '，要求: >= 32）');
    return res.status(500).json({ error: '服务器安全配置错误，请联系管理员。' });
  }

  // 优先验证加密的 auth_session Cookie（包含5分钟超时和服务器重启检测）
  const authSessionCookie = req.cookies?.auth_session;
  
  if (authSessionCookie) {
    try {
      // 解密 Cookie
      const cookieData = decryptCookie(authSessionCookie);
      
      if (cookieData) {
        // 提取浏览器指纹
        const userAgent = req.headers['user-agent'] || '';
        const acceptLanguage = req.headers['accept-language'];
        const currentFingerprint = extractBrowserFingerprint(userAgent, acceptLanguage);
        
        // 验证 Cookie（检查时间戳、sessionId、浏览器指纹）
        const validation = validateCookie(cookieData, currentFingerprint);
        
        if (validation.valid) {
          // Cookie基本验证通过，现在验证用户密码
          // 从数据库读取用户信息
          const user = db.prepare('SELECT id, username, password_hash FROM users WHERE id = ? AND username = ?')
            .get(cookieData.userId, cookieData.username) as any;
          
          if (!user) {
            // 用户不存在（数据库可能被删除或用户被删除）
            logger.warn('Cookie user not found in database', {
              userId: cookieData.userId,
              username: cookieData.username
            });
            
            // 清除无效的 Cookie
            res.clearCookie('auth_session', {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/'
            });
            
            return res.status(401).json({
              error: '用户不存在，请重新登录',
              code: 'USER_NOT_FOUND'
            });
          }
          
          // 验证密码哈希是否匹配
          if (user.password_hash !== cookieData.passwordHash) {
            // 密码已更改，cookie失效
            logger.warn('Cookie password hash mismatch', {
              username: cookieData.username
            });
            
            // 清除无效的 Cookie
            res.clearCookie('auth_session', {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/'
            });
            
            return res.status(401).json({
              error: '密码已更改，请重新登录',
              code: 'PASSWORD_CHANGED'
            });
          }
          
          // 所有验证通过，设置用户信息
          (req as AuthRequest).userId = cookieData.userId;
          (req as AuthRequest).username = cookieData.username;
          
          // 检查是否需要续期（剩余时间少于2分钟时续期）
          const age = Date.now() - cookieData.timestamp;
          const remainingTime = getCookieMaxAge() - age;
          
          if (remainingTime < 2 * 60 * 1000) { // 剩余时间少于2分钟
            try {
              // 创建新的 Cookie（更新时间戳）
              const newCookieData = createCookieData(
                cookieData.username,
                cookieData.userId,
                cookieData.passwordHash,
                currentFingerprint
              );
              const newEncryptedCookie = encryptCookie(newCookieData);
              
              // 设置新的 Cookie
              res.cookie('auth_session', newEncryptedCookie, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: getCookieMaxAge(),
                path: '/'
              });
              
              logger.debug('Cookie renewed', { 
                username: cookieData.username,
                remainingTime: Math.floor(remainingTime / 1000) + 's'
              });
            } catch (error) {
              logger.error('Failed to renew cookie', { error });
            }
          }
          
          return next();
        } else {
          // Cookie 验证失败（过期、服务器重启或浏览器指纹不匹配）
          logger.info('Cookie validation failed', { 
            reason: validation.reason,
            username: cookieData.username
          });
          
          // 清除无效的 Cookie
          res.clearCookie('auth_session', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
          });
          
          // 如果是服务器重启或过期，返回特定错误码
          if (validation.reason === 'SERVER_RESTART') {
            return res.status(401).json({ 
              error: '服务器已重启，请重新登录',
              code: 'SERVER_RESTART'
            });
          } else if (validation.reason === 'EXPIRED') {
            return res.status(401).json({ 
              error: '会话已过期（超过5分钟未操作），请重新登录',
              code: 'SESSION_EXPIRED'
            });
          } else {
            return res.status(401).json({ 
              error: '会话验证失败，请重新登录',
              code: validation.reason || 'VALIDATION_FAILED'
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Cookie authentication error', { error });
      // Cookie 解密失败，继续尝试 JWT
    }
  }
  
  // 如果没有有效的加密 Cookie，尝试使用 JWT Token（向后兼容）
  let token = req.cookies?.token;
  
  // 如果 Cookie 中没有，则从 Authorization header 读取
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌或会话已过期' });
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
