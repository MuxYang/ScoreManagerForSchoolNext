import React, { useState, useEffect } from 'react';
import {
  Button,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridCell,
  TableColumnDefinition,
  createTableColumn,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Label,
  Select,
  makeStyles,
  Spinner,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { Add20Regular, Delete20Regular, Edit20Regular } from '@fluentui/react-icons';
import { scoreAPI, studentAPI } from '../services/api';

const useStyles = makeStyles({
  container: {
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: '400px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  filters: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
  },
});

interface Score {
  id: number;
  student_id: number;
  points: number;
  reason: string;
  teacher_name: string;
  date: string;
  name?: string;
  student_id_display?: string;
  class?: string;
}

interface Student {
  id: number;
  student_id: string;
  name: string;
  class: string;
}

const ScoresPage: React.FC = () => {
  const styles = useStyles();
  const [scores, setScores] = useState<Score[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [formData, setFormData] = useState({
    studentId: '',
    points: '',
    reason: '',
    teacherName: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadScores();
    loadStudents();
  }, []);

  const loadScores = async () => {
    try {
      setLoading(true);
      const response = await scoreAPI.getAll();
      setScores(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载积分记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await studentAPI.getAll();
      setStudents(response.data);
    } catch (err: any) {
      console.error('加载学生列表失败:', err);
    }
  };

  const handleAdd = () => {
    setEditingScore(null);
    setFormData({
      studentId: '',
      points: '',
      reason: '',
      teacherName: '',
      date: new Date().toISOString().split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleEdit = (score: Score) => {
    setEditingScore(score);
    setFormData({
      studentId: score.student_id.toString(),
      points: score.points.toString(),
      reason: score.reason || '',
      teacherName: score.teacher_name || '',
      date: score.date,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条积分记录吗？')) return;

    try {
      await scoreAPI.delete(id);
      setSuccess('积分记录删除成功');
      loadScores();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除积分记录失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const data = {
        studentId: parseInt(formData.studentId),
        points: parseFloat(formData.points),
        reason: formData.reason,
        teacherName: formData.teacherName,
        date: formData.date,
      };

      if (editingScore) {
        await scoreAPI.update(editingScore.id, data);
        setSuccess('积分记录更新成功');
      } else {
        await scoreAPI.create(data);
        setSuccess('积分记录添加成功');
      }
      setDialogOpen(false);
      loadScores();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  const columns: TableColumnDefinition<Score>[] = [
    createTableColumn<Score>({
      columnId: 'student',
      renderHeaderCell: () => '学生',
      renderCell: (item) => `${item.name} (${item.student_id_display})`,
    }),
    createTableColumn<Score>({
      columnId: 'class',
      renderHeaderCell: () => '班级',
      renderCell: (item) => item.class,
    }),
    createTableColumn<Score>({
      columnId: 'points',
      renderHeaderCell: () => '积分',
      renderCell: (item) => item.points,
    }),
    createTableColumn<Score>({
      columnId: 'reason',
      renderHeaderCell: () => '原因',
      renderCell: (item) => item.reason || '-',
    }),
    createTableColumn<Score>({
      columnId: 'teacher',
      renderHeaderCell: () => '教师',
      renderCell: (item) => item.teacher_name || '-',
    }),
    createTableColumn<Score>({
      columnId: 'date',
      renderHeaderCell: () => '日期',
      renderCell: (item) => item.date,
    }),
    createTableColumn<Score>({
      columnId: 'actions',
      renderHeaderCell: () => '操作',
      renderCell: (item) => (
        <div className={styles.actions}>
          <Button
            size="small"
            icon={<Edit20Regular />}
            onClick={() => handleEdit(item)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<Delete20Regular />}
            onClick={() => handleDelete(item.id)}
          >
            删除
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>积分管理</h2>
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={handleAdd}
        >
          添加积分记录
        </Button>
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

      {loading ? (
        <Spinner label="加载中..." />
      ) : (
        <DataGrid
          items={scores}
          columns={columns}
          sortable
          getRowId={(item) => item.id.toString()}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<Score>>
            {({ item, rowId }) => (
              <DataGridRow<Score> key={rowId}>
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <DialogTitle>{editingScore ? '编辑积分记录' : '添加积分记录'}</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <div>
                    <Label required>学生</Label>
                    <Select
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      required
                    >
                      <option value="">请选择学生</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} - {student.student_id} ({student.class})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label required>积分</Label>
                    <Input
                      type="number"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>原因</Label>
                    <Input
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>教师姓名</Label>
                    <Input
                      value={formData.teacherName}
                      onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label required>日期</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">取消</Button>
                </DialogTrigger>
                <Button type="submit" appearance="primary">
                  {editingScore ? '更新' : '添加'}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default ScoresPage;
