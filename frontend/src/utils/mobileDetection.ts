import { useState, useEffect } from 'react';

// 移动设备检测工具函数
export const detectMobileDevice = (): boolean => {
  // 检查屏幕尺寸（主要判断依据）
  const isMobileScreenSize = window.innerWidth <= 768;

  // 调试信息
  console.log('Mobile Detection:', {
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    isMobileScreenSize
  });

  // 简化判断逻辑：屏幕尺寸是主要依据
  const result = isMobileScreenSize;
  console.log('Final mobile detection result:', result);
  return result;
};

// React Hook for mobile detection
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(() => {
    // 初始状态基于当前屏幕尺寸
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const checkDevice = () => {
      const mobileResult = detectMobileDevice();
      console.log('useMobileDetection - setting isMobile to:', mobileResult);
      setIsMobile(mobileResult);
    };

    // 初始检测
    checkDevice();

    // 监听窗口大小变化
    const handleResize = () => {
      // 使用防抖避免频繁触发
      setTimeout(checkDevice, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // 监听方向变化（移动设备特有）
    const handleOrientationChange = () => {
      // 延迟检测，等待屏幕尺寸更新
      setTimeout(checkDevice, 300);
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  console.log('useMobileDetection - returning isMobile:', isMobile);
  return isMobile;
};

// 获取设备类型详细信息
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  
  let deviceType = 'desktop';
  let deviceCategory = 'unknown';

  if (detectMobileDevice()) {
    if (screenWidth <= 480) {
      deviceType = 'phone';
      deviceCategory = 'small-phone';
    } else if (screenWidth <= 768) {
      deviceType = 'phone';
      deviceCategory = 'large-phone';
    } else if (screenWidth <= 1024) {
      deviceType = 'tablet';
      deviceCategory = 'tablet';
    } else {
      deviceType = 'desktop';
      deviceCategory = 'large-screen';
    }
  } else {
    deviceType = 'desktop';
    deviceCategory = screenWidth <= 1366 ? 'laptop' : 'desktop';
  }

  return {
    isMobile: detectMobileDevice(),
    deviceType,
    deviceCategory,
    screenWidth,
    screenHeight,
    pixelRatio,
    userAgent,
    hasTouchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    supportsHover: window.matchMedia('(hover: hover)').matches
  };
};
