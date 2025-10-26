import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  makeStyles,
  Title2,
  Card,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  MessageBar,
  MessageBarBody,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridBody,
  DataGridCell,
  createTableColumn,
  TableColumnDefinition,
  Field,
  Textarea,
} from '@fluentui/react-components';
import { AddRegular, EditRegular, DeleteRegular, ArrowImport20Regular, ArrowExport20Regular } from '@fluentui/react-icons';
import { teacherAPI } from '../services/api';

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
  formField: {
    marginBottom: '16px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
});

interface Teacher {
  id: number;
  name: string;
  subject: string;
  grade?: string;
  phone?: string;
  email?: string;
  total_points?: number;
}

interface GroupedTeachers {
  subject: string;
  teachers: Teacher[];
  total_points: number;
}

const TeachersPage: React.FC = () => {
  const styles = useStyles();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groupedTeachers, setGroupedTeachers] = useState<GroupedTeachers[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [importData, setImportData] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    grade: '',
    phone: '',
    email: '',
  });

  const loadTeachers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await teacherAPI.getAll();
      setTeachers(response.data.teachers || response.data);
      setGroupedTeachers(response.data.grouped || []);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载教师列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleOpenDialog = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({
        name: teacher.name,
        subject: teacher.subject,
        grade: teacher.grade || '',
        phone: teacher.phone || '',
        email: teacher.email || '',
      });
    } else {
      setEditingTeacher(null);
      setFormData({
        name: '',
        subject: '',
        grade: '',
        phone: '',
        email: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!formData.name.trim() || !formData.subject.trim()) {
      setError('请填写教师姓名和科目');
      return;
    }

    try {
      if (editingTeacher) {
        await teacherAPI.update(editingTeacher.id, formData);
        setSuccess('教师信息更新成功');
      } else {
        await teacherAPI.create(formData);
        setSuccess('教师添加成功');
      }
      setDialogOpen(false);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该教师吗？')) {
      return;
    }

    try {
      await teacherAPI.delete(id);
      setSuccess('教师删除成功');
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  // 处理导入
  const handleImport = async () => {
    setError('');
    setSuccess('');
    
    try {
      const lines = importData.trim().split('\n');
      const teachersToImport = lines.map(line => {
        const [name, subject, grade, phone, email] = line.split(/[,\t]/);
        return { 
          name: name?.trim() || '', 
          subject: subject?.trim() || '', 
          grade: grade?.trim() || '',
          phone: phone?.trim() || '', 
          email: email?.trim() || '' 
        };
      }).filter(t => t.name && t.subject);

      if (teachersToImport.length === 0) {
        setError('没有有效的教师数据');
        return;
      }

      // 批量导入
      for (const teacher of teachersToImport) {
        await teacherAPI.create(teacher);
      }

      setSuccess(`成功导入 ${teachersToImport.length} 位教师`);
      setImportDialogOpen(false);
      setImportData('');
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.error || '导入失败');
    }
  };

  // 处理导出量化记录
  const handleExport = async () => {
    setError('');
    
    if (!exportStartDate || !exportEndDate) {
      setError('请选择开始日期和结束日期');
      return;
    }

    if (exportStartDate > exportEndDate) {
      setError('开始日期不能晚于结束日期');
      return;
    }

    try {
      setLoading(true);
      const response = await teacherAPI.exportRecords(exportStartDate, exportEndDate);
      
      // 下载文件
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `教师量化记录-${exportStartDate}-${exportEndDate}.xlsx`;
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`成功导出教师量化记录`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
    } catch (err: any) {
      // 处理Blob类型的错误响应
      let errorMessage = '导出失败';
      
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.error || errorMessage;
        } catch {
          // Blob解析失败，使用默认错误消息
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumnDefinition<Teacher>[] = [
    createTableColumn<Teacher>({
      columnId: 'name',
      renderHeaderCell: () => '姓名',
      renderCell: (teacher) => teacher.name,
    }),
    createTableColumn<Teacher>({
      columnId: 'subject',
      renderHeaderCell: () => '科目',
      renderCell: (teacher) => teacher.subject,
    }),
    createTableColumn<Teacher>({
      columnId: 'grade',
      renderHeaderCell: () => '年级',
      renderCell: (teacher) => teacher.grade || '-',
    }),
    createTableColumn<Teacher>({
      columnId: 'total_points',
      renderHeaderCell: () => '积分总和',
      renderCell: (teacher) => (
        <span style={{ fontWeight: 'bold', color: teacher.total_points && teacher.total_points > 0 ? '#107c10' : '#d13438' }}>
          {teacher.total_points?.toFixed(1) || '0.0'}
        </span>
      ),
    }),
    createTableColumn<Teacher>({
      columnId: 'phone',
      renderHeaderCell: () => '联系电话',
      renderCell: (teacher) => teacher.phone || '-',
    }),
    createTableColumn<Teacher>({
      columnId: 'email',
      renderHeaderCell: () => '电子邮箱',
      renderCell: (teacher) => teacher.email || '-',
    }),
    createTableColumn<Teacher>({
      columnId: 'actions',
      renderHeaderCell: () => '操作',
      renderCell: (teacher) => (
        <div className={styles.actions}>
          <Button
            size="small"
            icon={<EditRegular />}
            onClick={() => handleOpenDialog(teacher)}
          >
            编辑
          </Button>
          <Button
            size="small"
            icon={<DeleteRegular />}
            onClick={() => handleDelete(teacher.id)}
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
        <Title2>教师管理</Title2>
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
            导出量化记录
          </Button>
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => handleOpenDialog()}
          >
            添加教师
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
        <div>加载中...</div>
      ) : groupedTeachers.length > 0 ? (
        <div>
          {groupedTeachers.map((group) => (
            <div key={group.subject} style={{ marginBottom: '24px' }}>
              <Card style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '12px',
                padding: '12px'
              }}>
                <Title2 style={{ margin: 0 }}>{group.subject}</Title2>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: group.total_points > 0 ? '#107c10' : '#d13438'
                }}>
                  科目总分: {group.total_points.toFixed(1)}
                </span>
                <span style={{ fontSize: '14px', opacity: 0.7 }}>
                  ({group.teachers.length} 位教师)
                </span>
              </Card>
              <DataGrid
                items={group.teachers}
                columns={columns}
                sortable
                getRowId={(item) => item.id}
              >
                <DataGridHeader>
                  <DataGridRow>
                    {({ renderHeaderCell }) => (
                      <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                    )}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<Teacher>>
                  {({ item, rowId }) => (
                    <DataGridRow<Teacher> key={rowId}>
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
            </div>
          ))}
        </div>
      ) : (
        <DataGrid
          items={teachers}
          columns={columns}
          sortable
          getRowId={(item) => item.id}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<Teacher>>
            {({ item, rowId }) => (
              <DataGridRow<Teacher> key={rowId}>
                {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{editingTeacher ? '编辑教师' : '添加教师'}</DialogTitle>
            <DialogContent>
              <div className={styles.formField}>
                <label>姓名 *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formField}>
                <label>科目 *</label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formField}>
                <label>年级</label>
                <Input
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="例如：高一、高二、高三"
                />
              </div>

              <div className={styles.formField}>
                <label>联系电话</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className={styles.formField}>
                <label>电子邮箱</label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={handleSubmit}>
                {editingTeacher ? '更新' : '添加'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={(_, data) => setImportDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>批量导入教师</DialogTitle>
            <DialogContent>
              <div className={styles.formField}>
                <Field label="导入数据" required hint="每行一位教师，格式：姓名,科目,年级,联系电话,电子邮箱（或用Tab分隔）">
                  <Textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="例如：&#10;张三,数学,高一,13800138000,zhangsan@example.com&#10;李四,英语,高二,13900139000,lisi@example.com"
                    rows={10}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Field>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                  <div>• 支持逗号或Tab分隔</div>
                  <div>• 每行格式：姓名,科目,年级,联系电话,电子邮箱</div>
                  <div>• 年级、电话和邮箱可选</div>
                  <div>• 示例：张三,数学,高一,13800138000,zhangsan@example.com</div>
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
            <DialogTitle>导出教师量化记录</DialogTitle>
            <DialogContent>
              <div className={styles.formField}>
                <Field label="开始日期" required hint="必填">
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </Field>
                <Field label="结束日期" required hint="必填">
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </Field>
                <MessageBar intent="info" style={{ marginTop: '12px' }}>
                  <MessageBarBody>
                    <div>• 将导出为 Excel (XLSX) 格式文件</div>
                    <div>• 按科目组和教师分组统计</div>
                    <div>• 包含科目组累计分数、教师分数及详细量化记录</div>
                  </MessageBarBody>
                </MessageBar>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button 
                appearance="primary" 
                onClick={handleExport}
                disabled={!exportStartDate || !exportEndDate || loading}
              >
                {loading ? '导出中...' : '导出'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default TeachersPage;

