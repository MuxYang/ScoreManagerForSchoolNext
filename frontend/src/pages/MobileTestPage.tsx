import React from 'react';
import { Card, Title2, Body1, tokens, makeStyles } from '@fluentui/react-components';
import { useMobileDetection, getDeviceInfo } from '../utils/mobileDetection';

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
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    padding: '4px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  label: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
  },
  value: {
    color: tokens.colorNeutralForeground1,
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
});

const MobileTestPage: React.FC = () => {
  const styles = useStyles();
  const isMobile = useMobileDetection();
  const deviceInfo = getDeviceInfo();

  return (
    <div className={styles.container}>
      <Title2 style={{ marginBottom: '20px' }}>移动端检测测试</Title2>
      
      <Card className={styles.infoCard}>
        <div className={`${styles.status} ${isMobile ? styles.mobile : styles.desktop}`}>
          {isMobile ? '📱 移动端模式' : '💻 桌面端模式'}
        </div>
        
        <div className={styles.infoItem}>
          <span className={styles.label}>检测结果:</span>
          <span className={styles.value}>{isMobile ? '移动端' : '桌面端'}</span>
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
        
        <div className={styles.infoItem}>
          <span className={styles.label}>UserAgent:</span>
          <span className={styles.value} style={{ fontSize: '12px', wordBreak: 'break-all' }}>
            {deviceInfo.userAgent}
          </span>
        </div>
      </Card>
      
      <Card className={styles.infoCard}>
        <Title2 style={{ marginBottom: '16px' }}>测试说明</Title2>
        <Body1 style={{ marginBottom: '12px' }}>
          1. 在桌面浏览器中，调整窗口宽度到768px以下，应该看到移动端模式
        </Body1>
        <Body1 style={{ marginBottom: '12px' }}>
          2. 在移动设备或移动浏览器中，应该直接显示移动端模式
        </Body1>
        <Body1 style={{ marginBottom: '12px' }}>
          3. 移动端模式应该显示抽屉菜单而不是侧边栏
        </Body1>
        <Body1>
          4. 桌面端模式应该显示侧边栏而不是抽屉菜单
        </Body1>
      </Card>
    </div>
  );
};

export default MobileTestPage;
