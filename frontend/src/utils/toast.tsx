import React, { useEffect, useState, createContext, useContext } from 'react';
import { Toast, ToastTitle, ToastBody, tokens, useToastController, useId, Toaster } from '@fluentui/react-components';

interface ToastWithProgressProps {
  title: string;
  body: string;
  duration?: number;
  onDismiss?: () => void;
}

export const ToastWithProgress: React.FC<ToastWithProgressProps> = ({ 
  title, 
  body, 
  duration = 3000,
  onDismiss 
}) => {
  const [progress, setProgress] = useState(100);
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const intervalTime = 16; // ~60fps 更新

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        // 开始滑出动画
        setIsSliding(true);
        // 动画完成后调用 onDismiss
        setTimeout(() => {
          if (onDismiss) {
            onDismiss();
          }
        }, 300); // 动画持续 300ms
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, onDismiss]);

  return (
    <Toast style={{ 
      position: 'relative', 
      paddingBottom: '8px',
      minHeight: '60px',
      transform: isSliding ? 'translateX(400px)' : 'translateX(0)',
      opacity: isSliding ? 0 : 1,
      transition: 'transform 300ms ease-in-out, opacity 300ms ease-in-out'
    }}>
      <ToastTitle 
        action={null}
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px'
        }}
      >
        {title}
      </ToastTitle>
      <ToastBody style={{ marginLeft: '0' }}>{body}</ToastBody>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          width: `${progress}%`,
          backgroundColor: tokens.colorBrandBackground,
          transition: 'width 16ms linear',
          borderRadius: '0 0 4px 4px',
        }}
      />
    </Toast>
  );
};

export type ToastIntent = 'success' | 'error' | 'warning' | 'info';

export interface ShowToastOptions {
  title: string;
  body: string;
  intent?: ToastIntent;
  duration?: number;
}

// Toast Context 类型
interface ToastContextType {
  showToast: (options: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider 组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toasterId = useId('global-toaster');
  const { dispatchToast, dismissToast } = useToastController(toasterId);

  const showToast = ({ title, body, intent = 'info', duration = 3000 }: ShowToastOptions) => {
    const toastId = `toast-${Date.now()}-${Math.random()}`; // 生成唯一 ID
    
    dispatchToast(
      <ToastWithProgress 
        title={title} 
        body={body} 
        duration={duration}
        onDismiss={() => dismissToast(toastId)}
      />,
      { 
        intent, 
        position: 'bottom-end',
        timeout: -1, // 禁用自动消失，由动画控制
        toastId
      }
    );
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toaster 
        toasterId={toasterId} 
        position="bottom-end"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
        }}
      />
      {children}
    </ToastContext.Provider>
  );
};

// 自定义 Hook 使用全局 Toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// 向后兼容：创建 showToast 函数（用于不使用 Context 的地方）
export const createShowToast = (dispatchToast: any, dismissToast: any) => {
  return ({ title, body, intent = 'info', duration = 3000 }: ShowToastOptions) => {
    const toastId = `toast-${Date.now()}`; // 生成唯一 ID
    
    dispatchToast(
      <ToastWithProgress 
        title={title} 
        body={body} 
        duration={duration}
        onDismiss={() => dismissToast(toastId)}
      />,
      { 
        intent, 
        position: 'bottom-end', 
        timeout: -1, // 禁用自动消失，由动画控制
        toastId
      }
    );
  };
};
