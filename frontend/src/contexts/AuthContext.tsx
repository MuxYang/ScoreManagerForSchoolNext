import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: number;
  username: string;
  mustChangePassword?: boolean;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean; // 添加加载状态
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 超时时间：5 分钟（毫秒）
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初始加载状态
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriedCookieAuth = useRef(false); // 防止重复尝试
  const networkCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清除所有认证信息
  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('encryptedCookie');
    localStorage.removeItem('lastActivity');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (networkCheckIntervalRef.current) {
      clearInterval(networkCheckIntervalRef.current);
      networkCheckIntervalRef.current = null;
    }
    
    // 强制跳转到登录页面
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  // 重置超时计时器
  const resetTimeout = useCallback(() => {
    // 清除旧的计时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 更新最后活动时间
    const now = Date.now();
    localStorage.setItem('lastActivity', String(now));

    // 设置新的计时器
    timeoutRef.current = setTimeout(() => {
      console.log('用户无操作超过 5 分钟，自动登出');
      clearAuth();
      // 如果在登录页面则不需要跳转
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, INACTIVITY_TIMEOUT);
  }, [clearAuth]);

  // 检查是否超时
  const checkTimeout = useCallback(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity) return false;

    const now = Date.now();
    const timeSinceLastActivity = now - parseInt(lastActivity, 10);

    return timeSinceLastActivity > INACTIVITY_TIMEOUT;
  }, []);

  // 检查后端服务连接状态
  const checkBackendConnection = useCallback(async () => {
    if (!token) return;

    try {
      // 使用一个简单的健康检查接口
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒超时
      });
      
      if (!response.ok) {
        throw new Error(`后端服务响应异常: ${response.status}`);
      }
    } catch (error: any) {
      console.error('后端服务连接检查失败:', error.message);
      
      // 如果是网络错误或连接超时，自动退出登录
      if (error.name === 'AbortError' || 
          error.message?.includes('timeout') ||
          error.message?.includes('Network Error') ||
          error.message?.includes('ERR_CONNECTION_REFUSED')) {
        
        console.log('检测到后端服务不可用，自动退出登录');
        clearAuth();
        
        // 跳转到登录页
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
  }, [token, clearAuth]);

  // 启动网络连接检测
  const startNetworkCheck = useCallback(() => {
    if (networkCheckIntervalRef.current) {
      clearInterval(networkCheckIntervalRef.current);
    }
    
    // 每30秒检查一次后端连接
    networkCheckIntervalRef.current = setInterval(checkBackendConnection, 30000);
  }, [checkBackendConnection]);

  useEffect(() => {
    // 尝试使用 Cookie 自动登录
    const tryAutoLogin = async () => {
      if (hasTriedCookieAuth.current) return;
      hasTriedCookieAuth.current = true;

      try {
        // 1. 尝试从 localStorage 恢复（包括加密cookie）
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        const savedEncryptedCookie = localStorage.getItem('encryptedCookie');
        
        if (savedToken && savedUser && savedEncryptedCookie) {
          // 检查是否超时
          if (!checkTimeout()) {
            // 验证加密cookie是否仍然有效
            try {
              const response = await authAPI.verifyCookie(savedEncryptedCookie);
              const { token: newToken, user: newUser, encryptedCookie: newEncryptedCookie } = response.data;
              
              // 设置用户是否为管理员
              const userWithRole = {
                ...newUser,
                isAdmin: newUser.username === 'admin'
              };
              
              // Cookie验证成功，使用新的token和cookie
              setToken(newToken);
              setUser(userWithRole);
              
              // 更新localStorage
              localStorage.setItem('token', newToken);
              localStorage.setItem('user', JSON.stringify(userWithRole));
              localStorage.setItem('encryptedCookie', newEncryptedCookie);
              
              resetTimeout();
              console.log('Cookie 自动登录成功', { username: newUser.username });
              setIsLoading(false);
              return;
            } catch (error: any) {
              // Cookie验证失败，清除本地数据
              console.warn('Cookie 验证失败，需要重新登录:', error.response?.data?.code || error.message);
              clearAuth();
            }
          } else {
            // 超时，清除数据
            console.log('会话超时，需要重新登录');
            clearAuth();
          }
        }

        console.log('未找到有效的登录信息，需要手动登录');
      } catch (error) {
        console.warn('自动登录失败:', error);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    tryAutoLogin();
  }, [checkTimeout, clearAuth, resetTimeout]);

  // 监听用户活动
  useEffect(() => {
    if (!token) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimeout();
    };

    // 添加事件监听器
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // 初始化计时器
    resetTimeout();

    // 清理函数
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [token, resetTimeout]);

  // 监听网络状态变化
  useEffect(() => {
    if (!token) return;

    const handleOnline = () => {
      console.log('网络连接已恢复');
      // 网络恢复时，立即检查后端连接
      checkBackendConnection();
    };

    const handleOffline = () => {
      console.log('网络连接已断开');
      // 网络断开时，清除认证信息
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, checkBackendConnection, clearAuth]);

  const login = async (username: string, password: string) => {
    const response = await authAPI.login(username, password);
    const { token: newToken, user: newUser, encryptedCookie } = response.data;
    
    // 设置用户是否为管理员
    const userWithRole = {
      ...newUser,
      isAdmin: newUser.username === 'admin'
    };
    
    setToken(newToken);
    setUser(userWithRole);
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userWithRole));
    if (encryptedCookie) {
      localStorage.setItem('encryptedCookie', encryptedCookie);
    }
    
    // 重置超时计时器
    resetTimeout();
    
    // 启动网络连接检测
    startNetworkCheck();
    
    // 登录成功后，异步检查AI模型信息（不阻塞登录流程）
    setTimeout(() => {
      checkAiModelAfterLogin();
    }, 1000);
  };

  // 登录后检查AI模型信息
  const checkAiModelAfterLogin = async () => {
    try {
      const aiApiUrl = localStorage.getItem('aiApiUrl');
      const aiApiKey = localStorage.getItem('aiApiKey');
      const aiModel = localStorage.getItem('aiModel');
      
      if (!aiApiUrl || !aiApiKey) {
        // 未配置AI，不显示通知
        return;
      }
      
      // 获取可用模型列表
      const modelsUrl = aiApiUrl.replace('/chat/completions', '/models').replace('/v1/chat/completions', '/v1/models');
      
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${aiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5秒超时
      });
      
      if (!response.ok) {
        throw new Error(`获取模型列表失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        // 过滤非聊天模型
        const excludePatterns = ['embedding', 'whisper', 'tts', 'dall-e', 'davinci', 'babbage', 'ada', 'curie'];
        const models = data.data
          .map((m: any) => m.id)
          .filter((id: string) => {
            const lowerId = id.toLowerCase();
            return !excludePatterns.some(pattern => lowerId.includes(pattern));
          });
        
        // 检查当前配置的模型是否在列表中
        if (aiModel && models.includes(aiModel)) {
          // 模型匹配，显示成功通知
          showAiModelNotification('success', `AI 模型配置正常：${aiModel}`, 5000);
        } else {
          // 模型不匹配，显示警告通知
          showAiModelNotification('warning', `警告：配置的模型 ${aiModel} 不在可用列表中`, 10000);
        }
      } else {
        throw new Error('返回的数据格式不正确');
      }
    } catch (err: any) {
      // 获取失败，显示错误通知
      console.warn('检查AI模型失败:', err.message);
      showAiModelNotification('error', 'AI 模型检查失败：' + (err.message || '无法连接到AI服务'), 10000);
    }
  };

  // 显示AI模型通知
  const showAiModelNotification = (type: 'success' | 'warning' | 'error', message: string, duration: number) => {
    // 触发自定义事件，让App组件显示通知
    window.dispatchEvent(new CustomEvent('aiModelNotification', {
      detail: { type, message, duration }
    }));
  };

  const logout = async () => {
    try {
      // 调用后端登出接口清除 Cookie
      await authAPI.logout();
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 无论请求是否成功，都清除本地状态
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      isAuthenticated: !!token,
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
