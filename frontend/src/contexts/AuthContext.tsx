import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: number;
  username: string;
  mustChangePassword?: boolean;
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

// 超时时间：10 分钟（毫秒）
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

/**
 * 从浏览器 Cookie 中读取指定名称的 Cookie
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初始加载状态
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriedCookieAuth = useRef(false); // 防止重复尝试

  // 清除所有认证信息
  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
      console.log('用户无操作超过 10 分钟，自动登出');
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

  useEffect(() => {
    // 尝试使用 Cookie 自动登录
    const tryAutoLogin = async () => {
      if (hasTriedCookieAuth.current) return;
      hasTriedCookieAuth.current = true;

      try {
        // 1. 尝试从 localStorage 恢复
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken && savedUser) {
          // 检查是否超时
          if (!checkTimeout()) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            resetTimeout();
            console.log('从 localStorage 恢复登录状态');
            setIsLoading(false);
            return;
          }
        }

        // 2. 尝试从 Cookie 自动登录
        const authCookie = getCookie('auth_session');
        if (authCookie) {
          console.log('检测到 auth_session Cookie，尝试自动登录...');
          
          const response = await authAPI.verifyCookie(authCookie);
          const { token: newToken, user: newUser } = response.data;
          
          setToken(newToken);
          setUser(newUser);
          
          // 保存到 localStorage
          localStorage.setItem('token', newToken);
          localStorage.setItem('user', JSON.stringify(newUser));
          
          resetTimeout();
          console.log('Cookie 自动登录成功', { username: newUser.username });
        } else {
          console.log('未找到有效的 Cookie，需要手动登录');
        }
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

  const login = async (username: string, password: string) => {
    const response = await authAPI.login(username, password);
    const { token: newToken, user: newUser } = response.data;
    
    setToken(newToken);
    setUser(newUser);
    
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    // 重置超时计时器
    resetTimeout();
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
