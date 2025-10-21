import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Input,
  Button,
  Card,
  Title1,
  Title3,
  Body1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAuth } from '../contexts/AuthContext';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    width: '400px',
    padding: '32px',
  },
  title: {
    marginBottom: '24px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  footer: {
    marginTop: '16px',
    textAlign: 'center',
  },
});

const LoginPage: React.FC = () => {
  const styles = useStyles();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Title1 className={styles.title}>学生扣分管理系统</Title1>
        <Title3>登录</Title3>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <Body1 style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Body1>}

          <Button type="submit" appearance="primary" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div className={styles.footer}>
          <Body1>
            <Link to="/forgot-password">忘记密码？</Link>
          </Body1>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
