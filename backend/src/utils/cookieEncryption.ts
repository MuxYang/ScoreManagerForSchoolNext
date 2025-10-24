import crypto from 'crypto';
import logger from './logger';

// 服务器会话 ID - 每次后端重启时生成新的唯一标识
let SERVER_SESSION_ID: string = '';

// 加密密钥和算法配置
const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-gcm'; // 使用 GCM 模式的 AES-256，提供认证加密
const IV_LENGTH = 16; // 初始化向量长度
const AUTH_TAG_LENGTH = 16; // 认证标签长度
const SALT_LENGTH = 32; // 盐值长度

// Cookie 有效期：5 分钟（300 秒）
const COOKIE_MAX_AGE = 5 * 60 * 1000; // 5 分钟（毫秒）

/**
 * 从密码派生加密密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * 初始化服务器会话 ID
 * 应该在服务器启动时调用一次
 */
export function initializeServerSessionId(): string {
  SERVER_SESSION_ID = crypto.randomBytes(32).toString('hex');
  logger.info('Server session ID initialized', { 
    sessionIdPrefix: SERVER_SESSION_ID.substring(0, 8) 
  });
  return SERVER_SESSION_ID;
}

/**
 * 获取当前服务器会话 ID
 */
export function getServerSessionId(): string {
  if (!SERVER_SESSION_ID) {
    throw new Error('Server Session ID not initialized. Call initializeServerSessionId() first.');
  }
  return SERVER_SESSION_ID;
}

/**
 * 从请求中Extract browser fingerprint
 * 只包含稳定的、持久的信息
 */
export function extractBrowserFingerprint(userAgent: string, acceptLanguage?: string): string {
  // 解析 User-Agent 获取稳定的浏览器信息
  const uaMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
  const browser = uaMatch ? `${uaMatch[1]}/${uaMatch[2]}` : 'Unknown';
  
  // 解析操作系统信息
  let os = 'Unknown';
  if (userAgent.includes('Windows NT 10')) os = 'Windows10';
  else if (userAgent.includes('Windows NT 11')) os = 'Windows11';
  else if (userAgent.includes('Mac OS X')) os = 'MacOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  
  // 组合指纹（只包含稳定信息）
  const fingerprint = `${browser}|${os}|${acceptLanguage || 'unknown'}`;
  
  return fingerprint;
}

/**
 * Cookie 数据结构
 * Cookie中加密包含以下信息，所有条件必须同时满足才能自动登录：
 * 1. 用户名和密码（能够解锁数据库中的用户）
 * 2. UA（浏览器指纹）一致
 * 3. 上一次操作的时间戳与当前时间不超过300秒
 * 4. 后端sessionID匹配（服务器重启后sessionID会变化）
 */
export interface SecureCookieData {
  username: string;           // 用户名
  userId: number;             // 用户ID
  passwordHash: string;       // 用户密码哈希（必须与数据库中的密码哈希匹配）
  sessionId: string;          // 服务器session ID（服务器启动时生成，单个session不变）
  timestamp: number;          // 上一次操作的时间戳（用于验证5分钟超时）
  browserFingerprint: string; // 浏览器指纹（UA + 语言等）
}

/**
 * 加密 Cookie 数据
 * 使用 AES-256-GCM 提供认证加密
 */
export function encryptCookie(data: SecureCookieData): string {
  try {
    // 1. 生成随机盐和 IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 2. 从密码派生密钥
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    // 3. 创建加密器（使用 GCM 模式）
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // 4. 加密数据
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 5. 获取认证标签
    const authTag = cipher.getAuthTag();
    
    // 6. 组合：盐 + IV + 认证标签 + 加密数据
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex')
    ]);
    
    // 7. Base64 URL 安全编码
    return combined.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
      
  } catch (error) {
    logger.error('Cookie encryption error', { error });
    throw new Error('Failed to encrypt cookie');
  }
}

/**
 * Decrypt Cookie 数据
 */
export function decryptCookie(encryptedCookie: string): SecureCookieData | null {
  try {
    // 1. Base64 URL 安全解码
    const base64 = encryptedCookie
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const combined = Buffer.from(base64, 'base64');
    
    // 2. 分离各个部分
    if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      logger.warn('Invalid cookie format: too short');
      return null;
    }
    
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH, 
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // 3. 从密码派生密钥
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    // 4. 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // 5. 解密数据
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // 6. 解析 JSON
    const data = JSON.parse(decrypted) as SecureCookieData;
    
    // 7. 验证数据完整性
    if (!data.username || !data.userId || !data.sessionId || 
        !data.timestamp || !data.browserFingerprint || !data.passwordHash) {
      logger.warn('Invalid cookie data structure', { data });
      return null;
    }
    
    return data;
  } catch (error) {
    logger.warn('Cookie decryption error', { error: (error as Error).message });
    return null;
  }
}

/**
 * 验证 Cookie 基本信息是否有效
 * 注意：此函数只验证 sessionId、时间戳和浏览器指纹
 * 密码验证需要在中间件中进行（需要访问数据库）
 */
export function validateCookie(
  cookieData: SecureCookieData, 
  currentFingerprint: string
): { valid: boolean; reason?: string } {
  
  // 1. 验证 sessionId 是否匹配当前服务器会话
  if (cookieData.sessionId !== SERVER_SESSION_ID) {
    logger.info('Cookie session ID mismatch (server restarted)', {
      cookieSessionId: cookieData.sessionId.substring(0, 8),
      serverSessionId: SERVER_SESSION_ID.substring(0, 8)
    });
    return { valid: false, reason: 'SERVER_RESTART' };
  }
  
  // 2. 验证时间戳（不能超过 300 秒）
  const now = Date.now();
  const age = now - cookieData.timestamp;
  
  if (age < 0) {
    logger.warn('Cookie timestamp is in the future', {
      timestamp: cookieData.timestamp,
      now
    });
    return { valid: false, reason: 'INVALID_TIMESTAMP' };
  }
  
  if (age > COOKIE_MAX_AGE) {
    logger.debug('Cookie expired', {
      age: Math.floor(age / 1000),
      maxAge: COOKIE_MAX_AGE / 1000
    });
    return { valid: false, reason: 'EXPIRED' };
  }
  
  // 3. 验证浏览器指纹
  if (cookieData.browserFingerprint !== currentFingerprint) {
    logger.warn('Browser fingerprint mismatch', {
      cookie: cookieData.browserFingerprint,
      current: currentFingerprint,
      username: cookieData.username
    });
    return { valid: false, reason: 'FINGERPRINT_MISMATCH' };
  }
  
  return { valid: true };
}

/**
 * 创建新的 Cookie 数据
 */
export function createCookieData(
  username: string, 
  userId: number,
  passwordHash: string,
  browserFingerprint: string
): SecureCookieData {
  return {
    username,
    userId,
    passwordHash,
    sessionId: getServerSessionId(),
    timestamp: Date.now(),
    browserFingerprint,
  };
}

/**
 * 获取 Cookie 的最大有效期（毫秒）
 */
export function getCookieMaxAge(): number {
  return COOKIE_MAX_AGE;
}
