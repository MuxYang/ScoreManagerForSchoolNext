import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { encryptPassword, decryptPassword, canCreateUser } from '../models/database';
import logger from '../utils/logger';
import { 
  encryptCookie, 
  decryptCookie, 
  validateCookie, 
  createCookieData 
} from '../utils/cookieEncryption';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天

// 密码强度验证函数
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  // 至少8位
  if (password.length < 8) {
    return { valid: false, error: '密码长度至少为8位' };
  }

  // 检查包含的字符类型
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

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

// 用户注册 - 已禁用，系统只允许单个管理员用户
router.post('/register', async (req: Request, res: Response) => {
  return res.status(403).json({ 
    error: '注册功能已禁用，系统只允许单个管理员账户。如需重置，请联系系统管理员。' 
  });
});

// 用户登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填的' });
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
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Log the action
    db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)')
      .run(user.id, 'LOGIN', req.ip);

    logger.info('User login successful', { username, userId: user.id });

    // 创建加密的 Cookie 数据
    const cookieData = createCookieData(user.username, user.password_hash);
    const encryptedCookie = encryptCookie(cookieData);

    // 设置加密的 HTTP Cookie（7天有效期）
    res.cookie('auth_session', encryptedCookie, {
      httpOnly: true,        // 防止 XSS 攻击
      secure: false,         // 本地开发使用 HTTP，生产环境应设为 true（需要 HTTPS）
      sameSite: 'lax',       // CSRF 保护
      maxAge: COOKIE_MAX_AGE, // 7天（毫秒）
      path: '/'
    });

    // 同时在响应体中返回 token（兼容现有实现）
    return res.json({ 
      token,
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

    const user = db.prepare('SELECT security_question FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ securityQuestion: user.security_question });
  } catch (error) {
    logger.error('Failed to get security question:', error);
    res.status(500).json({ error: '获取密保问题失败' });
  }
});

// 重置密码
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { username, securityAnswer, newPassword, newSecurityQuestion } = req.body;

    if (!username || !securityAnswer || !newPassword || !newSecurityQuestion) {
      return res.status(400).json({ error: '所有字段都是必填的' });
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

    // 尝试解密旧密码验证密保答案
    try {
      decryptPassword(user.encrypted_password, securityAnswer);
    } catch {
      return res.status(401).json({ error: '密保答案错误' });
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const encryptedPassword = encryptPassword(newPassword, securityAnswer);

    // 更新密码
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, security_question = ?, encrypted_password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, newSecurityQuestion, encryptedPassword, user.id);

    logger.info('Password reset successful', { username, userId: user.id });

    res.json({ message: '密码重置成功' });
  } catch (error) {
    logger.error('Password reset failed:', error);
    res.status(500).json({ error: '密码重置失败' });
  }
});

// 修改密码（需要登录）
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: '所有字段都是必填的' });
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
      return res.status(400).json({ error: '未提供 Cookie 数据' });
    }

    // 解密 Cookie
    const cookieData = decryptCookie(encryptedCookie);
    if (!cookieData) {
      return res.status(401).json({ error: 'Cookie 解密失败或已损坏' });
    }

    // 验证 Cookie 有效性（检查 sessionId 和时间戳）
    if (!validateCookie(cookieData, COOKIE_MAX_AGE)) {
      return res.status(401).json({ error: 'Cookie 已过期或无效（服务器可能已重启）' });
    }

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cookieData.username) as any;
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    // 验证密码 hash 是否匹配
    if (user.password_hash !== cookieData.passwordHash) {
      return res.status(401).json({ error: '密码已更改，请重新登录' });
    }

    // 检查是否需要修改密码
    const mustChangePassword = user.must_change_password === 1;

    // 生成新的 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 记录日志
    db.prepare('INSERT INTO logs (user_id, action, ip_address) VALUES (?, ?, ?)')
      .run(user.id, 'AUTO_LOGIN', req.ip);

    logger.info('Cookie auto-login successful', { username: user.username, userId: user.id });

    // 返回用户信息和新 token
    return res.json({
      token,
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

export default router;

