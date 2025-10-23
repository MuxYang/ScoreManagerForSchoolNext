import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 允许发送和接收 Cookie
});

// 获取一次性token的函数
async function getOneTimeToken(): Promise<string> {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/token`);
    return response.data.token;
  } catch (error) {
    console.error('获取一次性token失败:', error);
    throw error;
  }
}

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
        console.error('无法获取请求token:', error);
        // 继续请求，让后端返回403
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

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除 localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
      // 跳转到登录页
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
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
  
  resetPassword: (username: string, securityAnswer: string, newPassword: string, newSecurityQuestion: string) =>
    apiClient.post('/auth/reset-password', { username, securityAnswer, newPassword, newSecurityQuestion }),
  
  changePassword: (userId: number, oldPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { userId, oldPassword, newPassword }),
  
  firstLoginSetup: (data: { userId: number; newPassword: string; securityQuestion: string; securityAnswer: string }) =>
    apiClient.post('/auth/first-login-setup', data),
  
  logout: () => apiClient.post('/auth/logout'),
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
  exportScoresExcel: () => 
    apiClient.get('/import-export/scores/excel', { responseType: 'blob' }),
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

export default apiClient;
