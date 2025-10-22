import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spinner, Toast, Toaster, ToastTitle, useId, useToastController } from '@fluentui/react-components';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import FirstLoginSetupPage from './pages/FirstLoginSetupPage';
import DashboardPage from './pages/DashboardPage';

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
  const toasterId = useId('aiModelToaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    const handleAiModelNotification = (event: any) => {
      try {
        const { type, message, duration } = event.detail;
        
        dispatchToast(
          <Toast>
            <ToastTitle>{message}</ToastTitle>
          </Toast>,
          {
            position: 'bottom-end',
            intent: type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error',
            timeout: duration,
          }
        );
      } catch (error) {
        console.error('显示通知失败:', error);
      }
    };

    window.addEventListener('aiModelNotification', handleAiModelNotification);
    
    return () => {
      window.removeEventListener('aiModelNotification', handleAiModelNotification);
    };
  }, [dispatchToast]);

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

  return (
    <>
      <Toaster toasterId={toasterId} />
      <BrowserRouter>
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
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
