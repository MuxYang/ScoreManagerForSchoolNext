import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import {
  Input,
  Button,
  Card,
  Title1,
  Title3,
  Body1,
  makeStyles,
  tokens,
  Link,
} from '@fluentui/react-components';
// import { authAPI } from '../services/api';

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

const RegisterPage: React.FC = () => {
  const styles = useStyles();
  // const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!securityQuestion || !securityAnswer) {
      setError('请设置密保问题和答案');
      return;
    }

    setLoading(true);

    try {
      // 注册功能已禁用 - 系统只允许单个管理员账户
      setError('注册功能已禁用！系统只允许单个管理员账户。');
    } catch (err: any) {
      setError(err.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Title1 className={styles.title}>学生量化管理系统</Title1>
        <Title3>注册新账号</Title3>
        
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

          <Input
            type="password"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Input
            type="text"
            placeholder="密保问题（如：你的小学名称）"
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
            required
          />

          <Input
            type="text"
            placeholder="密保答案"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            required
          />

          {error && <Body1 style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Body1>}
          {success && <Body1 style={{ color: tokens.colorPaletteGreenForeground1 }}>{success}</Body1>}

          <Button type="submit" appearance="primary" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <div className={styles.footer}>
          <Body1>
            已有账号？ <Link href="/login">登录</Link>
          </Body1>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
