import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { ensureEnvFile } from './utils/envGenerator';

// 首次运行时自动生成 .env 文件（必须在 dotenv.config() 之前）
ensureEnvFile();

// 加载环境变量（必须在导入路由之前，因为路由模块会使用环境变量）
dotenv.config();

import db, { initializeDatabase, createDefaultAdmin } from './models/database';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeServerSessionId } from './utils/cookieEncryption';
import { validateOneTimeToken } from './middleware/tokenValidator';
import { normalizeIp } from './utils/ipHelper';

// 导入路由
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import teacherRoutes from './routes/teachers';
import scoreRoutes from './routes/scores';
import backupRoutes from './routes/backup';
import importExportRoutes from './routes/import-export';
import userConfigRoutes from './routes/userConfig';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0'; // Allow LAN connections

// Configure trust proxy - only trust loopback for security
// For LAN applications, we don't expect external proxies
// 'loopback' trusts only 127.0.0.1 and ::1
app.set('trust proxy', 'loopback');

// Initialize server session ID (generates new one on each startup)
const sessionId = initializeServerSessionId();
// Only log to file, not to console
logger.info('Server session ID initialized', { sessionIdPrefix: sessionId.substring(0, 8) });

// Initialize database
try {
  initializeDatabase();
  logger.info('Database initialized successfully');
  
  // Create default admin account (if no users exist)
  createDefaultAdmin().catch(err => {
    logger.error('Failed to create default admin account:', err);
  });
} catch (error) {
  logger.error('Database initialization failed:', error);
  process.exit(1);
}

// LAN access restriction middleware
app.use((req, res, next) => {
  const ip = normalizeIp(req);
  
  // Allowed IP ranges:
  // - 127.0.0.1 (localhost)
  // - 10.0.0.0 - 10.255.255.255 (Class A private)
  // - 172.16.0.0 - 172.31.255.255 (Class B private)
  // - 192.168.0.0 - 192.168.255.255 (Class C private)
  // - ::1 (IPv6 localhost)
  // - fe80::/10 (IPv6 link-local)
  
  const isLocalhost = ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip === '';
  const isPrivateNetwork = 
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^fe80:/i.test(ip);
  
  if (!isLocalhost && !isPrivateNetwork) {
    logger.warn('Rejected public IP access', { ip, path: req.path });
    return res.status(403).json({ 
      error: 'This service is only accessible from LAN' 
    });
  }
  
  next();
});

// Security middleware
app.use(helmet());

// CORS configuration - allow all LAN origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (e.g., Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      
      // Allow localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return callback(null, true);
      }
      
      // Allow all LAN IPs
      const isPrivateNetwork = 
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^fe80:/i.test(hostname);
      
      if (isPrivateNetwork) {
        return callback(null, true);
      }
      
      // Reject other origins
      logger.warn('CORS: Rejected non-LAN origin', { origin });
      callback(new Error('Only LAN access allowed'));
    } catch (error) {
      logger.error('CORS: URL parsing failed', { origin, error });
      callback(new Error('Invalid request origin'));
    }
  },
  credentials: true // Allow sending cookies
}));

// Cookie parser middleware
app.use(cookieParser());

// Global API rate limit (lenient, prevents large-scale attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Max 150 requests per IP (increased to 150, separate login limit exists)
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Global rate limit triggered', { 
      ip: normalizeIp(req),
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({ 
      error: 'Too many requests, please try again later' 
    });
  }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: normalizeIp(req) });
  next();
});

// One-time token validation middleware (applied to all API routes)
app.use('/api', validateOneTimeToken);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/import-export', importExportRoutes);
app.use('/api/user-config', userConfigRoutes);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// Start server - LAN access allowed
const server = app.listen(PORT, HOST, () => {
  // Only log to file, not to console
  logger.info(`Server running at http://${HOST}:${PORT}`);
  logger.info('LAN access allowed (localhost + private networks)');
  
  // Console shows startup message and frontend URL
  console.log('OK Backend service started (LAN access enabled)');
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, starting graceful shutdown');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    logger.info('Database connection closed');
    process.exit(0);
  });
});

export default app;
