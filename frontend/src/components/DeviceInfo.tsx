import React from 'react';
import { Card, Title3, Body1, tokens, makeStyles } from '@fluentui/react-components';
import { useMobileDetection, getDeviceInfo } from '../utils/mobileDetection';

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: 9999,
    minWidth: '200px',
    maxWidth: '300px',
    '@media (max-width: 768px)': {
      top: '5px',
      right: '5px',
      left: '5px',
      minWidth: 'unset',
    },
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    fontSize: '12px',
  },
  label: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
  },
  value: {
    color: tokens.colorNeutralForeground1,
  },
  status: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '8px',
  },
  mobile: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  desktop: {
    backgroundColor: tokens.colorPaletteBlueBorderActive,
      color: tokens.colorPaletteBlueForeground2,
  },
});

export const DeviceInfo: React.FC = () => {
  const styles = useStyles();
  const isMobile = useMobileDetection();
  const deviceInfo = getDeviceInfo();

  // 只在开发环境显示
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Card className={styles.container}>
      <Title3 style={{ marginBottom: '12px', fontSize: '14px' }}>设备信息</Title3>
      
      <div className={`${styles.status} ${isMobile ? styles.mobile : styles.desktop}`}>
        {isMobile ? '📱 移动端模式' : '💻 桌面端模式'}
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>设备类型:</span>
        <span className={styles.value}>{deviceInfo.deviceType}</span>
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>设备分类:</span>
        <span className={styles.value}>{deviceInfo.deviceCategory}</span>
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>屏幕尺寸:</span>
        <span className={styles.value}>{deviceInfo.screenWidth}×{deviceInfo.screenHeight}</span>
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>像素比:</span>
        <span className={styles.value}>{deviceInfo.pixelRatio}</span>
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>触摸支持:</span>
        <span className={styles.value}>{deviceInfo.hasTouchSupport ? '✅' : '❌'}</span>
      </div>
      
      <div className={styles.infoItem}>
        <span className={styles.label}>Hover支持:</span>
        <span className={styles.value}>{deviceInfo.supportsHover ? '✅' : '❌'}</span>
      </div>
      
      <Body1 style={{ fontSize: '10px', color: tokens.colorNeutralForeground3, marginTop: '8px' }}>
        UserAgent: {deviceInfo.userAgent.slice(0, 50)}...
      </Body1>
    </Card>
  );
};
