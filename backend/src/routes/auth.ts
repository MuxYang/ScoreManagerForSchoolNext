import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth';
import db, { 
  encryptPassword, 
  decryptPassword, 
  isAdminUser, 
  getAllUsers, 
  createUser, 
  resetUserPassword, 
  deleteUser, 
  generateRandomPassword 
} from '../models/database';
import logger from '../utils/logger';
import { 
  encryptCookie, 
  decryptCookie, 
  validateCookie, 
  createCookieData,
  extractBrowserFingerprint,
  getCookieMaxAge,
  SecureCookieData
} from '../utils/cookieEncryption';
import {
  validateUsername,
  validatePasswordFormat,
  validateInput,
  sanitizeForLogging
} from '../utils/inputValidation';
import { generateOneTimeToken } from '../utils/oneTimeToken';
import { normalizeIp } from '../utils/ipHelper';

const router = express.Router();

// 获取一次性token的端点（不需要身份验证，在token验证中间件之前）
router.get('/token', (req: Request, res: Response) => {
  try {
    const token = generateOneTimeToken();
    
    // 检查是否为静默请求（用于避免日志污染）
    const isSilent = req.headers['x-silent-request'] === 'true';
    
    // 只在非静默模式下记录日志
    if (!isSilent) {
      logger.info('One-time token generated', { ip: req.ip || 'unknown' });
    }
    
    res.json({ token });
  } catch (error) {
    logger.error('Failed to generate token:', error);
    res.status(500).json({ error: '生成token失败' });
  }
});

// JWT_SECRET 获取函数（延迟检查，确保.env已加载）
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未设置');
  }
  return secret;
}

// JWT_EXPIRES_IN 获取函数（延迟检查，确保.env已加载）
function getJwtExpiresIn(): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return expiresIn;
}

// 速率限制配置
// 登录端点严格限制（防止暴力破解）
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟窗口
  max: 5, // 最多 5 次尝试
  message: '登录尝试次数过多，请1分钟后再试',
  standardHeaders: true, // 返回 RateLimit-* 响应头
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Login rate limit triggered', { 
      ip: normalizeIp(req),
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({ 
      error: '登录尝试次数过多，请1分钟后再试' 
    });
  }
});

// 密码重置端点限制
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时窗口
  max: 3, // 最多 3 次尝试
  message: '密码重置尝试次数过多，请1小时后再试',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Password reset rate limit triggered', { ip: normalizeIp(req) });
    res.status(429).json({ 
      error: '密码重置尝试次数过多，请1小时后再试' 
    });
  }
});

// 通用认证操作限制（较宽松）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 20, // 最多 20 次请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 获取验证失败的友好提示信息
 */
function getValidationMessage(reason: string): string {
  switch (reason) {
    case 'SERVER_RESTART':
      return '服务器已重启，请重新登录';
    case 'EXPIRED':
      return '会话已过期（超过5分钟），请重新登录';
    case 'FINGERPRINT_MISMATCH':
      return '浏览器环境已变更，请重新登录';
    case 'INVALID_TIMESTAMP':
      return '会话时间异常，请重新登录';
    default:
      return '会话无效，请重新登录';
  }
}

// 密码强度验证函数
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  // 先验证密码格式（字符类型限制）
  const formatValidation = validatePasswordFormat(password);
  if (!formatValidation.valid) {
    return formatValidation;
  }

  // 至少8位
  if (password.length < 8) {
    return { valid: false, error: '密码长度至少为8位' };
  }

  // 检查包含的字符类型
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\];'\\|,.<>\/?]/.test(password);

  const typeCount = [hasUpperCase, hasLowerCase, hasNumber, hasSymbol].filter(Boolean).length;

  // 必须包含大小写字母，且必须包含数字或符号
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, error: '密码必须包含大写字母和小写字母' };
  }

  if (!hasNumber && !hasSymbol) {
    return { valid: false, error: '密码必须包含数字或符号' };
  }

  // 四选三：大写字母、小写字母、数字、符号至少包含三种
  if (typeCount < 3) {
    return { valid: false, error: '密码必须包含大写字母、小写字母、数字、符号中的至少三种' };
  }

  return { valid: true };
}

// 用户注册 - 公开注册已禁用，只允许管理员创建用户
router.post('/register', async (req: Request, res: Response) => {
  return res.status(403).json({ 
    error: '公开注册功能已禁用。只有管理员可以创建新用户账户。' 
  });
});

// 用户登录（应用速率限制）
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填的' });
    }

    // 验证用户名格式
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error });
    }

    // 验证密码格式
    const passwordValidation = validatePasswordFormat(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // 安全检查
    const inputValidation = validateInput(username, { maxLength: 20 });
    if (!inputValidation.valid) {
      logger.warn('Login attempt blocked: Malicious input detected', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '输入包含非法字符' });
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 检查用户的当前密码是否符合新的强度要求
    // 如果不符合，标记需要修改密码
    let mustChangePassword = user.must_change_password === 1;
    
    if (!mustChangePassword) {
      // 验证当前密码强度
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        // Password does not meet new requirements, mark for change
        db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(user.id);
        mustChangePassword = true;
        logger.info('Weak password detected, require user to change', { userId: user.id, username });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() } as jwt.SignOptions
    );

    // Log the action
    db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)')
      .run(user.id, 'LOGIN', normalizeIp(req));

    logger.info('User login successful', { username, userId: user.id });

    // Extract browser fingerprint
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'];
    const browserFingerprint = extractBrowserFingerprint(userAgent, acceptLanguage);
    
    logger.debug('Browser fingerprint created', { 
      username, 
      fingerprint: browserFingerprint,
      userAgent: userAgent.substring(0, 50)
    });

    // 创建加密的 Cookie 数据（包含浏览器指纹和密码哈希）
    const cookieData = createCookieData(
      user.username, 
      user.id, 
      user.password_hash,  // 包含密码哈希用于数据库加密
      browserFingerprint
    );
    const encryptedCookie = encryptCookie(cookieData);

    // 设置加密的 HTTP Cookie（5分钟有效期）
    res.cookie('auth_session', encryptedCookie, {
      httpOnly: true,        // 防止 XSS 攻击
      secure: false,         // 本地开发使用 HTTP，生产环境应设为 true（需要 HTTPS）
      sameSite: 'lax',       // CSRF 保护
      maxAge: getCookieMaxAge(), // 5分钟（毫秒）
      path: '/'
    });
    
    logger.debug('Auth cookie set', { username, expiresIn: '5 minutes' });

    // 返回 token、用户信息和加密的cookie（供前端存储）
    return res.json({ 
      token,
      encryptedCookie, // 前端可以存储并用于自动登录验证
      user: { 
        id: user.id, 
        username: user.username,
        mustChangePassword: mustChangePassword
      } 
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return res.status(500).json({ error: '登录失败' });
  }
});

// 获取密保问题
router.post('/security-question', (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: '用户名是必填的' });
    }

    // 输入验证和防注入处理
    const inputValidation = validateInput(username, { maxLength: 20 });
    if (!inputValidation.valid) {
      logger.warn('Security question request blocked: Malicious input detected', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '输入包含非法字符' });
    }

    // 只有admin用户才能获取密保问题
    if (username !== 'admin') {
      // 统一返回404，避免暴露用户存在性信息
      return res.status(404).json({ error: '用户不存在或不支持重置密码' });
    }

    const user = db.prepare('SELECT security_question FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在或不支持重置密码' });
    }

    res.json({ securityQuestion: user.security_question });
  } catch (error) {
    logger.error('Failed to get security question:', error);
    res.status(500).json({ error: '获取密保问题失败' });
  }
});

// 验证密保答案
router.post('/verify-security-answer', (req: Request, res: Response) => {
  try {
    const { username, securityAnswer } = req.body;

    if (!username || !securityAnswer) {
      return res.status(400).json({ error: '用户名和密保答案是必填的' });
    }

    // 输入验证和防注入处理
    const usernameValidation = validateInput(username, { maxLength: 20 });
    if (!usernameValidation.valid) {
      logger.warn('Security answer verification blocked: Malicious username input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '用户名包含非法字符' });
    }

    const answerValidation = validateInput(securityAnswer, { maxLength: 100 });
    if (!answerValidation.valid) {
      logger.warn('Security answer verification blocked: Malicious answer input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '密保答案包含非法字符' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证密保答案
    try {
      decryptPassword(user.encrypted_password, securityAnswer);
      res.json({ valid: true, message: '密保答案正确' });
    } catch {
      res.status(401).json({ valid: false, error: '密保答案错误' });
    }
  } catch (error) {
    logger.error('Failed to verify security answer:', error);
    res.status(500).json({ error: '验证密保答案失败' });
  }
});

// 重置密码（应用速率限制）
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { username, securityAnswer, newPassword, newSecurityQuestion, newSecurityAnswer } = req.body;

    if (!username || !securityAnswer || !newPassword || !newSecurityQuestion || !newSecurityAnswer) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }

    // 输入验证和防注入处理
    const usernameValidation = validateInput(username, { maxLength: 20 });
    if (!usernameValidation.valid) {
      logger.warn('Password reset blocked: Malicious username input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '用户名包含非法字符' });
    }

    const answerValidation = validateInput(securityAnswer, { maxLength: 100 });
    if (!answerValidation.valid) {
      logger.warn('Password reset blocked: Malicious security answer input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '密保答案包含非法字符' });
    }

    const newQuestionValidation = validateInput(newSecurityQuestion, { maxLength: 200 });
    if (!newQuestionValidation.valid) {
      logger.warn('Password reset blocked: Malicious new security question input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '新密保问题包含非法字符' });
    }

    const newAnswerValidation = validateInput(newSecurityAnswer, { maxLength: 100 });
    if (!newAnswerValidation.valid) {
      logger.warn('Password reset blocked: Malicious new security answer input', { 
        usernameHash: sanitizeForLogging(username, { type: 'hash' }),
        ip: normalizeIp(req)
      });
      return res.status(400).json({ error: '新密保答案包含非法字符' });
    }

    // 验证新密码格式
    const passwordFormatValidation = validatePasswordFormat(newPassword);
    if (!passwordFormatValidation.valid) {
      return res.status(400).json({ error: passwordFormatValidation.error });
    }

    // 验证新密码强度
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证旧密保答案
    try {
      decryptPassword(user.encrypted_password, securityAnswer);
    } catch {
      return res.status(401).json({ error: '密保答案错误' });
    }

    // 加密新密码（使用新的密保答案）
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPassword(newPassword, newSecurityAnswer);

    // 更新密码、密保问题和密保答案
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, 
          security_question = ?, 
          encrypted_password = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, newSecurityQuestion, encryptedPassword, user.id);

    logger.info('Password reset successful', { 
      username, 
      userId: user.id,
      newSecurityQuestion: sanitizeForLogging(newSecurityQuestion, { type: 'hash' })
    });

    res.json({ message: '密码和密保信息重置成功' });
  } catch (error) {
    logger.error('Password reset failed:', error);
    res.status(500).json({ error: '密码重置失败' });
  }
});

// 修改密码（需要登录，应用速率限制）
router.post('/change-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }

    // 验证新密码格式
    const passwordFormatValidation = validatePasswordFormat(newPassword);
    if (!passwordFormatValidation.valid) {
      return res.status(400).json({ error: passwordFormatValidation.error });
    }

    // 验证新密码强度
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // 获取用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证旧密码
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(newPasswordHash, userId);

    logger.info('User password changed successfully', { userId });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    logger.error('Password change failed:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 登出（清除 Cookie）
router.post('/logout', (req: Request, res: Response) => {
  // 清除所有认证相关的 Cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  });
  
  res.clearCookie('auth_session', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  });
  
  logger.info('User logout successful');
  return res.json({ message: '登出成功' });
});

// Cookie 自动登录验证
router.post('/verify-cookie', async (req: Request, res: Response) => {
  try {
    const { encryptedCookie } = req.body;

    if (!encryptedCookie) {
      logger.debug('Auto-login failed: no cookie provided');
      return res.status(400).json({ error: '未提供 Cookie 数据', code: 'NO_COOKIE' });
    }

    // Decrypt Cookie
    const cookieData = decryptCookie(encryptedCookie);
    if (!cookieData) {
      logger.warn('Auto-login failed: cookie decryption failed');
      return res.status(401).json({ error: 'Cookie 解密失败或已损坏', code: 'DECRYPT_FAILED' });
    }

    // 提取当前请求的浏览器指纹
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'];
    const currentFingerprint = extractBrowserFingerprint(userAgent, acceptLanguage);

    // 验证 Cookie 有效性（检查 sessionId、时间戳、浏览器指纹）
    const validation = validateCookie(cookieData, currentFingerprint);
    if (!validation.valid) {
      logger.info('Auto-login failed: cookie validation failed', {
        reason: validation.reason,
        username: cookieData.username,
        age: Math.floor((Date.now() - cookieData.timestamp) / 1000)
      });
      return res.status(401).json({ 
        error: '会话已过期或无效',
        code: validation.reason,
        message: getValidationMessage(validation.reason!)
      });
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND username = ?')
      .get(cookieData.userId, cookieData.username) as any;
      
    if (!user) {
      logger.warn('Auto-login failed: user not found', { 
        userId: cookieData.userId, 
        username: cookieData.username 
      });
      return res.status(401).json({ error: '用户不存在', code: 'USER_NOT_FOUND' });
    }

    // 检查是否需要修改密码
    const mustChangePassword = user.must_change_password === 1;

    // 生成新的 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      getJwtSecret(),
      { expiresIn: getJwtExpiresIn() } as jwt.SignOptions
    );

    // 创建新的 Cookie（更新时间戳）
    const newCookieData = createCookieData(
      user.username, 
      user.id, 
      user.password_hash,  // 保持密码哈希
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

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)')
      .run(user.id, 'AUTO_LOGIN', normalizeIp(req));

    logger.info('Cookie auto-login successful', { 
      username: user.username, 
      userId: user.id,
      newCookieExpiry: new Date(Date.now() + getCookieMaxAge()).toISOString()
    });

    // 返回用户信息和新 token、新 cookie
    return res.json({
      token,
      encryptedCookie: newEncryptedCookie, // 返回新的 cookie 供前端更新
      user: {
        id: user.id,
        username: user.username,
        mustChangePassword: mustChangePassword
      }
    });
  } catch (error) {
    logger.error('Cookie validation failed:', error);
    return res.status(500).json({ error: 'Cookie 验证失败' });
  }
});

// 首次登录强制修改密码和设置密保
router.post('/first-login-setup', async (req: Request, res: Response) => {
  try {
    const { userId, newPassword, securityQuestion, securityAnswer } = req.body;

    if (!userId || !newPassword || !securityQuestion || !securityAnswer) {
      return res.status(400).json({ error: '所有字段都是必填的' });
    }

    // 验证新密码格式
    const passwordFormatValidation = validatePasswordFormat(newPassword);
    if (!passwordFormatValidation.valid) {
      return res.status(400).json({ error: passwordFormatValidation.error });
    }

    // 验证新密码强度
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // 获取用户信息
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPassword(newPassword, securityAnswer);

    // 更新密码、密保问题和取消强制修改密码标记
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, 
          security_question = ?, 
          encrypted_password = ?,
          must_change_password = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, securityQuestion, encryptedPassword, userId);

    logger.info('User completed first login setup', { userId, username: user.username });

    res.json({ message: '密码和密保设置成功' });
  } catch (error) {
    logger.error('First login setup failed:', error);
    res.status(500).json({ error: '设置失败' });
  }
});

// ===== 用户管理 API (仅管理员) =====

// 中间件：检查管理员权限
const requireAdmin = (req: any, res: Response, next: any) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: '未认证' });
  }
  
  if (!isAdminUser(userId)) {
    logger.warn('Non-admin user attempted admin operation', { userId });
    return res.status(403).json({ error: '需要管理员权限' });
  }
  
  next();
};

// 获取所有用户列表
router.get('/users', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  try {
    const users = getAllUsers();
    res.json({ users });
  } catch (error) {
    logger.error('Failed to get users list:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 创建新用户
router.post('/users', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const { username, password, mustChangePassword = true } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填的' });
    }
    
    // 验证用户名格式
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error });
    }
    
    // 验证密码格式
    const passwordValidation = validatePasswordFormat(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    
    // 验证密码强度
    const strengthValidation = validatePasswordStrength(password);
    if (!strengthValidation.valid) {
      return res.status(400).json({ error: strengthValidation.error });
    }
    
    // 创建用户
    const newUserId = await createUser(username, password, req.userId, mustChangePassword);
    
    logger.info('New user created by admin', { 
      newUserId, 
      username, 
      mustChangePassword,
      createdBy: req.userId 
    });
    
    res.status(201).json({ 
      message: '用户创建成功',
      userId: newUserId,
      username,
      mustChangePassword
    });
  } catch (error: any) {
    logger.error('Failed to create user:', error);
    res.status(500).json({ 
      error: error.message === '用户名已存在' ? error.message : '创建用户失败' 
    });
  }
});

// 重置用户密码
router.post('/users/:id/reset-password', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: '新密码是必填的' });
    }
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    // 验证新密码格式
    const passwordValidation = validatePasswordFormat(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    
    // 验证密码强度
    const strengthValidation = validatePasswordStrength(newPassword);
    if (!strengthValidation.valid) {
      return res.status(400).json({ error: strengthValidation.error });
    }
    
    // 重置密码
    await resetUserPassword(userId, newPassword, req.userId);
    
    logger.info('User password reset by admin', { 
      targetUserId: userId, 
      resetBy: req.userId 
    });
    
    res.json({ message: '密码重置成功，用户下次登录时需要修改密码' });
  } catch (error: any) {
    logger.error('Failed to reset user password:', error);
    res.status(500).json({ 
      error: error.message === '用户不存在' ? error.message : '重置密码失败' 
    });
  }
});

// 生成随机密码（用于创建用户或重置密码）
router.get('/generate-password', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  try {
    const length = parseInt(req.query.length as string) || 12;
    if (length < 8 || length > 32) {
      return res.status(400).json({ error: '密码长度必须在8-32位之间' });
    }
    
    const password = generateRandomPassword(length);
    res.json({ password });
  } catch (error) {
    logger.error('Failed to generate password:', error);
    res.status(500).json({ error: '生成密码失败' });
  }
});

// 删除用户
router.delete('/users/:id', authenticateToken, requireAdmin, (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    // 删除用户
    deleteUser(userId, req.userId);
    
    logger.info('User deleted by admin', { 
      deletedUserId: userId, 
      deletedBy: req.userId 
    });
    
    res.json({ message: '用户删除成功' });
  } catch (error: any) {
    logger.error('Failed to delete user:', error);
    const knownErrors = ['用户不存在', '不能删除管理员账户', '不能删除自己的账户'];
    if (knownErrors.includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;

