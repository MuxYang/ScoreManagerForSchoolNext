import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  makeStyles,
  Button,
  Title2,
  Body1,
  tokens,
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
} from '@fluentui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import HomePage from './HomePage';
import StudentsPageComplete from './StudentsPageComplete';
import TeachersPageComplete from './TeachersPageComplete';
import ScoresPageEnhanced from './ScoresPageEnhanced';
import DataImportPage from './DataImportPage';
import BackupPage from './BackupPage';
import SettingsPage from './SettingsPage';
import PendingRecordsPage from './PendingRecordsPage';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  nav: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  layout: {
    display: 'flex',
    flex: 1,
  },
  sidebar: {
    width: '240px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
    padding: '20px',
  },
  main: {
    flex: 1,
    backgroundColor: tokens.colorNeutralBackground2,
    overflowY: 'auto',
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
    padding: '40px',
    textAlign: 'center',
  },
});

const DashboardPage: React.FC = () => {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: '首页', icon: <Home20Regular /> },
    { path: '/students', label: '学生管理', icon: <People20Regular /> },
    { path: '/teachers', label: '教师管理', icon: <PersonBoard20Regular /> },
    { path: '/scores', label: '扣分管理', icon: <Trophy20Regular /> },
    { path: '/pending', label: '待处理记录', icon: <ClockRegular /> },
    { path: '/import', label: '数据导入', icon: <ArrowUpload20Regular /> },
    { path: '/backup', label: '备份恢复', icon: <DatabaseArrowDown20Regular /> },
    { path: '/settings', label: '系统设置', icon: <Settings20Regular /> },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Title2>学生扣分管理系统</Title2>
        <div className={styles.nav}>
          <Body1>欢迎，{user?.username}</Body1>
          <Button appearance="subtle" onClick={logout}>
            退出登录
          </Button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <h3 style={{ marginBottom: '20px' }}>功能模块</h3>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <Button
                appearance={location.pathname === item.path ? 'primary' : 'subtle'}
                icon={item.icon}
                className={styles.menuItem}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </aside>

        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/students" element={<StudentsPageComplete />} />
            <Route path="/teachers" element={<TeachersPageComplete />} />
            <Route path="/scores" element={<ScoresPageEnhanced />} />
            <Route path="/pending" element={<PendingRecordsPage />} />
            <Route path="/import" element={<DataImportPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
