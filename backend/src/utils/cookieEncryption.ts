import CryptoJS from 'crypto-js';
import crypto from 'crypto';

// 服务器会话 ID - 每次后端重启时生成新的
let SERVER_SESSION_ID: string = '';

// 加密密钥（从环境变量读取，或使用默认值）
const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';

/**
 * 初始化服务器会话 ID
 * 应该在服务器启动时调用一次
 */
export function initializeServerSessionId(): string {
  SERVER_SESSION_ID = crypto.randomBytes(32).toString('hex');
  // 只记录到日志文件，不输出到控制台
  // console.log('Server Session ID initialized:', SERVER_SESSION_ID.substring(0, 8) + '...');
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
 * Cookie 数据结构
 */
export interface CookieData {
  username: string;
  passwordHash: string;  // 存储密码的 hash，而不是明文
  sessionId: string;
  timestamp: number;
}

/**
 * 加密 Cookie 数据
 * 使用 AES-256 加密，并添加多层混淆
 */
export function encryptCookie(data: CookieData): string {
  try {
    // 1. 将数据转为 JSON
    const jsonData = JSON.stringify(data);
    
    // 2. 第一层：Base64 编码（混淆）
    const base64Data = Buffer.from(jsonData).toString('base64');
    
    // 3. 第二层：AES 加密
    const encrypted = CryptoJS.AES.encrypt(base64Data, ENCRYPTION_KEY).toString();
    
    // 4. 第三层：URL 安全编码
    const urlSafe = encodeURIComponent(encrypted);
    
    // 5. 添加校验和（防止篡改）
    const checksum = CryptoJS.SHA256(urlSafe + ENCRYPTION_KEY).toString().substring(0, 16);
    
    // 6. 组合：校验和 + 分隔符 + 加密数据
    return `${checksum}.${urlSafe}`;
  } catch (error) {
    console.error('Cookie encryption error:', error);
    throw new Error('Failed to encrypt cookie');
  }
}

/**
 * 解密 Cookie 数据
 */
export function decryptCookie(encryptedCookie: string): CookieData | null {
  try {
    // 1. 分离校验和和数据
    const parts = encryptedCookie.split('.');
    if (parts.length !== 2) {
      console.error('Invalid cookie format: missing checksum');
      return null;
    }
    
    const [receivedChecksum, urlSafeData] = parts;
    
    // 2. 验证校验和
    const expectedChecksum = CryptoJS.SHA256(urlSafeData + ENCRYPTION_KEY).toString().substring(0, 16);
    if (receivedChecksum !== expectedChecksum) {
      console.error('Cookie checksum verification failed');
      return null;
    }
    
    // 3. URL 解码
    const encrypted = decodeURIComponent(urlSafeData);
    
    // 4. AES 解密
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const base64Data = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!base64Data) {
      console.error('Decryption failed: empty result');
      return null;
    }
    
    // 5. Base64 解码
    const jsonData = Buffer.from(base64Data, 'base64').toString('utf8');
    
    // 6. 解析 JSON
    const data = JSON.parse(jsonData) as CookieData;
    
    // 7. 验证数据完整性
    if (!data.username || !data.passwordHash || !data.sessionId || !data.timestamp) {
      console.error('Invalid cookie data structure');
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Cookie decryption error:', error);
    return null;
  }
}

/**
 * 验证 Cookie 是否有效
 * @param cookieData 解密后的 Cookie 数据
 * @param maxAge Cookie 最大有效期（毫秒），默认 7 天
 */
export function validateCookie(cookieData: CookieData, maxAge: number = 7 * 24 * 60 * 60 * 1000): boolean {
  // 1. 验证 sessionId 是否匹配当前服务器会话
  if (cookieData.sessionId !== SERVER_SESSION_ID) {
    console.log('Cookie session ID mismatch (server may have restarted)');
    return false;
  }
  
  // 2. 验证时间戳是否在有效期内
  const now = Date.now();
  const age = now - cookieData.timestamp;
  
  if (age < 0) {
    console.error('Cookie timestamp is in the future');
    return false;
  }
  
  if (age > maxAge) {
    console.log('Cookie has expired');
    return false;
  }
  
  return true;
}

/**
 * 创建新的 Cookie 数据
 */
export function createCookieData(username: string, passwordHash: string): CookieData {
  return {
    username,
    passwordHash,
    sessionId: getServerSessionId(),
    timestamp: Date.now(),
  };
}
