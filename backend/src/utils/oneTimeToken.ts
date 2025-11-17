import crypto from 'crypto';
import logger from './logger';

// 一次性token存储（内存存储，重启后清空）
// 结构: { token: { createdAt: timestamp, used: boolean } }
const tokenStore = new Map<string, { createdAt: number; used: boolean }>();

// Token配置
const TOKEN_LENGTH = 128; // 128字符长度
const TOKEN_EXPIRY_MS = 10 * 1000; // 10秒过期（支持并发请求和缓存）
const CLEANUP_INTERVAL_MS = 30 * 1000; // 每30秒清理一次过期token

/**
 * 生成一个新的一次性token（128位）
 */
export function generateOneTimeToken(): string {
  // 生成64字节随机数据（转换为hex后为128字符）
  const token = crypto.randomBytes(64).toString('hex');
  
  // 存储token
  tokenStore.set(token, {
    createdAt: Date.now(),
    used: false
  });
  
  logger.debug('一次性token已生成', { 
    tokenPrefix: token.substring(0, 8),
    totalTokens: tokenStore.size 
  });
  
  return token;
}

/**
 * 验证并消费token（在有效期内可重复使用，避免并发请求问题）
 * @param token - 要验证的token
 * @returns true if valid, false otherwise
 */
export function validateAndConsumeToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string' || token.length !== TOKEN_LENGTH) {
    logger.warn('Invalid token format');
    return false;
  }
  
  const tokenData = tokenStore.get(token);
  
  if (!tokenData) {
    logger.warn('Token does not exist or has expired', { 
      tokenPrefix: token.substring(0, 8) 
    });
    return false;
  }
  
  // 检查是否过期
  const age = Date.now() - tokenData.createdAt;
  if (age > TOKEN_EXPIRY_MS) {
    logger.warn('Token expired', { 
      tokenPrefix: token.substring(0, 8),
      ageMs: age 
    });
    tokenStore.delete(token);
    return false;
  }
  
  // 标记为已使用（但不删除，允许在有效期内重复使用）
  // 这样可以支持并发请求使用同一个令牌
  if (!tokenData.used) {
    tokenData.used = true;
    logger.debug('Token首次使用', { 
      tokenPrefix: token.substring(0, 8),
      remainingTokens: tokenStore.size 
    });
  }
  
  return true;
}

/**
 * 清理过期的token
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.createdAt > TOKEN_EXPIRY_MS) {
      tokenStore.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.debug('清理过期token', { 
      cleanedCount,
      remainingTokens: tokenStore.size 
    });
  }
}

/**
 * 获取当前token统计信息（仅用于监控）
 */
export function getTokenStats() {
  return {
    totalTokens: tokenStore.size,
    oldestTokenAge: Math.max(...Array.from(tokenStore.values()).map(t => Date.now() - t.createdAt))
  };
}

// 定期清理过期token
setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);

logger.info('One-time token system initialized', { 
  tokenLength: TOKEN_LENGTH,
  expiryMs: TOKEN_EXPIRY_MS 
});


