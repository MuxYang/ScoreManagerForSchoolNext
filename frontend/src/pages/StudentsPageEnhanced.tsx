import React, { useState, useEffect, useMemo } from 'react';
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
  Select,
  Checkbox,
} from '@fluentui/react-components';
import { 
  Add20Regular, 
  Delete20Regular, 
  Edit20Regular, 
  Info20Regular,
  ArrowImport20Regular,
  ArrowUp20Regular,
  ArrowDown20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import { studentAPI, scoreAPI } from '../services/api';
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    fontWeight: 600,
    textAlign: 'left' as const,
    padding: '16px',
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  tableCell: {
    padding: '16px',
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

interface Student {
  id: number;
  student_id: string;
  name: string;
  class: string;
  total_points?: number;
}

interface Score {
  id: number;
  student_id: number;
  points: number;
  reason: string;
  teacher_name: string;
  date: string;
}

const StudentsPageEnhanced: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [studentScores, setStudentScores] = useState<Score[]>([]);
  
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    class: '',
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getAll();
      setStudents(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载学生列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStudentScores = async (studentId: number) => {
    try {
      setLoading(true);
      const response = await scoreAPI.getAll({ studentId });
      setStudentScores(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载量化记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ student_id: '', name: '', class: '' });
    setAddDialogOpen(true);
  };

  const handleEdit = (student: Student) => {
    setCurrentStudent(student);
    setFormData({
      student_id: student.student_id,
      name: student.name,
      class: student.class,
    });
    setEditDialogOpen(true);
  };

  const handleDetail = async (student: Student) => {
    setCurrentStudent(student);
    setDetailDialogOpen(true);
    await loadStudentScores(student.id);
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`确定要删除学生 ${student.name} 吗？`)) return;

    try {
      await studentAPI.delete(student.id);
      setSuccess('学生删除成功');
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除学生失败');
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await studentAPI.create({
        studentId: formData.student_id,
        name: formData.name,
        studentClass: formData.class,
      });
      setSuccess('学生添加成功');
      setAddDialogOpen(false);
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '添加学生失败');
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;
    setError('');

    try {
      await studentAPI.update(currentStudent.id, {
        studentId: formData.student_id,
        name: formData.name,
        studentClass: formData.class,
      });
      setSuccess('学生更新成功');
      setEditDialogOpen(false);
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '更新学生失败');
    }
  };

  const handleImport = () => {
    navigate('/import');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Subtitle1>学生管理</Subtitle1>
        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={handleAdd}
          >
            添加学生
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
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.tableHeader}>学号</th>
              <th className={styles.tableHeader}>姓名</th>
              <th className={styles.tableHeader}>班级</th>
              <th className={styles.tableHeader}>累计量化</th>
              <th className={styles.tableHeader}>操作</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className={styles.tableRow}>
                <td className={styles.tableCell}>{student.student_id}</td>
                <td className={styles.tableCell}>{student.name}</td>
                <td className={styles.tableCell}>{student.class}</td>
                <td className={styles.tableCell}>
                  <span style={{ 
                    fontWeight: 600,
                    color: (student.total_points || 0) >= 0 
                      ? tokens.colorPaletteGreenForeground1 
                      : tokens.colorPaletteRedForeground1
                  }}>
                    {student.total_points || 0}
                  </span>
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionButtons}>
                    <Button
                      size="small"
                      icon={<Info20Regular />}
                      onClick={() => handleDetail(student)}
                    >
                      详情
                    </Button>
                    <Button
                      size="small"
                      icon={<Edit20Regular />}
                      onClick={() => handleEdit(student)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<Delete20Regular />}
                      onClick={() => handleDelete(student)}
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

      {/* 添加学生对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={(_, data) => setAddDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmitAdd}>
            <DialogBody>
              <DialogTitle>添加学生</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <Field label="学号" required>
                    <Input
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="姓名" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="班级" required>
                    <Input
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      required
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

      {/* 编辑学生对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmitEdit}>
            <DialogBody>
              <DialogTitle>编辑学生</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <Field label="学号" required>
                    <Input
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="姓名" required>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="班级" required>
                    <Input
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      required
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

      {/* 学生详情对话框（量化记录） */}
      <Dialog open={detailDialogOpen} onOpenChange={(_, data) => setDetailDialogOpen(data.open)}>
        <DialogSurface style={{ maxWidth: '600px' }}>
          <DialogBody>
            <DialogTitle>学生量化记录</DialogTitle>
            <DialogContent>
              {currentStudent && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <Label>学号：{currentStudent.student_id}</Label><br/>
                    <Label>姓名：{currentStudent.name}</Label><br/>
                    <Label>班级：{currentStudent.class}</Label><br/>
                    <Label>累计量化：
                      <span style={{
                        fontWeight: 600,
                        fontSize: '18px',
                        color: (currentStudent.total_points || 0) >= 0
                          ? tokens.colorPaletteGreenForeground1
                          : tokens.colorPaletteRedForeground1
                      }}>
                        {currentStudent.total_points || 0}
                      </span>
                    </Label>
                  </div>

                  <div className={styles.scoresList}>
                    {loading ? (
                      <Spinner label="加载量化记录中..." />
                    ) : studentScores.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: tokens.colorNeutralForeground3 }}>
                        暂无量化记录
                      </div>
                    ) : (
                      studentScores.map((score) => (
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
                          {score.teacher_name && (
                            <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3, marginTop: '4px' }}>
                              教师：{score.teacher_name}
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

export default StudentsPageEnhanced;
