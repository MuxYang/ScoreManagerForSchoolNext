import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  Title2,
  Title3,
  Input,
  Button,
  Card,
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
  Checkbox,
  tokens,
} from '@fluentui/react-components';
import { authAPI, backupAPI } from '../services/api';
import { useToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import PageTitle from '../components/PageTitle';
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
  const { showToast } = useToast();
  const styles = useStyles();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [selectedTab, setSelectedTab] = useState('password');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  // 用户管理
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);

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
    try {
      const response = await backupAPI.getDatabaseStats();
      setDbStats(response.data);
      setDbStatsDialogOpen(true);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '获取数据库统计信息失败', intent: 'error' });
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
    try {
      await backupAPI.optimizeDatabase();
      showToast({ title: '成功', body: '数据库优化成功！', intent: 'success' });
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '数据库优化失败', intent: 'error' });
    } finally {
      setOptimizing(false);
    }
  };

  // 加载用户列表
  const loadUsers = async () => {
    if (!user?.isAdmin) return;
    
    setLoadingUsers(true);
    try {
      const response = await authAPI.getUsers();
      setUsers(response.data.users);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '获取用户列表失败', intent: 'error' });
    } finally {
      setLoadingUsers(false);
    }
  };

  // 创建用户
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newUserPassword) {
      showToast({ title: '错误', body: '用户名和密码是必填的', intent: 'error' });
      return;
    }

    try {
      await authAPI.createUser(newUsername, newUserPassword, mustChangePassword);
      showToast({ title: "成功", body: `用户 ${newUsername} 创建成功！`, intent: "success" });
      setNewUsername('');
      setNewUserPassword('');
      setMustChangePassword(true);
      setCreateUserDialogOpen(false);
      loadUsers(); // 重新加载用户列表
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '创建用户失败', intent: 'error' });
    }
  };

  // 重置用户密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPassword) return;
    
    try {
      await authAPI.resetUserPassword(selectedUser.id, resetPassword);
      showToast({ title: "成功", body: `用户 ${selectedUser.username} 的密码重置成功！`, intent: "success" });
      setResetPassword('');
      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '重置密码失败', intent: 'error' });
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销！`)) {
      return;
    }

    try {
      await authAPI.deleteUser(userId);
      showToast({ title: "成功", body: `用户 ${username} 删除成功！`, intent: "success" });
      loadUsers(); // 重新加载用户列表
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '删除用户失败', intent: 'error' });
    }
  };

  // 生成随机密码
  const generatePassword = async () => {
    try {
      const response = await authAPI.generatePassword(12);
      setNewUserPassword(response.data.password);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '生成密码失败', intent: 'error' });
    }
  };

  // 生成重置密码
  const generateResetPassword = async () => {
    try {
      const response = await authAPI.generatePassword(12);
      setResetPassword(response.data.password);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '生成密码失败', intent: 'error' });
    }
  };


  // 加载用户列表（当选择用户管理tab时）
  useEffect(() => {
    if (selectedTab === 'users' && user?.isAdmin) {
      loadUsers();
    }
  }, [selectedTab, user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast({ title: '错误', body: '两次输入的新密码不一致', intent: 'error' });
      return;
    }

    if (!user?.id) {
      showToast({ title: '错误', body: '用户信息无效，请重新登录', intent: 'error' });
      return;
    }

    try {
      await authAPI.changePassword(user.id, oldPassword, newPassword);
      showToast({ title: '成功', body: '密码修改成功！', intent: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '密码修改失败', intent: 'error' });
    }
  };

  return (
    <div className={styles.container}>
      <PageTitle title="系统设置" subtitle="配置系统参数和用户管理" />

      <TabList
        selectedValue={selectedTab}
        onTabSelect={(_, data) => setSelectedTab(data.value as string)}
      >
        <Tab value="password">密码修改</Tab>
        {user?.isAdmin && <Tab value="users">账号管理</Tab>}
        <Tab value="interface">界面设置</Tab>
        <Tab value="function">功能设置</Tab>
        {user?.isAdmin && <Tab value="database">数据库设置</Tab>}
        <Tab value="language">语言设置</Tab>
      </TabList>

      <Card className={styles.card}>
        {selectedTab === 'password' && (
          <div>
            <Title2>修改密码</Title2>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
              
              <div style={{ padding: "12px", backgroundColor: "var(--colorPaletteGreenBackground2)", borderRadius: "4px", marginTop: "12px" }}>✓ 主题已切换，立即生效！</div>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
              
              <div style={{ padding: "12px", backgroundColor: "var(--colorPaletteGreenBackground2)", borderRadius: "4px", marginTop: "12px" }}>✓ 设置已自动保存</div>
            </div>
          </div>
        )}

        {selectedTab === 'database' && user?.isAdmin && (
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
              
              <div style={{ padding: "12px", backgroundColor: "var(--colorPaletteYellowBackground2)", borderRadius: "4px", marginTop: "12px" }}>⚠️ 数据库维护功能需要管理员权限，请谨慎操作</div>
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
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>
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
              
              <div style={{ padding: "12px", backgroundColor: "var(--colorNeutralBackground3)", borderRadius: "4px", marginTop: "12px" }}>💡 当前版本仅支持简体中文，其他语言正在开发中</div>
            </div>
          </div>
        )}

        {selectedTab === 'users' && user?.isAdmin && (
          <div>
            <Title2>账号管理</Title2>
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Title3>用户列表</Title3>
                <Button 
                  appearance="primary"
                  onClick={() => setCreateUserDialogOpen(true)}
                >
                  新建用户
                </Button>
              </div>
              
              {loadingUsers ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  加载用户列表中...
                </div>
              ) : (
                <div style={{ 
                  border: `1px solid ${tokens.colorNeutralStroke1}`, 
                  borderRadius: tokens.borderRadiusMedium, 
                  overflow: 'hidden' 
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ 
                        backgroundColor: tokens.colorNeutralBackground2, 
                        borderBottom: `1px solid ${tokens.colorNeutralStroke1}` 
                      }}>
                        <th style={{ 
                          textAlign: 'left', 
                          padding: '12px', 
                          fontWeight: 'bold',
                          color: tokens.colorNeutralForeground1
                        }}>用户名</th>
                        <th style={{ 
                          textAlign: 'left', 
                          padding: '12px', 
                          fontWeight: 'bold',
                          color: tokens.colorNeutralForeground1
                        }}>创建时间</th>
                        <th style={{ 
                          textAlign: 'left', 
                          padding: '12px', 
                          fontWeight: 'bold',
                          color: tokens.colorNeutralForeground1
                        }}>状态</th>
                        <th style={{ 
                          textAlign: 'center', 
                          padding: '12px', 
                          fontWeight: 'bold',
                          color: tokens.colorNeutralForeground1
                        }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((listUser, index) => (
                        <tr key={listUser.id} style={{ 
                          borderBottom: index < users.length - 1 ? `1px solid ${tokens.colorNeutralStroke2}` : 'none',
                          backgroundColor: tokens.colorNeutralBackground1
                        }}>
                          <td style={{ 
                            padding: '12px',
                            color: tokens.colorNeutralForeground1
                          }}>
                            {listUser.username}
                            {listUser.username === 'admin' && (
                              <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '12px', 
                                color: tokens.colorBrandForeground1, 
                                fontWeight: 'bold' 
                              }}>
                                (管理员)
                              </span>
                            )}
                          </td>
                          <td style={{ 
                            padding: '12px', 
                            color: tokens.colorNeutralForeground2 
                          }}>
                            {new Date(listUser.created_at).toLocaleString('zh-CN')}
                          </td>
                          <td style={{ 
                            padding: '12px',
                            color: tokens.colorNeutralForeground1
                          }}>
                            {listUser.must_change_password ? (
                              <span style={{ 
                                color: tokens.colorPaletteRedForeground1, 
                                fontSize: '12px' 
                              }}>需要修改密码</span>
                            ) : (
                              <span style={{ 
                                color: tokens.colorPaletteGreenForeground1, 
                                fontSize: '12px' 
                              }}>正常</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {listUser.id !== user?.id && listUser.username !== user?.username && listUser.username !== 'admin' && (
                              <Button
                                appearance="subtle"
                                size="small"
                                onClick={() => {
                                  setSelectedUser(listUser);
                                  setResetPasswordDialogOpen(true);
                                }}
                                style={{ marginRight: '8px' }}
                              >
                                重置密码
                              </Button>
                            )}
                            {listUser.username !== 'admin' && (
                              <Button
                                appearance="subtle"
                                size="small"
                                onClick={() => handleDeleteUser(listUser.id, listUser.username)}
                                style={{ color: tokens.colorPaletteRedForeground1 }}
                              >
                                删除
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ 
                            padding: '20px', 
                            textAlign: 'center', 
                            color: tokens.colorNeutralForeground2,
                            backgroundColor: tokens.colorNeutralBackground1
                          }}>
                            暂无用户数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div style={{ padding: "12px", backgroundColor: "var(--colorNeutralBackground3)", borderRadius: "4px", marginTop: "12px" }}>💡 提示：新创建的用户默认拥有与管理员相同的权限，但无法管理其他用户账户。
                  新用户首次登录时需要修改密码。</div>
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
                      <div style={{ color: tokens.colorNeutralForeground2 }}>暂无最近活动记录</div>
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

      {/* 创建用户对话框 */}
      <Dialog open={createUserDialogOpen} onOpenChange={(_, data) => setCreateUserDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogContent>
              <form onSubmit={handleCreateUser}>
                <div className={styles.formField}>
                  <Label>用户名</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="请输入用户名"
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <Label>密码</Label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="请输入密码"
                      required
                      style={{ flex: 1 }}
                    />
                    <Button 
                      type="button"
                      appearance="secondary" 
                      onClick={generatePassword}
                    >
                      生成
                    </Button>
                  </div>
                  <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, marginTop: '4px' }}>
                    密码要求：至少8位，包含大小写字母和数字/符号
                  </div>
                </div>
                
                <div className={styles.formField}>
                  <Checkbox
                    checked={mustChangePassword}
                    onChange={(_, data) => setMustChangePassword(Boolean(data.checked))}
                    label="用户首次登录时必须修改密码"
                  />
                </div>
              </form>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setCreateUserDialogOpen(false);
                  setNewUsername('');
                  setNewUserPassword('');
                }}
              >
                取消
              </Button>
              <Button appearance="primary" onClick={handleCreateUser}>
                创建用户
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={(_, data) => setResetPasswordDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>重置用户密码</DialogTitle>
            <DialogContent>
              {selectedUser && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <Label>用户：</Label>
                    <span style={{ fontWeight: 'bold', marginLeft: '8px' }}>{selectedUser.username}</span>
                  </div>
                  <form onSubmit={handleResetPassword}>
                    <div className={styles.formField}>
                      <Label>新密码</Label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="请输入新密码"
                          required
                          style={{ flex: 1 }}
                        />
                        <Button 
                          type="button"
                          appearance="secondary" 
                          onClick={generateResetPassword}
                        >
                          生成
                        </Button>
                      </div>
                      <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, marginTop: '4px' }}>
                        用户下次登录时需要修改此密码
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setResetPasswordDialogOpen(false);
                  setSelectedUser(null);
                  setResetPassword('');
                }}
              >
                取消
              </Button>
              <Button appearance="primary" onClick={handleResetPassword}>
                重置密码
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
