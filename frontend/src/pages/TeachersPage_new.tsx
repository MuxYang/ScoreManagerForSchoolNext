import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  makeStyles,
  Spinner,
  MessageBar,
  MessageBarBody,
  Textarea,
  Field,
} from '@fluentui/react-components';
import { Add20Regular, Delete20Regular, Edit20Regular, ArrowImport20Regular, ArrowExport20Regular } from '@fluentui/react-icons';
import { studentAPI } from '../services/api';

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
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px',
  },
});

interface Student {
  id: number;
  student_id: string;
  name: string;
  class: string;
}

const StudentsPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [importData, setImportData] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    class: '',
  });

  // 分页计算
  const totalPages = Math.ceil(students.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentStudents = students.slice(startIndex, endIndex);

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

  const handleAdd = () => {
    setEditingStudent(null);
    setFormData({ student_id: '', name: '', class: '' });
    setDialogOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      student_id: student.student_id,
      name: student.name,
      class: student.class,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个学生吗？')) return;

    try {
      await studentAPI.delete(id);
      setSuccess('学生删除成功');
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除学生失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingStudent) {
        await studentAPI.update(editingStudent.id, {
          studentId: formData.student_id,
          name: formData.name,
          studentClass: formData.class,
        });
        setSuccess('学生更新成功');
      } else {
        await studentAPI.create({
          studentId: formData.student_id,
          name: formData.name,
          studentClass: formData.class,
        });
        setSuccess('学生添加成功');
      }
      setDialogOpen(false);
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  // 处理导入
  const handleImport = async () => {
    setError('');
    setSuccess('');
    
    try {
      const lines = importData.trim().split('\n');
      const students = lines.map(line => {
        const [studentId, name, studentClass] = line.split(/[,\t]/);
        return { studentId: studentId.trim(), name: name.trim(), studentClass: studentClass.trim() };
      }).filter(s => s.studentId && s.name && s.studentClass);

      if (students.length === 0) {
        setError('没有有效的学生数据');
        return;
      }

      // 批量导入
      for (const student of students) {
        await studentAPI.create(student);
      }

      setSuccess(`成功导入 ${students.length} 个学生`);
      setImportDialogOpen(false);
      setImportData('');
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '导入失败');
    }
  };

  // 处理导出
  const handleExport = () => {
    setError('');
    
    let exportStudents = [...students];
    
    // 如果指定了日期范围，根据创建时间筛选（这里简化处理，实际应该在API中实现）
    if (exportStartDate || exportEndDate) {
      const start = exportStartDate ? new Date(exportStartDate) : new Date(0);
      const end = exportEndDate ? new Date(exportEndDate) : new Date();
      
      // 注意：这里假设students有created_at字段，如果没有则导出全部
      // exportStudents = exportStudents.filter(s => {
      //   const createdAt = new Date(s.created_at);
      //   return createdAt >= start && createdAt <= end;
      // });
    }

    // 生成CSV内容
    const csvContent = [
      ['学号', '姓名', '班级'].join(','),
      ...exportStudents.map(s => [s.student_id, s.name, s.class].join(','))
    ].join('\n');

    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess(`成功导出 ${exportStudents.length} 个学生`);
    setExportDialogOpen(false);
  };

  const columns: TableColumnDefinition<Student>[] = [
    createTableColumn<Student>({
      columnId: 'student_id',
      renderHeaderCell: () => '学号',
      renderCell: (item) => item.student_id,
    }),
    createTableColumn<Student>({
      columnId: 'name',
      renderHeaderCell: () => '姓名',
      renderCell: (item) => item.name,
    }),
    createTableColumn<Student>({
      columnId: 'class',
      renderHeaderCell: () => '班级',
      renderCell: (item) => item.class,
    }),
    createTableColumn<Student>({
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
        <h2>学生管理</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            appearance="secondary"
            icon={<ArrowImport20Regular />}
            onClick={() => setImportDialogOpen(true)}
          >
            批量导入
          </Button>
          <Button
            appearance="secondary"
            icon={<ArrowExport20Regular />}
            onClick={() => setExportDialogOpen(true)}
          >
            批量导出
          </Button>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={handleAdd}
          >
            添加学生
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

      {loading ? (
        <Spinner label="加载中..." />
      ) : (
        <>
          <DataGrid
            items={currentStudents}
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
            <DataGridBody<Student>>
              {({ item, rowId }) => (
                <DataGridRow<Student> key={rowId}>
                  {({ renderCell }) => (
                    <DataGridCell>{renderCell(item)}</DataGridCell>
                  )}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                appearance="secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span>
                第 {currentPage} 页，共 {totalPages} 页 (总计 {students.length} 条记录)
              </span>
              <Button
                appearance="secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <DialogTitle>{editingStudent ? '编辑学生' : '添加学生'}</DialogTitle>
              <DialogContent>
                <div className={styles.form}>
                  <div>
                    <Label required>学号</Label>
                    <Input
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label required>姓名</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label required>班级</Label>
                    <Input
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
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
                  {editingStudent ? '更新' : '添加'}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={(_, data) => setImportDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>批量导入学生</DialogTitle>
            <DialogContent>
              <div className={styles.form}>
                <Field label="导入数据" required hint="每行一个学生，格式：学号,姓名,班级（或用Tab分隔）">
                  <Textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="例如：&#10;20230001,张三,高一(1)班&#10;20230002,李四,高一(2)班"
                    rows={10}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Field>
                <div style={{ color: '#666', fontSize: '12px' }}>
                  <div>• 支持逗号或Tab分隔</div>
                  <div>• 每行格式：学号,姓名,班级</div>
                  <div>• 示例：20230001,张三,高一(1)班</div>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleImport}>
                导入
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 导出对话框 */}
      <Dialog open={exportDialogOpen} onOpenChange={(_, data) => setExportDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>导出学生数据</DialogTitle>
            <DialogContent>
              <div className={styles.form}>
                <Field label="开始日期" hint="可选，留空表示不限制">
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </Field>
                <Field label="结束日期" hint="可选，留空表示不限制">
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </Field>
                <div style={{ color: '#666', fontSize: '12px' }}>
                  <div>• 将导出为 CSV 格式文件</div>
                  <div>• 包含学号、姓名、班级信息</div>
                  <div>• 可用 Excel 打开</div>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleExport}>
                导出
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default StudentsPage;
