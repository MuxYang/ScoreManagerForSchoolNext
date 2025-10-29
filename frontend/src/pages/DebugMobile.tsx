import React, { useState, useEffect } from 'react';
import { Card, Title2, Body1, Button, tokens, makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  infoCard: {
    marginBottom: '20px',
    padding: '20px',
  },
  status: {
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '16px',
  },
  mobile: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  desktop: {
    backgroundColor: tokens.colorPaletteBlueBackground2,
    color: tokens.colorPaletteBlueForeground2,
  },
  testButton: {
    margin: '8px',
  },
});

const DebugMobile: React.FC = () => {
  const styles = useStyles();
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      setIsMobile(width <= 768);
      console.log('DebugMobile - window width:', width, 'isMobile:', width <= 768);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleTest = () => {
    console.log('Test button clicked');
    console.log('Current window width:', window.innerWidth);
    console.log('isMobile state:', isMobile);
    console.log('Should show mobile UI:', window.innerWidth <= 768);
  };

  return (
    <div className={styles.container}>
      <Title2 style={{ marginBottom: '20px' }}>移动端调试页面</Title2>
      
      <Card className={styles.infoCard}>
        <div className={`${styles.status} ${isMobile ? styles.mobile : styles.desktop}`}>
          {isMobile ? '📱 移动端模式' : '💻 桌面端模式'}
        </div>
        
        <Body1 style={{ marginBottom: '12px' }}>
          当前屏幕宽度: {windowWidth}px
        </Body1>
        
        <Body1 style={{ marginBottom: '12px' }}>
          检测结果: {isMobile ? '移动端' : '桌面端'}
        </Body1>
        
        <Body1 style={{ marginBottom: '12px' }}>
          阈值: 768px
        </Body1>
        
        <Body1 style={{ marginBottom: '12px' }}>
          用户代理: {navigator.userAgent}
        </Body1>
        
        <Button 
          appearance="primary" 
          onClick={handleTest}
          className={styles.testButton}
        >
          测试按钮
        </Button>
      </Card>
    </div>
  );
};

export default DebugMobile;
