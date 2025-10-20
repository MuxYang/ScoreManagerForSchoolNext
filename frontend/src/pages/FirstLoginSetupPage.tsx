import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  Card,
  Input,
  Button,
  Label,
  Title1,
  Body1,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ShieldCheckmarkRegular,
  KeyRegular,
  QuestionCircleRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '20px',
  },
  card: {
    maxWidth: '600px',
    width: '100%',
    padding: '40px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  icon: {
    fontSize: '48px',
    color: tokens.colorBrandForeground1,
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  input: {
    width: '100%',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  button: {
    flex: 1,
  },
  warningBox: {
    padding: '16px',
    backgroundColor: tokens.colorPaletteYellowBackground2,
    borderLeft: `4px solid ${tokens.colorPaletteYellowBorder2}`,
    borderRadius: '4px',
    marginBottom: '24px',
  },
  requirements: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    marginTop: '4px',
  },
});

const FirstLoginSetupPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!newPassword || !confirmPassword || !securityQuestion || !securityAnswer) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 8) {
      setError('密码长度至少为8位');
      return;
    }

    // 检查密码强度：大写字母、小写字母、数字、符号四选三
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase) {
      setError('密码必须包含大写字母和小写字母');
      return;
    }

    if (!hasNumber && !hasSymbol) {
      setError('密码必须包含数字或符号');
      return;
    }

    const typeCount = [hasUpperCase, hasLowerCase, hasNumber, hasSymbol].filter(Boolean).length;
    if (typeCount < 3) {
      setError('密码必须包含大写字母、小写字母、数字、符号中的至少三种');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (securityQuestion.trim().length < 5) {
      setError('密保问题至少需要5个字符');
      return;
    }

    if (securityAnswer.trim().length < 2) {
      setError('密保答案至少需要2个字符');
      return;
    }

    setLoading(true);

    try {
      await authAPI.firstLoginSetup({
        userId: user?.id,
        newPassword,
        securityQuestion,
        securityAnswer,
      });

      alert('密码和密保设置成功！请使用新密码重新登录');
      logout();
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || '设置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <ShieldCheckmarkRegular className={styles.icon} />
          <Title1>首次登录设置</Title1>
          <Body1>为了您的账户安全，请立即修改密码并设置密保问题</Body1>
        </div>

        <div className={styles.warningBox}>
          <strong>⚠️ 重要提示</strong>
          <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
            <li>这是您首次登录，必须修改初始密码</li>
            <li>请设置一个安全的密码和容易记住的密保问题</li>
            <li>密保问题将用于密码找回，请妥善保管</li>
            <li>完成设置后将自动退出，请使用新密码登录</li>
          </ul>
        </div>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <Label required>
              <KeyRegular style={{ marginRight: '8px' }} />
              新密码
            </Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码"
              className={styles.input}
              required
            />
            <div className={styles.requirements}>
              至少8位，必须包含大写字母、小写字母，以及数字或符号（四选三）
            </div>
          </div>

          <div className={styles.field}>
            <Label required>
              <KeyRegular style={{ marginRight: '8px' }} />
              确认密码
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <Label required>
              <QuestionCircleRegular style={{ marginRight: '8px' }} />
              密保问题
            </Label>
            <Input
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              placeholder="例如：您的出生地是？"
              className={styles.input}
              required
            />
            <div className={styles.requirements}>
              用于找回密码，请设置一个只有您知道答案的问题
            </div>
          </div>

          <div className={styles.field}>
            <Label required>
              <QuestionCircleRegular style={{ marginRight: '8px' }} />
              密保答案
            </Label>
            <Input
              type="password"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="请输入密保答案"
              className={styles.input}
              required
            />
            <div className={styles.requirements}>
              答案将被加密保存，请牢记
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <Button
              appearance="secondary"
              onClick={handleLogout}
              disabled={loading}
              className={styles.button}
            >
              取消并退出
            </Button>
            <Button
              appearance="primary"
              type="submit"
              disabled={loading}
              className={styles.button}
            >
              {loading ? '保存中...' : '保存并重新登录'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default FirstLoginSetupPage;
