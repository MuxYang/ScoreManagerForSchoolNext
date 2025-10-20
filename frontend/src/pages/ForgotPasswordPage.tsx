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
  Spinner,
} from '@fluentui/react-components';
import { authAPI } from '../services/api';

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
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
  success: {
    color: tokens.colorPaletteGreenForeground1,
  },
  step: {
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '4px',
  },
});

const ForgotPasswordPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: 输入用户名, 2: 回答密保, 3: 设置新密码
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newSecurityQuestion, setNewSecurityQuestion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.getSecurityQuestion(username);
      setSecurityQuestion(response.data.securityQuestion);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取密保问题失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer.trim()) {
      setError('请输入密保答案');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!newSecurityQuestion.trim()) {
      setError('请设置新的密保问题');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(username, securityAnswer, newPassword, newSecurityQuestion);
      alert('密码重置成功！即将跳转到登录页面');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || '密码重置失败，请检查密保答案是否正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <Title1 className={styles.title}>找回密码</Title1>

        {step === 1 && (
          <>
            <Title3>步骤 1: 输入用户名</Title3>
            <form onSubmit={handleStep1} className={styles.form}>
              <Input
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              {error && <Body1 className={styles.error}>{error}</Body1>}

              <Button type="submit" appearance="primary" disabled={loading}>
                {loading ? <Spinner size="tiny" /> : '下一步'}
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <Title3>步骤 2: 回答密保问题</Title3>
            <div className={styles.step}>
              <Body1><strong>用户名:</strong> {username}</Body1>
              <Body1><strong>密保问题:</strong> {securityQuestion}</Body1>
            </div>
            <form onSubmit={handleStep2} className={styles.form}>
              <Input
                type="text"
                placeholder="请输入密保答案"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
              />

              {error && <Body1 className={styles.error}>{error}</Body1>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  appearance="secondary"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  上一步
                </Button>
                <Button type="submit" appearance="primary" style={{ flex: 1 }}>
                  下一步
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <Title3>步骤 3: 设置新密码</Title3>
            <div className={styles.step}>
              <Body1><strong>用户名:</strong> {username}</Body1>
            </div>
            <form onSubmit={handleStep3} className={styles.form}>
              <Input
                type="password"
                placeholder="新密码"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <Input
                type="password"
                placeholder="确认新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Input
                type="text"
                placeholder="新的密保问题"
                value={newSecurityQuestion}
                onChange={(e) => setNewSecurityQuestion(e.target.value)}
                required
              />

              {error && <Body1 className={styles.error}>{error}</Body1>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  appearance="secondary"
                  onClick={() => setStep(2)}
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  上一步
                </Button>
                <Button
                  type="submit"
                  appearance="primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? <Spinner size="tiny" /> : '重置密码'}
                </Button>
              </div>
            </form>
          </>
        )}

        <div className={styles.footer}>
          <Body1>
            想起密码了？ <Link to="/login">返回登录</Link>
          </Body1>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
