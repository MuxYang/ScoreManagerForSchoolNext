import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Theme,
} from '@fluentui/react-components';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  actualTheme: 'light' | 'dark'; // 实际应用的主题（解析 system 后）
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 获取系统主题偏好
const getSystemTheme = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // 从 localStorage 读取主题设置
    const savedTheme = localStorage.getItem('theme');
    // 默认跟随系统
    if (!savedTheme) {
      return 'system';
    }
    return savedTheme as ThemeMode;
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme || savedTheme === 'system') {
      return getSystemTheme();
    }
    return savedTheme as 'light' | 'dark';
  });

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        setActualTheme(e.matches ? 'dark' : 'light');
      }
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);

    // 清理
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    // 更新实际应用的主题
    if (theme === 'system') {
      setActualTheme(getSystemTheme());
    } else {
      setActualTheme(theme);
    }

    // 保存主题设置到 localStorage
    localStorage.setItem('theme', theme);
    
    // 更新 document 的 data-theme 属性
    const appliedTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', appliedTheme);
    
    // 更新 body 背景色
    if (appliedTheme === 'dark') {
      document.body.style.backgroundColor = '#1a1a1a';
      document.body.style.color = '#ffffff';
    } else {
      document.body.style.backgroundColor = webLightTheme.colorNeutralBackground1;
      document.body.style.color = '#000000';
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const fluentTheme: Theme = actualTheme === 'light' ? webLightTheme : webDarkTheme;

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, toggleTheme, setTheme }}>
      <FluentProvider theme={fluentTheme}>
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
