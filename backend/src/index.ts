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

// 导入路由
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import teacherRoutes from './routes/teachers';
import scoreRoutes from './routes/scores';
import backupRoutes from './routes/backup';
import importExportRoutes from './routes/import-export';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

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

// Security middleware
app.use(helmet());

// CORS configuration - localhost only
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (e.g., Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS origin not allowed'));
    }
  },
  credentials: true // Allow sending cookies
}));

// Cookie parser middleware
app.use(cookieParser());

// 全局 API 速率限制（较宽松，防止大规模攻击）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 150, // 每个 IP 最多 150 个请求（提高到 150，因为有单独的登录限制）
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true, // 返回 RateLimit-* 响应头
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('全局速率限制触发', { 
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({ 
      error: '请求过于频繁，请稍后再试' 
    });
  }
});
app.use(limiter);

// Body 解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

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

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// Start server - localhost only
const server = app.listen(PORT, HOST, () => {
  // Only log to file, not to console
  logger.info(`Server running at http://${HOST}:${PORT}`);
  logger.info('Localhost access only (localhost/127.0.0.1)');
  
  // Console shows startup message and frontend URL
  console.log('OK Backend service started');
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
