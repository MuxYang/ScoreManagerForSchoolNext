import axios from 'axios';

// 根据环境选择 API 基础 URL
const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '/api'; // 开发模式使用代理
  }
  
  // 生产模式：动态构建API URL
  const hostname = window.location.hostname;
  const port = '3000';
  const protocol = window.location.protocol;
  
  return `${protocol}//${hostname}:${port}/api`;
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 允许发送和接收 Cookie
});

// 令牌缓存机制
let tokenCache: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_LIFETIME = 8000; // 令牌有效期 8 秒（后端是 10 秒，留 2 秒余量）

// 获取一次性token的函数（带缓存）
async function getOneTimeToken(): Promise<string> {
  const now = Date.now();
  
  // 如果缓存的令牌仍然有效，直接返回
  if (tokenCache && now < tokenExpiry) {
    return tokenCache as string;
  }
  
  try {
    // 使用静默的 axios 实例（不触发拦截器）
    const response = await axios.get(`${API_BASE_URL}/auth/token`, {
      withCredentials: true,
      // 添加标记，避免在日志中显示（Express 会自动转为小写）
      headers: {
        'x-silent-request': 'true'
      }
    });
    
    tokenCache = response.data.token;
    tokenExpiry = now + TOKEN_LIFETIME;
    
    return tokenCache as string;
  } catch (error) {
    // 静默失败，不在控制台显示错误
    tokenCache = null;
    tokenExpiry = 0;
    throw error;
  }
}

// 导出获取令牌的函数，供其他模块使用
export { getOneTimeToken };

// 请求拦截器 - 自动添加一次性token和备用身份验证
apiClient.interceptors.request.use(
  async (config) => {
    // 不需要token的公开接口列表
    const publicPaths = [
      '/auth/token',
      '/auth/login',
      '/auth/verify-cookie',
      '/auth/security-question',
      '/auth/reset-password'
    ];
    
    // 检查是否为公开接口
    const isPublicPath = publicPaths.some(path => config.url?.includes(path));
    
    // 对于非公开接口，获取并添加一次性token
    if (!isPublicPath) {
      try {
        const oneTimeToken = await getOneTimeToken();
        config.headers['x-request-token'] = oneTimeToken;
      } catch (error) {
        // 静默失败，继续请求，让后端返回403
      }
    }
    
    // Cookie 中的 token 会自动发送，这里作为备用方案
    // 如果 Cookie 失效，从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token && !document.cookie.includes('token=')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 用于检测服务器重启的标志
let serverWasDown = false;
let isRefreshing = false;

// 服务器健康检查函数（使用 /ping 接口，不记录日志）
async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2秒超时
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 定期检查服务器健康的函数
let healthCheckInterval: number | null = null;

function startHealthCheck() {
  if (healthCheckInterval) return; // 避免重复启动
  
  console.log('⏱️ 开始轮询服务器状态...');
  
  healthCheckInterval = window.setInterval(async () => {
    const isHealthy = await checkServerHealth();
    
    if (isHealthy && serverWasDown && !isRefreshing) {
      // 服务器恢复了
      isRefreshing = true;
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
      console.log('🔄 服务器已恢复，自动刷新页面...');
      window.location.reload();
    }
  }, 3000); // 每3秒检查一次
}

function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => {
    // 如果服务器恢复，停止健康检查
    if (serverWasDown) {
      serverWasDown = false;
      stopHealthCheck();
    }
    return response;
  },
  (error) => {
    // 处理认证错误
    if (error.response?.status === 401) {
      // 清除 localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
      localStorage.removeItem('encryptedCookie');
      // 跳转到登录页
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // 处理网络错误和后端服务不可用
    if (!error.response) {
      // 网络错误、连接超时、后端服务不可用等情况
      if (error.code === 'NETWORK_ERROR' || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('timeout') ||
          error.message?.includes('ERR_CONNECTION_REFUSED')) {
        
        console.log('⚠️ 检测到服务器连接中断，开始监控服务器状态');
        
        // 标记服务器不可用，但不清除认证信息，也不跳转
        serverWasDown = true;
        
        // 开始定期检查服务器健康（使用静默的 /ping 接口）
        startHealthCheck();
        
        // 不再自动退出登录和跳转，等待服务器恢复后自动刷新
        // 这样用户的登录状态和当前页面都会被保留
      }
    }
    
    return Promise.reject(error);
  }
);

// 认证 API
export const authAPI = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  
  // Cookie 自动登录验证
  verifyCookie: (encryptedCookie: string) =>
    apiClient.post('/auth/verify-cookie', { encryptedCookie }),
  
  // 注册功能已禁用 - 系统只允许单个管理员账户
  // register: (username: string, password: string, securityQuestion: string, securityAnswer: string) =>
  //   apiClient.post('/auth/register', { username, password, securityQuestion, securityAnswer }),
  
  getSecurityQuestion: (username: string) =>
    apiClient.post('/auth/security-question', { username }),
  
  verifySecurityAnswer: (username: string, securityAnswer: string) =>
    apiClient.post('/auth/verify-security-answer', { username, securityAnswer }),
  
  resetPassword: (username: string, securityAnswer: string, newPassword: string, newSecurityQuestion: string, newSecurityAnswer: string) =>
    apiClient.post('/auth/reset-password', { username, securityAnswer, newPassword, newSecurityQuestion, newSecurityAnswer }),
  
  changePassword: (userId: number, oldPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { userId, oldPassword, newPassword }),
  
  firstLoginSetup: (data: { userId: number; newPassword: string; securityQuestion: string; securityAnswer: string }) =>
    apiClient.post('/auth/first-login-setup', data),
  
  logout: () => apiClient.post('/auth/logout'),
  
  // 用户管理 API (仅管理员)
  getUsers: () => apiClient.get('/auth/users'),
  
  createUser: (username: string, password: string, mustChangePassword: boolean = true) =>
    apiClient.post('/auth/users', { username, password, mustChangePassword }),
  
  resetUserPassword: (userId: number, newPassword: string) =>
    apiClient.post(`/auth/users/${userId}/reset-password`, { newPassword }),
  
  deleteUser: (userId: number) => apiClient.delete(`/auth/users/${userId}`),
  
  generatePassword: (length?: number) => {
    const params = length ? { length } : {};
    return apiClient.get('/auth/generate-password', { params });
  },
};

// 学生 API
export const studentAPI = {
  getAll: () => apiClient.get('/students'),
  getById: (id: number) => apiClient.get(`/students/${id}`),
  create: (data: { studentId: string; name: string; studentClass: string }) =>
    apiClient.post('/students', data),
  update: (id: number, data: { studentId: string; name: string; studentClass: string }) =>
    apiClient.put(`/students/${id}`, data),
  delete: (id: number) => apiClient.delete(`/students/${id}`),
  batchImport: (students: any[]) => apiClient.post('/students/batch', { students }),
  exportRecords: (startDate: string, endDate: string) =>
    apiClient.post('/students/export-records', { startDate, endDate }, { responseType: 'blob' }),
};

// 教师 API
export const teacherAPI = {
  getAll: () => apiClient.get('/teachers'),
  getById: (id: number) => apiClient.get(`/teachers/${id}`),
  create: (data: { name: string; subject: string; phone?: string; email?: string }) =>
    apiClient.post('/teachers', data),
  update: (id: number, data: { name: string; subject: string; phone?: string; email?: string }) =>
    apiClient.put(`/teachers/${id}`, data),
  delete: (id: number) => apiClient.delete(`/teachers/${id}`),
  exportRecords: (startDate: string, endDate: string) =>
    apiClient.post('/teachers/export-records', { startDate, endDate }, { responseType: 'blob' }),
};

// 积分 API
export const scoreAPI = {
  getAll: (params?: any) => apiClient.get('/scores', { params }),
  getStatistics: (studentId: number) => apiClient.get(`/scores/statistics/${studentId}`),
  getDashboardStats: () => apiClient.get('/scores/dashboard-stats'),
  create: (data: any) => apiClient.post('/scores', data),
  update: (id: number, data: any) => apiClient.put(`/scores/${id}`, data),
  delete: (id: number) => apiClient.delete(`/scores/${id}`),
  batchImport: (scores: any[]) => apiClient.post('/scores/batch', { scores }),
  checkDuplicates: (records: any[]) => apiClient.post('/scores/check-duplicates', { records }),
  aiImport: (records: any[]) => apiClient.post('/scores/ai-import', { records }),
  // 违纪记录导入（包含教师检测）
  importRecords: (records: any[]) => apiClient.post('/scores/import-records', { records }),
  processTeacherRecords: (records: any[], action: 'teacher' | 'student' | 'discard') =>
    apiClient.post('/scores/import-records/process-teachers', { records, action }),
  getPending: (params?: { status?: string; limit?: number; offset?: number }) => 
    apiClient.get('/scores/pending', { params }),
  resolvePending: (id: number, studentId: number) => 
    apiClient.post(`/scores/pending/${id}/resolve`, { studentId }),
  rejectPending: (id: number) => 
    apiClient.post(`/scores/pending/${id}/reject`),
};

// 备份 API
export const backupAPI = {
  create: () => apiClient.post('/backup/create'),
  getList: () => apiClient.get('/backup/list'),
  restore: (filename: string) => apiClient.post(`/backup/restore/${filename}`),
  delete: (filename: string) => apiClient.delete(`/backup/${filename}`),
  getDatabaseStats: () => apiClient.get('/backup/database-stats'),
  optimizeDatabase: () => apiClient.post('/backup/optimize'),
};

// 导入导出 API
export const importExportAPI = {
  exportStudentsExcel: () => 
    apiClient.get('/import-export/students/excel', { responseType: 'blob' }),
  exportScoresExcel: (params?: { startDate?: string; endDate?: string }) => 
    apiClient.get('/import-export/scores/excel', { 
      params,
      responseType: 'blob' 
    }),
  // 上传并解析文件
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/import-export/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  parseText: (text: string, dataType: string) =>
    apiClient.post('/import-export/parse-text', { text, dataType }),
  // 批量导入学生
  importStudents: (data: any[], mapping: any) =>
    apiClient.post('/import-export/students/import', { data, mapping }),
  // 批量导入教师
  importTeachers: (data: any[], mapping: any) =>
    apiClient.post('/import-export/teachers/import', { data, mapping }),
};

// 用户配置 API
export const userConfigAPI = {
  save: (config: any) => apiClient.post('/user-config/save', { config }),
  get: () => apiClient.get('/user-config/get'),
  clear: () => apiClient.post('/user-config/clear'),
};

// 听课记录 API
export const lectureRecordsAPI = {
  getAll: (filters?: {
    startDate?: string;
    endDate?: string;
    observerName?: string;
    teachingName?: string;
    className?: string;
  }) => apiClient.get('/lecture-records', { params: filters }),
  
  getById: (id: number) => apiClient.get(`/lecture-records/${id}`),
  
  create: (data: {
    observerTeacherName: string;
    teachingTeacherName: string;
    className: string;
    date?: string;
    period?: number;
    notes?: string;
  }) => apiClient.post('/lecture-records', data),
  
  update: (id: number, data: {
    observerTeacherName: string;
    teachingTeacherName: string;
    className: string;
    date: string;
    period?: number;
    notes?: string;
  }) => apiClient.put(`/lecture-records/${id}`, data),
  
  delete: (id: number) => apiClient.delete(`/lecture-records/${id}`),
  
  batchCreate: (records: any[]) => 
    apiClient.post('/lecture-records/batch', { records }),
  
  export: async (startDate?: string, endDate?: string) => {
    const response = await apiClient.post('/lecture-records/export', 
      { startDate, endDate },
      { responseType: 'blob' }
    );
    return response;
  },
  
  getStatistics: () => apiClient.get('/lecture-records/statistics'),
};

// 加班记录 API
export const overtimeRecordsAPI = {
  getAll: (params?: { startDate?: string; endDate?: string }) => 
    apiClient.get('/overtime', { params }),
  
  getGrouped: () => apiClient.get('/overtime/grouped'),
  
  getDetail: (position: string, teacherName: string) => 
    apiClient.get('/overtime/detail', { 
      params: { position, teacher_name: teacherName } 
    }),

  getDetailById: (teacherId: number) =>
    apiClient.get('/overtime/detail-by-id', { params: { teacher_id: teacherId } }),
  
  importNamelist: (data: FormData | { text: string }) => {
    if (data instanceof FormData) {
      return apiClient.post('/overtime/import-namelist', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.post('/overtime/import-namelist', data);
  },
  
  importData: (data: FormData | { text: string; ai?: boolean }) => {
    if (data instanceof FormData) {
      return apiClient.post('/overtime/import-data', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.post('/overtime/import-data', data);
  },
  
  importAiParsed: (data: { data: any[], defaultTimePoint?: string }) => 
    apiClient.post('/overtime/import-ai-parsed', data),
  
  export: async (params: { date: string }) => {
    const response = await apiClient.post('/overtime/export', params, { responseType: 'blob' });
    return response;
  },
  
  getTimePoints: () => apiClient.get('/overtime/time-points'),
  
  addTimePoint: (timePoint: string) => apiClient.post('/overtime/time-points', { time_point: timePoint }),
  
  deleteTimePoint: (timePoint: string) => apiClient.delete(`/overtime/time-points/${encodeURIComponent(timePoint)}`),
};

export default apiClient;
