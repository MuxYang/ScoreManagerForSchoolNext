/**
 * 输入验证工具
 * 提供用户名、密码、文本输入的安全验证功能
 */

/**
 * 验证用户名格式
 * 只允许英文字母和数字
 * @param username 用户名
 * @returns 验证结果
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: '用户名不能为空' };
  }

  if (username.length < 3) {
    return { valid: false, error: '用户名长度至少为3个字符' };
  }

  if (username.length > 20) {
    return { valid: false, error: '用户名长度不能超过20个字符' };
  }

  // 只允许英文字母和数字
  const usernamePattern = /^[a-zA-Z0-9]+$/;
  if (!usernamePattern.test(username)) {
    return { valid: false, error: '用户名只能包含英文字母和数字' };
  }

  return { valid: true };
}

/**
 * 验证密码格式
 * 只允许英文、数字和特定符号（不包括引号、大括号、冒号和中文符号）
 * @param password 密码
 * @returns 验证结果
 */
export function validatePasswordFormat(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: '密码不能为空' };
  }

  if (password.length < 8) {
    return { valid: false, error: '密码长度至少为8个字符' };
  }

  if (password.length > 50) {
    return { valid: false, error: '密码长度不能超过50个字符' };
  }

  // 允许的字符：英文字母、数字、以下符号（不包括引号"'、大括号{}、冒号:和中文符号）
  // 允许的符号: ! @ # $ % ^ & * ( ) _ + - = [ ] ; ' \ | , . < > / ?
  const passwordPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\];'\\|,.<>\/?]+$/;
  if (!passwordPattern.test(password)) {
    return { 
      valid: false, 
      error: '密码只能包含英文字母、数字和特定符号（不允许引号"\'、大括号{}、冒号:和中文符号）' 
    };
  }

  // 检查是否包含被禁止的字符
  const forbiddenChars = /["'`{}:：；，。！]/;
  if (forbiddenChars.test(password)) {
    return { 
      valid: false, 
      error: '密码不能包含引号、大括号、冒号或中文符号' 
    };
  }

  return { valid: true };
}

/**
 * 检测 SQL 注入攻击
 * 优化检测逻辑，减少误判，支持中文内容
 * @param input 用户输入
 * @returns 检测结果
 */
export function detectSQLInjection(input: string): { safe: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: true };
  }

  // 如果输入主要是中文，放宽检测（中文内容不太可能是 SQL 注入）
  const chineseCharCount = (input.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalLength = input.length;
  const chineseRatio = chineseCharCount / totalLength;
  
  // 如果中文字符占比超过 50%，只检查最严重的模式
  if (chineseRatio > 0.5) {
    const severePatterns = [
      /;\s*(DROP|DELETE|TRUNCATE)\s+/gi,  // 危险操作
      /UNION\s+SELECT/gi,  // UNION 注入
      /'\s*OR\s*'.*'.*=/gi,  // OR 注入
    ];
    
    for (const pattern of severePatterns) {
      if (pattern.test(input)) {
        return { 
          safe: false, 
          reason: '检测到疑似 SQL 注入攻击模式' 
        };
      }
    }
    return { safe: true };
  }

  // 对非中文内容进行更严格的检测
  // 但要求有明确的上下文，避免误判
  const sqlPatterns = [
    /(\bSELECT\b.*\bFROM\b)/gi,  // SELECT ... FROM（完整模式）
    /(\bINSERT\b.*\bINTO\b)/gi,  // INSERT ... INTO
    /(\bUPDATE\b.*\bSET\b)/gi,  // UPDATE ... SET
    /(\bDELETE\b.*\bFROM\b)/gi,  // DELETE ... FROM
    /(;\s*DROP\b)/gi,  // ; DROP
    /(;\s*TRUNCATE\b)/gi,  // ; TRUNCATE
    /(\bUNION\b.*\bSELECT\b)/gi,  // UNION SELECT
    /('\s*OR\s*'[^']*'[^']*=)/gi,  // ' OR '1'='1
    /("\s*OR\s*"[^"]*"[^"]*=)/gi,  // " OR "1"="1
    /(--\s*$)/gm,  // SQL 注释在行尾
    /(\/\*.*\*\/)/g,  // /* */ 注释
    /(\bEXEC\b|\bEXECUTE\b).*\(/gi,  // EXEC( 或 EXECUTE(
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return { 
        safe: false, 
        reason: '检测到疑似 SQL 注入攻击模式' 
      };
    }
  }

  return { safe: true };
}

/**
 * 检测 XSS 攻击
 * 使用字符串匹配代替复杂正则，防止 ReDoS
 * @param input 用户输入
 * @returns 检测结果
 */
export function detectXSS(input: string): { safe: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: true };
  }

  const lowerInput = input.toLowerCase();
  
  // 使用简单字符串匹配，避免复杂正则导致的 ReDoS
  const dangerousPatterns = [
    '<script',
    '</script>',
    '<iframe',
    '</iframe>',
    'javascript:',
    '<embed',
    '<object',
    'onerror=',
    'onclick=',
    'onload=',
    'onmouseover=',
    'onfocus=',
    'onblur=',
    '<svg',
    'data:text/html',
  ];

  for (const pattern of dangerousPatterns) {
    if (lowerInput.includes(pattern)) {
      return { 
        safe: false, 
        reason: '检测到疑似 XSS 攻击模式' 
      };
    }
  }
  
  // 检查事件处理器（限制长度以防止 ReDoS）
  // 只检查前 1000 个字符
  const checkString = input.substring(0, 1000);
  // 使用更安全的正则：限制 \w 的重复次数
  if (/on\w{1,20}\s*=/i.test(checkString)) {
    return { 
      safe: false, 
      reason: '检测到疑似 XSS 攻击模式（事件处理器）' 
    };
  }

  return { safe: true };
}

/**
 * 检测路径遍历攻击
 * @param input 用户输入
 * @returns 检测结果
 */
export function detectPathTraversal(input: string): { safe: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: true };
  }

  // 路径遍历攻击模式
  const pathPatterns = [
    /\.\.[\/\\]/g,  // ../
    /%2e%2e[\/\\]/gi,  // URL 编码的 ../
    /\.\.[%]?[0-9a-f]{2}/gi,  // 其他编码方式
  ];

  for (const pattern of pathPatterns) {
    if (pattern.test(input)) {
      return { 
        safe: false, 
        reason: '检测到疑似路径遍历攻击' 
      };
    }
  }

  return { safe: true };
}

/**
 * 综合安全检查
 * @param input 用户输入
 * @param options 检查选项
 * @returns 检查结果
 */
export function validateInput(
  input: string, 
  options: {
    checkSQL?: boolean;
    checkXSS?: boolean;
    checkPath?: boolean;
    maxLength?: number;
  } = {}
): { valid: boolean; error?: string } {
  const {
    checkSQL = true,
    checkXSS = true,
    checkPath = true,
    maxLength = 1000
  } = options;

  if (!input || typeof input !== 'string') {
    return { valid: false, error: '输入不能为空' };
  }

  // 长度检查
  if (input.length > maxLength) {
    return { 
      valid: false, 
      error: `输入长度不能超过 ${maxLength} 个字符` 
    };
  }

  // SQL 注入检查
  if (checkSQL) {
    const sqlCheck = detectSQLInjection(input);
    if (!sqlCheck.safe) {
      return { valid: false, error: sqlCheck.reason };
    }
  }

  // XSS 检查
  if (checkXSS) {
    const xssCheck = detectXSS(input);
    if (!xssCheck.safe) {
      return { valid: false, error: xssCheck.reason };
    }
  }

  // 路径遍历检查
  if (checkPath) {
    const pathCheck = detectPathTraversal(input);
    if (!pathCheck.safe) {
      return { valid: false, error: pathCheck.reason };
    }
  }

  return { valid: true };
}

/**
 * 清理输入内容（转义特殊字符）
 * @param input 用户输入
 * @returns 清理后的内容
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // HTML 实体编码
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 日志脱敏：对敏感信息进行哈希或截断
 * @param input 原始输入
 * @param options 脱敏选项
 * @returns 脱敏后的信息
 */
export function sanitizeForLogging(
  input: string,
  options: {
    type?: 'hash' | 'truncate' | 'mask';
    maxLength?: number;
  } = {}
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const { type = 'truncate', maxLength = 20 } = options;

  switch (type) {
    case 'hash':
      // 返回前8位的哈希值（用于标识但不泄露原文）
      const crypto = require('crypto');
      return crypto
        .createHash('sha256')
        .update(input)
        .digest('hex')
        .substring(0, 8);

    case 'mask':
      // 掩码显示（显示前后各2个字符）
      if (input.length <= 4) {
        return '****';
      }
      return `${input.substring(0, 2)}****${input.substring(input.length - 2)}`;

    case 'truncate':
    default:
      // 截断并标记长度
      if (input.length <= maxLength) {
        return input;
      }
      return `${input.substring(0, maxLength)}...(${input.length}字符)`;
  }
}

/**
 * 创建安全的日志对象（自动脱敏敏感字段）
 * @param data 原始数据对象
 * @returns 脱敏后的日志对象
 */
export function createSafeLogObject(data: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'passwordHash', 'securityAnswer', 'token', 'cookie'];
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

    if (isSensitive && typeof value === 'string') {
      result[key] = sanitizeForLogging(value, { type: 'hash' });
    } else if (typeof value === 'string' && value.length > 100) {
      // 长字符串截断
      result[key] = sanitizeForLogging(value, { maxLength: 50 });
    } else {
      result[key] = value;
    }
  }

  return result;
}
