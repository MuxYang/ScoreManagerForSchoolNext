import { Request } from 'express';

/**
 * Normalize IP address from Express request
 * Removes IPv6 prefix (::ffff:) and handles x-forwarded-for header
 * 
 * @param req - Express Request object
 * @returns Normalized IP address as string
 */
export function normalizeIp(req: Request): string {
  // Try to get IP from various sources
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
  
  // Handle arrays (x-forwarded-for can be comma-separated)
  const ip = typeof clientIp === 'string' ? clientIp : Array.isArray(clientIp) ? clientIp[0] : '';
  
  // Remove IPv6 prefix if present
  return ip.replace(/^::ffff:/, '');
}

