// 前端输入验证工具函数
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// 输入验证规则
const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    errorMessage: '用户名只能包含字母、数字和下划线，长度3-20位'
  },
  password: {
    minLength: 8,
    maxLength: 128,
    pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':"\\,.<>\/?`~]+$/,
    errorMessage: '密码只能包含字母、数字和特殊字符，长度8-128位'
  },
  securityQuestion: {
    minLength: 5,
    maxLength: 200,
    pattern: /^[^<>'"&]+$/,
    errorMessage: '密保问题不能包含特殊字符 < > \' " &'
  },
  securityAnswer: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[^<>'"&]+$/,
    errorMessage: '密保答案不能包含特殊字符 < > \' " &'
  },
  general: {
    maxLength: 500,
    pattern: /^[^<>'"&]+$/,
    errorMessage: '输入不能包含特殊字符 < > \' " &'
  }
};

// 基础输入验证函数
export function validateInput(
  input: string, 
  type: keyof typeof VALIDATION_RULES = 'general'
): ValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '输入不能为空' };
  }

  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return { valid: false, error: '输入不能为空' };
  }

  const rules = VALIDATION_RULES[type];
  
  // 长度验证
  if (trimmedInput.length < rules.minLength) {
    return { valid: false, error: `输入长度至少为${rules.minLength}位` };
  }
  
  if (trimmedInput.length > rules.maxLength) {
    return { valid: false, error: `输入长度不能超过${rules.maxLength}位` };
  }

  // 模式验证
  if (!rules.pattern.test(trimmedInput)) {
    return { valid: false, error: rules.errorMessage };
  }

  return { valid: true };
}

// 用户名验证
export function validateUsername(username: string): ValidationResult {
  return validateInput(username, 'username');
}

// 密码验证
export function validatePassword(password: string): ValidationResult {
  return validateInput(password, 'password');
}

// 密保问题验证
export function validateSecurityQuestion(question: string): ValidationResult {
  return validateInput(question, 'securityQuestion');
}

// 密保答案验证
export function validateSecurityAnswer(answer: string): ValidationResult {
  return validateInput(answer, 'securityAnswer');
}

// 通用文本验证
export function validateGeneralText(text: string): ValidationResult {
  return validateInput(text, 'general');
}

// 密码强度验证
export function validatePasswordStrength(password: string): ValidationResult {
  const basicValidation = validatePassword(password);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  // 检查密码强度
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{}|;':"\\,.<>\/?`~]/.test(password);

  const typeCount = [hasUpperCase, hasLowerCase, hasNumber, hasSymbol].filter(Boolean).length;

  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, error: '密码必须包含大写字母和小写字母' };
  }

  if (!hasNumber && !hasSymbol) {
    return { valid: false, error: '密码必须包含数字或特殊字符' };
  }

  if (typeCount < 3) {
    return { valid: false, error: '密码必须包含大写字母、小写字母、数字、特殊字符中的至少三种' };
  }

  return { valid: true };
}

// 输入清理函数（移除危险字符）
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>'"&]/g, '') // 移除危险字符
    .substring(0, 500); // 限制长度
}

// 实时输入验证Hook
export function useInputValidation(type: keyof typeof VALIDATION_RULES = 'general') {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState(false);

  const validate = React.useCallback((inputValue: string) => {
    const result = validateInput(inputValue, type);
    setError(result.error || null);
    setIsValid(result.valid);
    return result.valid;
  }, [type]);

  const handleChange = React.useCallback((newValue: string) => {
    setValue(newValue);
    validate(newValue);
  }, [validate]);

  return {
    value,
    setValue,
    error,
    isValid,
    validate,
    handleChange
  };
}
