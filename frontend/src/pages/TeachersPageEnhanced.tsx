import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Label,
  makeStyles,
  Spinner,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  tokens,
  Subtitle1,
  Body1,
} from '@fluentui/react-components';
import {
  Add20Regular,
  Delete20Regular,
  Edit20Regular,
  Info20Regular,
  ArrowImport20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import { teacherAPI, scoreAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles({
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  subjectGroup: {
    marginBottom: '24px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  subjectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: tokens.colorBrandBackground2,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  subjectTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 600,
    fontSize: '16px',
  },
  subjectPoints: {
    fontWeight: 600,
    fontSize: '18px',
    color: tokens.colorPaletteGreenForeground1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    fontWeight: 600,
    textAlign: 'left' as const,
    padding: '16px 20px',
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  tableCell: {
    padding: '16px 20px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tableRow: {
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: '400px',
  },
  scoresList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  scoreItem: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusSmall,
  },
  pointsPositive: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: 600,
  },
  pointsNegative: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: 600,
  },
});

interface Teacher {
  id: number;
  name: string;
  subject: string;
  phone?: string;
  email?: string;
  teaching_classes?: string;
  total_points?: number;
}

interface GroupedTeachers {
  subject: string;
  teachers: Teacher[];
  total_points: number;
}

interface Score {
  id: number;
  points: number;
  reason: string;
  date: string;
  student_id?: number;
  name?: string;
  class?: string;
}

const TeachersPageEnhanced: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [groupedTeachers, setGroupedTeachers] = useState<GroupedTeachers[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [teacherScores, setTeacherScores] = useState<Score[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    phone: '',
    email: '',
    teaching_classes: '',
  });

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const response = await teacherAPI.getAll();
      
      // 按科目分组并排序
      const grouped = response.data.grouped || [];
      
      // 按总积分排序科目组（从高到低）
      grouped.sort((a: GroupedTeachers, b: GroupedTeachers) => b.total_points - a.total_points);
      
      // 每个组内的教师按积分排序（从高到低）
      grouped.forEach((group: GroupedTeachers) => {
        group.teachers.sort((a: Teacher, b: Teacher) => 
          (b.total_points || 0) - (a.total_points || 0)
        );
      });
      
      setGroupedTeachers(grouped);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载教师列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherScores = async (teacherName: string) => {
    try {
      setLoading(true);
      const response = await scoreAPI.getAll({ teacherName });
      setTeacherScores(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载积分记录失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (subject: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(subject)) {
      newCollapsed.delete(subject);
    } else {
      newCollapsed.add(subject);
    }
    setCollapsedGroups(newCollapsed);
  };

  const handleAdd = () => {
    setFormData({ name: '', subject: '', phone: '', email: '', teaching_classes: '' });
    setAddDialogOpen(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    setFormData({
      name: teacher.name,
      subject: teacher.subject,
      phone: teacher.phone || '',
      email: teacher.email || '',
      teaching_classes: teacher.teaching_classes || '',
    });
    setEditDialogOpen(true);
  };

  const handleDetail = async (teacher: Teacher) => {
    setCurrentTeacher(teacher);
    setDetailDialogOpen(true);
    await loadTeacherScores(teacher.name);
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`确定要删除教师 ${teacher.name} 吗？`)) return;

    try {
      await teacherAPI.delete(teacher.id);
      setSuccess('教师删除成功');
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除教师失败');
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await teacherAPI.create({
        name: formData.name,
        subject: formData.subject,
        phone: formData.phone,
        email: formData.email,
      });
      setSuccess('教师添加成功');
      setAddDialogOpen(false);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '添加教师失败');
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeacher) return;
    setError('');

    try {
      await teacherAPI.update(currentTeacher.id, {
        name: formData.name,
        subject: formData.subject,
        phone: formData.phone,
        email: formData.email,
      });
      setSuccess('教师更新成功');
      setEditDialogOpen(false);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '更新教师失败');
    }
  };

  const handleImport = () => {
    navigate('/import');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Subtitle1>教师管理</Subtitle1>
        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={handleAdd}
          >
            添加教师
          </Button>
          <Button
            appearance="secondary"
            icon={<ArrowImport20Regular />}
            onClick={handleImport}
          >
            批量导入
          </Button>
        </div>
      </div>

      {error && (
        <MessageBar intent="error" style={{ marginBottom: '16px' }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {success && (
        <MessageBar intent="success" style={{ marginBottom: '16px' }}>
          <MessageBarBody>{success}</MessageBarBody>
        </MessageBar>
      )}

      {loading && !detailDialogOpen ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner label="加载中..." />
        </div>
      ) : (
        <div>
          {groupedTeachers.map((group) => (
            <div key={group.subject} className={styles.subjectGroup}>
              <div 
                className={styles.subjectHeader}
                onClick={() => toggleGroup(group.subject)}
              >
                <div className={styles.subjectTitle}>
                  {collapsedGroups.has(group.subject) ? (
                    <ChevronRight20Regular />
                  ) : (
                    <ChevronDown20Regular />
                  )}
                  <span>{group.subject}</span>
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: tokens.colorNeutralForeground3 }}>
                    ({group.teachers.length} 位教师)
                  </span>
                </div>
                <div className={styles.subjectPoints}>
                  总积分: {group.total_points}
                </div>
              </div>

              {!collapsedGroups.has(group.subject) && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.tableHeader}>姓名</th>
                      <th className={styles.tableHeader}>任教班级</th>
                      <th className={styles.tableHeader}>联系电话</th>
                      <th className={styles.tableHeader}>邮箱</th>
                      <th className={styles.tableHeader}>累计积分</th>
                      <th className={styles.tableHeader}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.teachers.map((teacher) => (
                      <tr key={teacher.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>{teacher.name}</td>
                        <td className={styles.tableCell}>
                          {teacher.teaching_classes || '-'}
                        </td>
                        <td className={styles.tableCell}>{teacher.phone || '-'}</td>
                        <td className={styles.tableCell}>{teacher.email || '-'}</td>
                        <td className={styles.tableCell}>
                          <span style={{
                            fontWeight: 600,
                            color: (teacher.total_points || 0) >= 0
                              ? tokens.colorPaletteGreenForeground1
                              : tokens.colorPaletteRedForeground1
                          }}>
                            {teacher.total_points || 0}
                          </span>
                        </td>
                        <td className={styles.tableCell}>
                          <div className={styles.actionButtons}>
                            <Button
                              size="small"
                              icon={<Info20Regular />}
                              onClick={() => handleDetail(teacher)}
                            >
                              详情
                            </Button>
                            <Button
                              size="small"
                              icon={<Edit20Regular />}
                              onClick={() => handleEdit(teacher)}
                            >
                              编辑
                            </Button>
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<Delete20Regular />}
                              onClick={() => handleDelete(teacher)}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}

          {groupedTeachers.length === 0 && !loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: tokens.colorNeutralForeground3 
            }}>
              <Body1>暂无教师数据，点击"添加教师"或"批量导入"开始</Body1>
            </div>
          )}
        </div>
      )}

      {/* 添加教师对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={(_, data) => setAddDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmitAdd}>
            <DialogBody>
              <DialogTitle>添加教师</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <Field label="姓名" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="科目" required>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="任教班级">
                    <Input
                      value={formData.teaching_classes}
                      onChange={(e) => setFormData({ ...formData, teaching_classes: e.target.value })}
                      placeholder="例如：一班;二班;三班"
                    />
                  </Field>
                  <Field label="联系电话">
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="邮箱">
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      type="email"
                    />
                  </Field>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">取消</Button>
                </DialogTrigger>
                <Button type="submit" appearance="primary">
                  添加
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      {/* 编辑教师对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmitEdit}>
            <DialogBody>
              <DialogTitle>编辑教师</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <Field label="姓名" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="科目" required>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="任教班级">
                    <Input
                      value={formData.teaching_classes}
                      onChange={(e) => setFormData({ ...formData, teaching_classes: e.target.value })}
                      placeholder="例如：一班;二班;三班"
                    />
                  </Field>
                  <Field label="联系电话">
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="邮箱">
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      type="email"
                    />
                  </Field>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">取消</Button>
                </DialogTrigger>
                <Button type="submit" appearance="primary">
                  保存
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      {/* 教师详情对话框（积分记录） */}
      <Dialog open={detailDialogOpen} onOpenChange={(_, data) => setDetailDialogOpen(data.open)}>
        <DialogSurface style={{ maxWidth: '600px' }}>
          <DialogBody>
            <DialogTitle>教师积分记录</DialogTitle>
            <DialogContent>
              {currentTeacher && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <Label>姓名：{currentTeacher.name}</Label><br />
                    <Label>科目：{currentTeacher.subject}</Label><br />
                    <Label>累计积分：
                      <span style={{
                        fontWeight: 600,
                        fontSize: '18px',
                        color: (currentTeacher.total_points || 0) >= 0
                          ? tokens.colorPaletteGreenForeground1
                          : tokens.colorPaletteRedForeground1
                      }}>
                        {currentTeacher.total_points || 0}
                      </span>
                    </Label>
                  </div>

                  <div className={styles.scoresList}>
                    {loading ? (
                      <Spinner label="加载积分记录中..." />
                    ) : teacherScores.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: tokens.colorNeutralForeground3 }}>
                        暂无积分记录
                      </div>
                    ) : (
                      teacherScores.map((score) => (
                        <div key={score.id} className={styles.scoreItem}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className={score.points >= 0 ? styles.pointsPositive : styles.pointsNegative}>
                              {score.points >= 0 ? '+' : ''}{score.points} 分
                            </span>
                            <span style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                              {score.date}
                            </span>
                          </div>
                          <div style={{ fontSize: '14px' }}>
                            {score.reason}
                          </div>
                          {score.name && score.class && (
                            <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3, marginTop: '4px' }}>
                              学生：{score.name} ({score.class})
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary">关闭</Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default TeachersPageEnhanced;
