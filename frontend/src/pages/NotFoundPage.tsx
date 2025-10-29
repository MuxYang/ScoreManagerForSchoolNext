import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import {
  Card,
  Button,
  Title1,
  Title2,
  Body1,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { Home20Regular, ArrowLeft20Regular } from '@fluentui/react-icons';
import { useNavigate, useLocation } from 'react-router-dom';

const useStyles = makeStyles({
  container: {
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 120px)',
    textAlign: 'center',
    '@media (max-width: 767px)': {
      padding: '20px',
      minHeight: 'calc(100vh - 80px)',
    },
  },
  card: {
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
  },
  icon: {
    fontSize: '64px',
    color: tokens.colorNeutralForeground3,
    marginBottom: '24px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '16px',
    marginTop: '32px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  featureList: {
    textAlign: 'left',
    marginTop: '24px',
    padding: '20px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  featureItem: {
    marginBottom: '8px',
    color: tokens.colorNeutralForeground2,
  },
});

const NotFoundPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.icon}>🔍</div>
        
        <Title1 style={{ marginBottom: '16px', color: tokens.colorNeutralForeground1 }}>
          页面未找到
        </Title1>
        
        <Body1 style={{ marginBottom: '16px', color: tokens.colorNeutralForeground2 }}>
          抱歉，您访问的页面不存在或已被移动。
        </Body1>
        
        <Body1 style={{ 
          marginBottom: '24px', 
          color: tokens.colorNeutralForeground3,
          fontFamily: 'monospace',
          backgroundColor: tokens.colorNeutralBackground2,
          padding: '8px 12px',
          borderRadius: tokens.borderRadiusSmall,
          fontSize: '14px'
        }}>
          访问的地址：{location.pathname}
          <br />
          访问时间：{new Date().toLocaleString('zh-CN')}
        </Body1>

        <MessageBar intent="info" style={{ marginBottom: '24px' }}>
          <MessageBarBody>
            请检查URL是否正确，或使用下方按钮返回常用页面。
          </MessageBarBody>
        </MessageBar>

        <div className={styles.buttonGroup}>
          <Button
            appearance="primary"
            icon={<Home20Regular />}
            onClick={handleGoHome}
            size="large"
          >
            返回首页
          </Button>
          
          <Button
            appearance="secondary"
            icon={<ArrowLeft20Regular />}
            onClick={handleGoBack}
            size="large"
          >
            返回上页
          </Button>
        </div>

        <div className={styles.featureList}>
          <Title2 style={{ marginBottom: '16px', fontSize: '18px' }}>
            快速导航
          </Title2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/scores')}
              style={{ justifyContent: 'flex-start' }}
            >
              📊 积分管理
            </Button>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/students')}
              style={{ justifyContent: 'flex-start' }}
            >
              👥 学生管理
            </Button>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/teachers')}
              style={{ justifyContent: 'flex-start' }}
            >
              👨‍🏫 教师管理
            </Button>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/lecture-records')}
              style={{ justifyContent: 'flex-start' }}
            >
              📚 听课记录
            </Button>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/import')}
              style={{ justifyContent: 'flex-start' }}
            >
              📥 数据导入
            </Button>
            <Button 
              appearance="subtle" 
              onClick={() => navigate('/settings')}
              style={{ justifyContent: 'flex-start' }}
            >
              ⚙️ 系统设置
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NotFoundPage;
