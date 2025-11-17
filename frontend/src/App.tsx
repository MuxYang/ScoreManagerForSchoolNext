import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './utils/toast';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import FirstLoginSetupPage from './pages/FirstLoginSetupPage';
import DashboardPage from './pages/DashboardPage';
import AIConfigCheckPage from './pages/AIConfigCheckPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spinner size="large" label="正在加载..." />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // 如果用户需要修改密码，重定向到首次登录设置页面
  if (user?.mustChangePassword) {
    return <Navigate to="/first-login-setup" />;
  }
  
  return <>{children}</>;
};

const FirstLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spinner size="large" label="正在加载..." />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // 如果用户不需要修改密码，重定向到主页
  if (!user?.mustChangePassword) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {

  // 抑制来自浏览器扩展的异步响应错误
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // 检查是否是来自浏览器扩展的消息通道错误
      if (event.message && event.message.includes('message channel closed')) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // 修复直接访问形如 /login#/lecture-records 的链接，自动规范为 /#/lecture-records
  useEffect(() => {
    const { pathname, hash } = window.location;
    if (pathname === '/login' && hash && hash.startsWith('#/')) {
      const target = `${window.location.origin}/#${hash.substring(1)}`;
      window.location.replace(target);
    }
  }, []);

  // 服务器重启检测和自动刷新
  useEffect(() => {
    let serverDownDetected = false;
    let isRefreshing = false;
    let checkInterval: NodeJS.Timeout;

    const checkServerStatus = async () => {
      // 只在已登录状态下检查
      if (window.location.hash.includes('/login') || window.location.hash.includes('/forgot-password')) {
        return;
      }

      try {
        // 使用静默的健康检查接口（不记录日志）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

        const response = await fetch('/ping', { 
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // 服务器正常响应（任何HTTP状态码都表示服务器在线）
        if (response.ok || response.status === 401 || response.status === 403 || response.status >= 400) {
          // 如果之前检测到服务器不可用，现在恢复了，自动刷新
          if (serverDownDetected && !isRefreshing) {
            isRefreshing = true;
            console.log('🔄 服务器已恢复，自动刷新页面...');
            // 使用 setTimeout 确保日志能够输出
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
          serverDownDetected = false;
        }
      } catch (error) {
        // 服务器不可用（网络错误、超时等）
        if (!serverDownDetected) {
          console.log('⚠️ 检测到服务器连接中断，等待恢复...');
          serverDownDetected = true;
        }
      }
    };

    // 每3秒检查一次服务器状态（较快的响应速度）
    checkInterval = setInterval(checkServerStatus, 3000);

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/first-login-setup"
          element={
            <FirstLoginRoute>
              <FirstLoginSetupPage />
            </FirstLoginRoute>
          }
        />
        <Route
          path="/ai-config-check"
          element={
            <ProtectedRoute>
              <AIConfigCheckPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
