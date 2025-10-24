import crypto from 'crypto';
import fs from 'fs';
import logger from './logger';

/**
 * 数据库加密工具
 * 使用用户密码哈希作为密钥派生的一部分来加密/解密数据库文件
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * 从密码哈希派生数据库加密密钥
 */
function deriveDatabaseKey(passwordHash: string, salt: Buffer): Buffer {
  // 使用密码哈希 + 服务器密钥生成最终密钥
  const serverKey = process.env.DATABASE_ENCRYPTION_KEY || 'default-db-key-change-in-production';
  const combined = `${passwordHash}:${serverKey}`;
  return crypto.pbkdf2Sync(combined, salt, 100000, 32, 'sha256');
}

/**
 * 加密数据库文件
 * @param dbPath 数据库文件路径
 * @param passwordHash 用户密码哈希
 * @returns 加密后的文件路径
 */
export async function encryptDatabase(dbPath: string, passwordHash: string): Promise<string> {
  try {
    logger.info('Starting database encryption', { dbPath });
    
    // 读取原始数据库文件
    if (!fs.existsSync(dbPath)) {
      throw new Error(`数据库文件不存在: ${dbPath}`);
    }
    
    const dbData = fs.readFileSync(dbPath);
    
    // 生成随机盐和 IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 派生加密密钥
    const key = deriveDatabaseKey(passwordHash, salt);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // 加密数据
    const encrypted = Buffer.concat([
      cipher.update(dbData),
      cipher.final()
    ]);
    
    // 获取认证标签
    const authTag = cipher.getAuthTag();
    
    // 组合：盐 + IV + 认证标签 + 加密数据
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);
    
    // 保存加密文件
    const encryptedPath = `${dbPath}.encrypted`;
    fs.writeFileSync(encryptedPath, combined);
    
    logger.info('Database encryption completed', { 
      originalSize: dbData.length,
      encryptedSize: combined.length,
      encryptedPath 
    });
    
    return encryptedPath;
  } catch (error) {
    logger.error('Database encryption failed', { error, dbPath });
    throw error;
  }
}

/**
 * 解密数据库文件
 * @param encryptedPath 加密的数据库文件路径
 * @param passwordHash 用户密码哈希
 * @param outputPath 解密后的输出路径
 */
export async function decryptDatabase(
  encryptedPath: string, 
  passwordHash: string,
  outputPath?: string
): Promise<string> {
  try {
    logger.info('Starting database decryption', { encryptedPath });
    
    // 读取加密文件
    if (!fs.existsSync(encryptedPath)) {
      throw new Error(`加密文件不存在: ${encryptedPath}`);
    }
    
    const combined = fs.readFileSync(encryptedPath);
    
    // 验证文件大小
    if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('加密文件格式无效：文件太小');
    }
    
    // 分离各个部分
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH, 
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // 派生解密密钥
    const key = deriveDatabaseKey(passwordHash, salt);
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // 解密数据
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // 保存解密文件
    const decryptedPath = outputPath || encryptedPath.replace('.encrypted', '');
    fs.writeFileSync(decryptedPath, decrypted);
    
    logger.info('Database decryption completed', { 
      encryptedSize: combined.length,
      decryptedSize: decrypted.length,
      decryptedPath 
    });
    
    return decryptedPath;
  } catch (error: any) {
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      logger.error('Database decryption failed: Wrong password or corrupted file', { encryptedPath });
      throw new Error('密码错误或数据库文件已损坏');
    }
    logger.error('Database decryption failed', { error: error.message, encryptedPath });
    throw error;
  }
}

/**
 * 检查数据库是否已加密
 */
export function isDatabaseEncrypted(dbPath: string): boolean {
  return fs.existsSync(`${dbPath}.encrypted`);
}

/**
 * 在应用关闭时加密数据库
 */
export async function encryptDatabaseOnShutdown(
  dbPath: string, 
  passwordHash: string
): Promise<void> {
  try {
    if (!passwordHash) {
      logger.warn('No password hash, skipping database encryption');
      return;
    }
    
    // 加密数据库
    await encryptDatabase(dbPath, passwordHash);
    
    // 删除明文数据库（可选，谨慎操作）
    // fs.unlinkSync(dbPath);
    // logger.info('Deleted plaintext database file', { dbPath });
    
  } catch (error) {
    logger.error('Failed to encrypt database on shutdown', { error, dbPath });
  }
}

/**
 * 在应用启动时解密数据库
 */
export async function decryptDatabaseOnStartup(
  dbPath: string,
  passwordHash: string
): Promise<void> {
  try {
    const encryptedPath = `${dbPath}.encrypted`;
    
    if (!fs.existsSync(encryptedPath)) {
      logger.debug('未找到加密数据库，使用明文数据库', { dbPath });
      return;
    }
    
    if (!passwordHash) {
      logger.error('Need password hash to decrypt database');
      throw new Error('无法解密数据库：缺少密码');
    }
    
    // 解密数据库
    await decryptDatabase(encryptedPath, passwordHash, dbPath);
    
    logger.info('Database decryption completed，应用可以启动', { dbPath });
    
  } catch (error) {
    logger.error('Failed to decrypt database on startup', { error, dbPath });
    throw error;
  }
}

export default {
  encryptDatabase,
  decryptDatabase,
  isDatabaseEncrypted,
  encryptDatabaseOnShutdown,
  decryptDatabaseOnStartup
};
