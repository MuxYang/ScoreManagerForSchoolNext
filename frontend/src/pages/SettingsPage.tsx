import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  Title2,
  Title3,
  Input,
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  Switch,
  Radio,
  RadioGroup,
  Label,
  Select,
  Divider,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import { authAPI, backupAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const useStyles = makeStyles({
  container: {
    padding: '20px',
  },
  section: {
    marginBottom: '20px',
  },
  formField: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    padding: '20px',
    marginTop: '20px',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
  },
  settingLabel: {
    flex: 1,
  },
  settingControl: {
    minWidth: '200px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginTop: '16px',
  },
  statsCard: {
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
  },
  statsValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginTop: '8px',
  },
});

const SettingsPage: React.FC = () => {
  const styles = useStyles();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [selectedTab, setSelectedTab] = useState('password');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 界面设置
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'medium');
  
  // 功能设置
  const [pageSize, setPageSize] = useState(localStorage.getItem('pageSize') || '10');
  const [autoBackup, setAutoBackup] = useState(localStorage.getItem('autoBackup') === 'true');
  const [showNotifications, setShowNotifications] = useState(localStorage.getItem('showNotifications') !== 'false');
  
  // 语言设置
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'zh-CN');

  // 数据库统计信息
  const [dbStats, setDbStats] = useState<any>(null);
  const [dbStatsDialogOpen, setDbStatsDialogOpen] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // 保存设置到 localStorage（主题除外，主题由 ThemeContext 管理）
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    localStorage.setItem('pageSize', pageSize);
    localStorage.setItem('autoBackup', String(autoBackup));
    localStorage.setItem('showNotifications', String(showNotifications));
    localStorage.setItem('language', language);
  }, [fontSize, pageSize, autoBackup, showNotifications, language]);

  // 加载数据库统计信息
  const loadDatabaseStats = async () => {
    setLoadingStats(true);
    setError('');
    try {
      const response = await backupAPI.getDatabaseStats();
      setDbStats(response.data);
      setDbStatsDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || '获取数据库统计信息失败');
    } finally {
      setLoadingStats(false);
    }
  };

  // 优化数据库
  const handleOptimizeDatabase = async () => {
    if (!confirm('优化数据库可能需要一些时间，确定要继续吗？')) {
      return;
    }

    setOptimizing(true);
    setError('');
    setSuccess('');
    
    try {
      await backupAPI.optimizeDatabase();
      setSuccess('数据库优化成功！');
    } catch (err: any) {
      setError(err.response?.data?.error || '数据库优化失败');
    } finally {
      setOptimizing(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (!user?.id) {
      setError('用户信息无效，请重新登录');
      return;
    }

    try {
      await authAPI.changePassword(user.id, oldPassword, newPassword);
      setSuccess('密码修改成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || '密码修改失败');
    }
  };

  return (
    <div className={styles.container}>
      <Title2>系统设置</Title2>

      <TabList
        selectedValue={selectedTab}
        onTabSelect={(_, data) => setSelectedTab(data.value as string)}
      >
        <Tab value="password">密码修改</Tab>
        <Tab value="interface">界面设置</Tab>
        <Tab value="function">功能设置</Tab>
        <Tab value="database">数据库设置</Tab>
        <Tab value="language">语言设置</Tab>
      </TabList>

      <Card className={styles.card}>
        {selectedTab === 'password' && (
          <div>
            <Title2>修改密码</Title2>
            {error && (
              <MessageBar intent="error" style={{ marginTop: '16px' }}>
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            {success && (
              <MessageBar intent="success" style={{ marginTop: '16px' }}>
                <MessageBarBody>{success}</MessageBarBody>
              </MessageBar>
            )}
            <form onSubmit={handlePasswordChange} style={{ marginTop: '20px' }}>
              <div className={styles.formField}>
                <label>当前密码</label>
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formField}>
                <label>新密码</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formField}>
                <label>确认新密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" appearance="primary">
                修改密码
              </Button>
            </form>
          </div>
        )}

        {selectedTab === 'interface' && (
          <div>
            <Title2>界面设置</Title2>
            
            <div style={{ marginTop: '24px' }}>
              <Title3>主题设置</Title3>
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>主题模式</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    选择主题外观（即时生效）
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <RadioGroup
                    value={theme}
                    onChange={(_, data) => setTheme(data.value as 'light' | 'dark' | 'system')}
                  >
                    <Radio value="system" label="跟随系统" />
                    <Radio value="light" label="浅色模式" />
                    <Radio value="dark" label="深色模式" />
                  </RadioGroup>
                </div>
              </div>
              
              <Divider />
              
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>字体大小</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    调整界面文字大小
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <Select
                    value={fontSize}
                    onChange={(_, data) => setFontSize(data.value)}
                  >
                    <option value="small">小</option>
                    <option value="medium">中（默认）</option>
                    <option value="large">大</option>
                  </Select>
                </div>
              </div>
              
              <MessageBar intent="success" style={{ marginTop: '20px' }}>
                <MessageBarBody>
                  ✓ 主题已切换，立即生效！
                </MessageBarBody>
              </MessageBar>
            </div>
          </div>
        )}

        {selectedTab === 'function' && (
          <div>
            <Title2>功能设置</Title2>
            
            <div style={{ marginTop: '24px' }}>
              <Title3>数据显示</Title3>
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>每页显示条数</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    设置列表每页显示的数据条数
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <Select
                    value={pageSize}
                    onChange={(_, data) => setPageSize(data.value)}
                  >
                    <option value="5">5 条</option>
                    <option value="10">10 条（默认）</option>
                    <option value="20">20 条</option>
                    <option value="50">50 条</option>
                    <option value="100">100 条</option>
                  </Select>
                </div>
              </div>
              
              <Divider />
              
              <Title3 style={{ marginTop: '24px' }}>自动化</Title3>
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>自动备份</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    在关键操作前自动创建数据备份
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <Switch
                    checked={autoBackup}
                    onChange={(_, data) => setAutoBackup(data.checked)}
                  />
                </div>
              </div>
              
              <Divider />
              
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>显示通知</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    操作成功或失败时显示提示信息
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <Switch
                    checked={showNotifications}
                    onChange={(_, data) => setShowNotifications(data.checked)}
                  />
                </div>
              </div>
              
              <MessageBar intent="success" style={{ marginTop: '20px' }}>
                <MessageBarBody>
                  ✓ 设置已自动保存
                </MessageBarBody>
              </MessageBar>
            </div>
          </div>
        )}

        {selectedTab === 'database' && (
          <div>
            <Title2>数据库设置</Title2>
            
            <div style={{ marginTop: '24px' }}>
              <Title3>数据库信息</Title3>
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>数据库类型</Label>
                </div>
                <div className={styles.settingControl}>
                  <Input value="SQLite" disabled />
                </div>
              </div>
              
              <Divider />
              
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>数据库路径</Label>
                </div>
                <div className={styles.settingControl}>
                  <Input value="./backend/data/database.db" disabled />
                </div>
              </div>
              
              <Divider />
              
              <Title3 style={{ marginTop: '24px' }}>数据库维护</Title3>
              <div style={{ marginTop: '16px' }}>
                <Button 
                  appearance="secondary" 
                  style={{ marginRight: '12px' }}
                  onClick={handleOptimizeDatabase}
                  disabled={optimizing}
                >
                  {optimizing ? '优化中...' : '优化数据库'}
                </Button>
                <Button 
                  appearance="secondary"
                  onClick={loadDatabaseStats}
                  disabled={loadingStats}
                >
                  {loadingStats ? '加载中...' : '查看统计信息'}
                </Button>
              </div>
              
              <MessageBar intent="warning" style={{ marginTop: '20px' }}>
                <MessageBarBody>
                  ⚠️ 数据库维护功能需要管理员权限，请谨慎操作
                </MessageBarBody>
              </MessageBar>
            </div>
          </div>
        )}

        {selectedTab === 'language' && (
          <div>
            <Title2>语言设置</Title2>
            
            <div style={{ marginTop: '24px' }}>
              <Title3>系统语言</Title3>
              <div className={styles.settingRow}>
                <div className={styles.settingLabel}>
                  <Label>显示语言</Label>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    选择系统界面显示的语言
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <RadioGroup
                    value={language}
                    onChange={(_, data) => setLanguage(data.value)}
                  >
                    <Radio value="zh-CN" label="简体中文" />
                    <Radio value="zh-TW" label="繁體中文（开发中）" disabled />
                    <Radio value="en-US" label="English（开发中）" disabled />
                  </RadioGroup>
                </div>
              </div>
              
              <MessageBar intent="info" style={{ marginTop: '20px' }}>
                <MessageBarBody>
                  💡 当前版本仅支持简体中文，其他语言正在开发中
                </MessageBarBody>
              </MessageBar>
            </div>
          </div>
        )}
      </Card>

      {/* 数据库统计信息对话框 */}
      <Dialog open={dbStatsDialogOpen} onOpenChange={(_, data) => setDbStatsDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>数据库统计信息</DialogTitle>
            <DialogContent>
              {dbStats && (
                <div>
                  <Title3>数据表统计</Title3>
                  <div className={styles.statsGrid}>
                    <div className={styles.statsCard}>
                      <Label>用户数量</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.users}</div>
                    </div>
                    <div className={styles.statsCard}>
                      <Label>学生数量</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.students}</div>
                    </div>
                    <div className={styles.statsCard}>
                      <Label>教师数量</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.teachers}</div>
                    </div>
                    <div className={styles.statsCard}>
                      <Label>成绩记录</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.scores}</div>
                    </div>
                    <div className={styles.statsCard}>
                      <Label>备份数量</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.backups}</div>
                    </div>
                    <div className={styles.statsCard}>
                      <Label>操作日志</Label>
                      <div className={styles.statsValue}>{dbStats.tableStats.logs}</div>
                    </div>
                  </div>

                  <Divider style={{ margin: '20px 0' }} />

                  <Title3>文件信息</Title3>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <Label>文件路径：</Label> {dbStats.fileInfo.path}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Label>文件大小：</Label> {dbStats.fileInfo.size} MB
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Label>最后修改：</Label> {new Date(dbStats.fileInfo.lastModified).toLocaleString('zh-CN')}
                    </div>
                  </div>

                  <Divider style={{ margin: '20px 0' }} />

                  <Title3>最近活动</Title3>
                  <div style={{ marginTop: '12px' }}>
                    {dbStats.recentActivity.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <th style={{ textAlign: 'left', padding: '8px' }}>操作</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbStats.recentActivity.map((log: any, index: number) => (
                            <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '8px' }}>{log.action}</td>
                              <td style={{ padding: '8px' }}>
                                {new Date(log.created_at).toLocaleString('zh-CN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ color: '#666' }}>暂无最近活动记录</div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setDbStatsDialogOpen(false)}>
                关闭
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
