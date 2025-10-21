import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * 派生加密密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * 获取用户配置加密密钥（使用环境变量或默认值）
 */
function getConfigSecret(): string {
  return process.env.USER_CONFIG_SECRET || process.env.COOKIE_SECRET || 'default-config-secret-change-in-production';
}

/**
 * 加密用户配置
 */
export function encryptUserConfig(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    const secret = getConfigSecret();
    
    // 生成随机盐和IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(secret, salt);
    
    // 加密
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(jsonString, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // 组合: salt + iv + authTag + encrypted
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString('base64');
  } catch (error) {
    console.error('加密用户配置失败:', error);
    throw new Error('配置加密失败');
  }
}

/**
 * 解密用户配置
 */
export function decryptUserConfig(encrypted: string): any {
  try {
    const secret = getConfigSecret();
    const buffer = Buffer.from(encrypted, 'base64');
    
    // 提取各部分
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    const key = deriveKey(secret, salt);
    
    // 解密
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    console.error('解密用户配置失败:', error);
    throw new Error('配置解密失败');
  }
}

/**
 * 验证用户配置 cookie
 */
export function validateUserConfig(encrypted: string): boolean {
  try {
    decryptUserConfig(encrypted);
    return true;
  } catch {
    return false;
  }
}
