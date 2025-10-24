import { Request, Response, NextFunction } from 'express';
import { validateAndConsumeToken } from '../utils/oneTimeToken';
import logger from '../utils/logger';
import { normalizeIp } from '../utils/ipHelper';

/**
 * One-time token validation middleware
 * Retrieves and validates token from x-request-token request header
 */
export function validateOneTimeToken(req: Request, res: Response, next: NextFunction): void {
  // Skip token validation for certain paths
  // These paths don't require tokens (login, register, password reset, etc. public endpoints)
  // Note: Since middleware is mounted on /api route, path here doesn't include /api prefix
  const exemptPaths = [
    '/auth/token',           // Token endpoint itself
    '/auth/login',           // Login
    '/auth/verify-cookie',   // Cookie auto-login verification
    '/auth/security-question', // Get security question (for password reset)
    '/auth/reset-password',  // Reset password
  ];
  
  if (exemptPaths.some(path => req.path === path)) {
    return next();
  }
  
  const token = req.headers['x-request-token'] as string;
  
  if (!validateAndConsumeToken(token)) {
    logger.warn('Token validation failed', { 
      ip: normalizeIp(req),
      path: req.path,
      method: req.method 
    });
    
    res.status(403).json({ 
      error: 'Invalid or expired request token' 
    });
    return;
  }
  
  next();
}

