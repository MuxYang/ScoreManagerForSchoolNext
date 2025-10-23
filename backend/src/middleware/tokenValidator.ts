import { Request, Response, NextFunction } from 'express';
import { validateAndConsumeToken } from '../utils/oneTimeToken';
import logger from '../utils/logger';

/**
 * 一次性token验证中间件
 * 从请求头 x-request-token 中获取token并验证
 */
export function validateOneTimeToken(req: Request, res: Response, next: NextFunction): void {
  // 对于某些路径，跳过token验证
  // 这些路径不需要token（登录、注册、密码重置等公开接口）
  // 注意：因为中间件挂载在 /api 路由上，所以这里的path不包含 /api 前缀
  const exemptPaths = [
    '/auth/token',           // 获取token的端点本身
    '/auth/login',           // 登录
    '/auth/verify-cookie',   // Cookie自动登录验证
    '/auth/security-question', // 获取安全问题（密码重置用）
    '/auth/reset-password',  // 重置密码
  ];
  
  if (exemptPaths.some(path => req.path === path)) {
    return next();
  }
  
  const token = req.headers['x-request-token'] as string;
  
  if (!validateAndConsumeToken(token)) {
    logger.warn('token验证失败', { 
      ip: req.ip,
      path: req.path,
      method: req.method 
    });
    
    res.status(403).json({ 
      error: '无效或过期的请求token' 
    });
    return;
  }
  
  next();
}

