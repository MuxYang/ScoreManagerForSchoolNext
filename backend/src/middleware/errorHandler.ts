import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { normalizeIp } from '../utils/ipHelper';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: normalizeIp(req),
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Resource not found' });
}
