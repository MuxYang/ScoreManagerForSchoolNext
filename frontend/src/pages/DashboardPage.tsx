import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  makeStyles,
  Button,
  Title2,
  Body1,
  tokens,
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  DrawerFooter,
} from '@fluentui/react-components';
import {
  People20Regular,
  Trophy20Regular,
  DatabaseArrowDown20Regular,
  Home20Regular,
  PersonBoard20Regular,
  Settings20Regular,
  ArrowUpload20Regular,
  ClockRegular,
  InfoRegular,
  BookTemplate20Regular,
  Navigation20Regular,
  Dismiss20Regular,
  LineHorizontal320Regular
} from '@fluentui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useMobileDetection } from '../utils/mobileDetection';
import { DeviceInfo } from '../components/DeviceInfo';
import HomePage from './HomePage';
import StudentsPageComplete from './StudentsPageComplete';
import TeachersPageComplete from './TeachersPageComplete';
import ScoresPageEnhanced from './ScoresPageEnhanced';
import DataImportPage from './DataImportPage';
import BackupPage from './BackupPage';
import SettingsPage from './SettingsPage';
import PendingRecordsPage from './PendingRecordsPage';
import AboutPage from './AboutPage';
import LectureRecordsPage from './LectureRecordsPage';
import NotFoundPage from './NotFoundPage';
import MobileTestPage from './MobileTestPage';
import SimpleMobileTest from './SimpleMobileTest';
import DebugMobile from './DebugMobile';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    height: '64px',
    padding: '16px 16px',
    '@media (min-width: 768px)': {
      padding: '16px 32px',
    },
  },
  title: {
    fontSize: '18px',
    '@media (min-width: 768px)': {
      fontSize: '24px',
    },
  },
  nav: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    '@media (min-width: 768px)': {
      gap: '16px',
    },
  },
  mobileMenuButton: {
    '@media (min-width: 768px)': {
      display: 'none',
    },
  },
  userInfo: {
    display: 'none',
    '@media (min-width: 768px)': {
      display: 'block',
    },
  },
  layout: {
    display: 'flex',
    marginTop: '64px',
    height: 'calc(100vh - 64px)',
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: '64px',
    bottom: 0,
    overflowY: 'auto',
    zIndex: 999,
    transition: 'transform 0.3s ease-in-out',
    '@media (max-width: 767px)': {
      display: 'none',
    },
  },
  sidebarCollapsed: {
    width: '60px',
    padding: '20px 10px',
    '@media (max-width: 767px)': {
      display: 'none',
    },
  },
  sidebarToggle: {
    width: '100%',
    marginBottom: '16px',
    justifyContent: 'center',
    '@media (max-width: 767px)': {
      display: 'none',
    },
  },
  sidebarBottom: {
    marginTop: 'auto',
    paddingTop: '20px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  main: {
    flex: 1,
    backgroundColor: tokens.colorNeutralBackground2,
    overflowY: 'auto',
    overflowX: 'hidden',
    height: '100%',
    marginLeft: '0px',
    transition: 'margin-left 0.3s ease-in-out',
    '@media (min-width: 768px)': {
      marginLeft: '240px',
    },
  },
  mainCollapsed: {
    marginLeft: '0px',
    '@media (min-width: 768px)': {
      marginLeft: '60px',
    },
  },
  mainContent: {
    padding: '16px',
    '@media (min-width: 768px)': {
      padding: '0px',
    },
  },
  menuItem: {
    width: '100%',
    justifyContent: 'flex-start',
    marginBottom: '8px',
  },
  activeMenuItem: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  welcome: {
    padding: '20px',
    textAlign: 'center',
    '@media (min-width: 768px)': {
      padding: '40px',
    },
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  drawerMenuSection: {
    marginBottom: '20px',
  },
  drawerMenuTitle: {
    marginBottom: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: tokens.colorNeutralForeground1,
  },
});

const DashboardPage: React.FC = () => {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isMobile = useMobileDetection();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 调试信息
  console.log('DashboardPage - isMobile:', isMobile, 'window.innerWidth:', window.innerWidth);
  console.log('DashboardPage - should show drawer:', isMobile);
  console.log('DashboardPage - should show sidebar:', !isMobile);

  // 移动端路由变化时关闭抽屉
  useEffect(() => {
    if (isMobile) {
      setIsDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  const menuItems = [
    { path: 'toggle-sidebar' as any, label: '功能模块', icon: <LineHorizontal320Regular /> },
    { path: '/', label: '首页', icon: <Home20Regular /> },
    { path: '/scores', label: '量化管理', icon: <Trophy20Regular /> },
    { path: '/lecture-records', label: '教师听课记录', icon: <BookTemplate20Regular /> },
    { path: '/pending', label: '待处理记录', icon: <ClockRegular /> },
    { path: '/students', label: '学生管理', icon: <People20Regular /> },
    { path: '/teachers', label: '教师管理', icon: <PersonBoard20Regular /> },
    { path: '/import', label: '数据导入', icon: <ArrowUpload20Regular /> },
    ...(user?.isAdmin ? [{ path: '/backup', label: '备份恢复', icon: <DatabaseArrowDown20Regular /> }] : []),
  ];

  const bottomMenuItems = [
    { path: '/settings', label: '系统设置', icon: <Settings20Regular /> },
    { path: '/about', label: '关于', icon: <InfoRegular /> },
  ];

  // 渲染菜单项的函数
  const renderMenuItems = (items: typeof menuItems, closeDrawer?: boolean, collapsed?: boolean) => (
    items.map((item) => {
      // 特殊处理：折叠/展开按钮（仅在桌面端显示）
      if (item.path === 'toggle-sidebar') {
        // 移动端使用抽屉，不需要折叠按钮
        if (isMobile || closeDrawer) {
          return null;
        }
        return (
          <Button
            key="toggle-sidebar"
            appearance="subtle"
            icon={<LineHorizontal320Regular />}
            className={styles.menuItem}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? '展开功能模块' : '折叠功能模块'}
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              minWidth: collapsed ? '40px' : 'auto',
              marginBottom: '16px',
            }}
          >
            {!collapsed && '功能模块'}
          </Button>
        );
      }

      return (
        <Link
          key={item.path}
          to={item.path}
          style={{ textDecoration: 'none', display: 'block' }}
          onClick={closeDrawer ? () => setIsDrawerOpen(false) : undefined}
          title={collapsed ? item.label : undefined}
        >
          <Button
            appearance={location.pathname === item.path ? 'primary' : 'subtle'}
            icon={item.icon}
            className={styles.menuItem}
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              minWidth: collapsed ? '40px' : 'auto',
            }}
          >
            {!collapsed && item.label}
          </Button>
        </Link>
      );
    }).filter(Boolean)
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && (
            <Button
              appearance="subtle"
              icon={<Navigation20Regular />}
              onClick={() => setIsDrawerOpen(true)}
              className={styles.mobileMenuButton}
            />
          )}
          <Title2 className={styles.title}>学生量化管理系统</Title2>
        </div>
        <div className={styles.nav}>
          <Body1 className={styles.userInfo}>欢迎，{user?.username}</Body1>
          <Button 
            appearance="subtle" 
            onClick={logout}
            style={{ fontSize: isMobile ? '12px' : '14px' }}
          >
            退出登录
          </Button>
        </div>
      </header>

      {/* 移动端抽屉导航 */}
      {isMobile && (
        <Drawer
            open={isDrawerOpen}
            onOpenChange={(_, { open }) => setIsDrawerOpen(open)}
            position="start"
            size="medium"
          >
            <DrawerHeader>
              <DrawerHeaderTitle
                action={
                  <Button
                    appearance="subtle"
                    icon={<Dismiss20Regular />}
                    onClick={() => setIsDrawerOpen(false)}
                  />
                }
              >
                菜单
              </DrawerHeaderTitle>
            </DrawerHeader>
            <DrawerBody>
              <div className={styles.drawerContent}>
                <div className={styles.drawerMenuSection}>
                  <div className={styles.drawerMenuTitle}>功能模块</div>
                  {renderMenuItems(menuItems, true)}
                </div>
                <div className={styles.drawerMenuSection}>
                  <div className={styles.drawerMenuTitle}>系统</div>
                  {renderMenuItems(bottomMenuItems, true)}
                </div>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <div style={{ padding: '16px', textAlign: 'center', color: tokens.colorNeutralForeground3 }}>
                <Body1>欢迎，{user?.username}</Body1>
              </div>
            </DrawerFooter>
          </Drawer>
      )}

      <div className={styles.layout}>
        {/* 桌面端侧边栏 - 仅在非移动端显示 */}
        {!isMobile && (
          <aside className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
            <div>
              {renderMenuItems(menuItems, false, isSidebarCollapsed)}
            </div>
            
            <div className={styles.sidebarBottom}>
              {renderMenuItems(bottomMenuItems, false, isSidebarCollapsed)}
            </div>
          </aside>
        )}

        <main className={`${styles.main} ${isSidebarCollapsed ? styles.mainCollapsed : ''}`}>
          <div className={styles.mainContent}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/students" element={<StudentsPageComplete />} />
              <Route path="/teachers" element={<TeachersPageComplete />} />
              <Route path="/scores" element={<ScoresPageEnhanced />} />
              <Route path="/lecture-records" element={<LectureRecordsPage />} />
              <Route path="/pending" element={<PendingRecordsPage />} />
              <Route path="/import" element={<DataImportPage />} />
              {user?.isAdmin && <Route path="/backup" element={<BackupPage />} />}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/mobile-test" element={<MobileTestPage />} />
              <Route path="/simple-mobile-test" element={<SimpleMobileTest />} />
              <Route path="/debug-mobile" element={<DebugMobile />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </main>
      </div>
      
      {/* 开发环境设备信息显示 */}
      <DeviceInfo />
    </div>
  );
};

export default DashboardPage;
