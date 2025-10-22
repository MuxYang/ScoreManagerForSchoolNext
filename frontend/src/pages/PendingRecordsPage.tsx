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
  Input,
  Label,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Card,
  Title2,
  Title3,
  Checkbox,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Combobox,
  Option,
} from '@fluentui/react-components';
import { Add20Regular, CheckmarkCircle20Regular, DismissCircle20Regular } from '@fluentui/react-icons';
import { studentAPI, scoreAPI } from '../services/api';

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
  headerButtons: {
    display: 'flex',
    gap: '8px',
  },
  infoCard: {
    padding: '16px',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: '500px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  matchInfo: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
});

interface PendingRecord {
  id?: number;
  studentName?: string;
  class?: string;
  reason: string;
  teacherName: string;
  subject?: string;
  others?: string;
  points?: number;
  createdAt?: string;
}

interface Student {
  id: number;
  student_id: string;
  name: string;
  class: string;
  pinyin?: string;
}

const PendingRecordsPage: React.FC = () => {
  const styles = useStyles();
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PendingRecord | null>(null);
  const [editForm, setEditForm] = useState({
    studentName: '',
    studentId: '',
    class: '',
    reason: '',
    teacherName: '',
    subject: '',
    others: '',
    points: 2,
  });

  // 从后端 API 加载待处理记录
  const loadPendingRecords = async () => {
    try {
      setLoading(true);
      const response = await scoreAPI.getPending();
      const records = response.data.records || [];
      console.log('📋 加载待处理记录:', {
        total: records.length,
        sample: records[0],
        allIds: records.map((r: any) => ({ id: r.id, name: r.studentName || '(未填写)' }))
      });
      setPendingRecords(records);
      setLoading(false);
    } catch (err) {
      console.error('加载待处理记录失败:', err);
      setError('加载待处理记录失败');
      setTimeout(() => setError(''), 3000);
      setLoading(false);
    }
  };

  // 初始加载待处理记录
  useEffect(() => {
    loadPendingRecords();
  }, []);

  // 加载学生列表
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await studentAPI.getAll();
        setStudents(response.data || []);
      } catch (err: any) {
        console.error('加载学生列表失败:', err);
      }
    };

    fetchStudents();
  }, []);

  // 选择/取消选择记录
  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedRecords);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecords(newSelection);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedRecords.size === pendingRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(pendingRecords.map(r => r.id!)));
    }
  };

  // 打开编辑对话框
  const handleEdit = (record: PendingRecord) => {
    setEditingRecord(record);
    
    // 尝试根据现有信息匹配学生
    const matchedStudent = students.find(s => 
      (record.studentName && s.name === record.studentName) ||
      (record.class && s.class === record.class && s.name.includes(record.studentName || ''))
    );

    setEditForm({
      studentName: record.studentName || '',
      studentId: matchedStudent?.student_id || '',
      class: record.class || matchedStudent?.class || '',
      reason: record.reason || '',
      teacherName: record.teacherName || '',
      subject: record.subject || '',
      others: record.others || '',
      points: record.points || 2,
    });
    setEditDialogOpen(true);
  };

  // 保存编辑（直接处理并添加到scores表）
  const handleSaveEdit = async () => {
    if (!editForm.studentName.trim()) {
      setError('请输入学生姓名');
      return;
    }

    // 尝试匹配学生
    const matchedStudent = students.find(s => 
      s.name === editForm.studentName || 
      s.student_id === editForm.studentId ||
      (editForm.class && s.class === editForm.class && s.name === editForm.studentName)
    );

    if (!matchedStudent) {
      setError('未找到匹配的学生，请确认学生姓名或学号');
      return;
    }

    try {
      // 如果有班级和科目但没有教师，提示用户
      if (editForm.class && editForm.subject && !editForm.teacherName.trim()) {
        if (!confirm('未填写教师姓名，系统将尝试根据班级和科目自动匹配教师，是否继续？')) {
          return;
        }
      }

      // 调用后端 resolve API
      await scoreAPI.resolvePending(editingRecord!.id!, matchedStudent.id);
      
      setEditDialogOpen(false);
      setSuccess('记录已处理并添加到扣分记录');
      setTimeout(() => setSuccess(''), 3000);
      
      // 重新加载待处理记录列表
      await loadPendingRecords();
    } catch (err: any) {
      setError(err.response?.data?.error || '处理记录失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  // 批量添加到数据库
  const handleBatchAdd = async () => {
    if (selectedRecords.size === 0) {
      setError('请至少选择一条记录');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const recordsToAdd = pendingRecords.filter(r => selectedRecords.has(r.id!));
    
    // 验证所有记录都有学生姓名
    const invalidRecords = recordsToAdd.filter(r => !r.studentName || !r.studentName.trim());
    if (invalidRecords.length > 0) {
      setError('部分记录缺少学生姓名，请先编辑补充');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const record of recordsToAdd) {
        // 匹配学生
        const matchedStudent = students.find(s => 
          s.name === record.studentName ||
          (record.class && s.class === record.class && s.name === record.studentName)
        );

        if (!matchedStudent) {
          failCount++;
          console.error('未找到匹配的学生:', record.studentName, '可用学生:', students.slice(0, 3));
          continue;
        }

        try {
          console.log('准备处理待处理记录:', { 
            pendingId: record.id, 
            studentId: matchedStudent.id, 
            studentName: matchedStudent.name,
            recordName: record.studentName 
          });
          await scoreAPI.resolvePending(record.id!, matchedStudent.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          console.error('添加记录失败:', {
            record,
            error: err.response?.data || err.message,
            matchedStudent
          });
        }
      }

      // 重新加载待处理记录列表
      await loadPendingRecords();
      setSelectedRecords(new Set());

      if (failCount === 0) {
        setSuccess(`成功添加 ${successCount} 条记录到数据库`);
      } else {
        setSuccess(`成功添加 ${successCount} 条记录，${failCount} 条失败`);
      }
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message || '批量添加失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  // 批量舍弃
  const handleBatchDiscard = async () => {
    if (selectedRecords.size === 0) {
      setError('请至少选择一条记录');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const rejectPromises = Array.from(selectedRecords).map(id => 
        scoreAPI.rejectPending(id)
      );
      
      await Promise.all(rejectPromises);
      
      // 重新加载待处理记录列表
      await loadPendingRecords();
      setSelectedRecords(new Set());
      
      setSuccess(`已舍弃 ${selectedRecords.size} 条记录`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '批量舍弃失败');
      setTimeout(() => setError(''), 3000);
    }
  };

  // 自动匹配学生
  const handleAutoMatchStudent = () => {
    const studentName = editForm.studentName.trim();
    if (!studentName) return;

    const matchedStudent = students.find(s => 
      s.name === studentName || 
      s.student_id === editForm.studentId ||
      (editForm.class && s.class === editForm.class && s.name === studentName)
    );

    if (matchedStudent) {
      setEditForm({
        ...editForm,
        studentId: matchedStudent.student_id,
        class: matchedStudent.class,
      });
      setSuccess('自动匹配成功');
      setTimeout(() => setSuccess(''), 2000);
    } else {
      setError('未找到匹配的学生');
      setTimeout(() => setError(''), 2000);
    }
  };

  const columns: TableColumnDefinition<PendingRecord>[] = [
    createTableColumn<PendingRecord>({
      columnId: 'select',
      renderHeaderCell: () => (
        <Checkbox 
          checked={selectedRecords.size === pendingRecords.length && pendingRecords.length > 0}
          onChange={toggleSelectAll}
        />
      ),
      renderCell: (item) => (
        <Checkbox 
          checked={selectedRecords.has(item.id!)}
          onChange={() => toggleSelection(item.id!)}
        />
      ),
    }),
    createTableColumn<PendingRecord>({
      columnId: 'studentName',
      compare: (a, b) => (a.studentName || '').localeCompare(b.studentName || ''),
      renderHeaderCell: () => '学生姓名',
      renderCell: (item) => (
        <div>
          {item.studentName || <span style={{ color: '#999' }}>未填写</span>}
          <div className={styles.matchInfo}>
            {item.class && `班级: ${item.class}`}
          </div>
        </div>
      ),
    }),
    createTableColumn<PendingRecord>({
      columnId: 'reason',
      compare: (a, b) => a.reason.localeCompare(b.reason),
      renderHeaderCell: () => '原因',
      renderCell: (item) => item.reason,
    }),
    createTableColumn<PendingRecord>({
      columnId: 'teacherName',
      compare: (a, b) => a.teacherName.localeCompare(b.teacherName),
      renderHeaderCell: () => '教师',
      renderCell: (item) => item.teacherName,
    }),
    createTableColumn<PendingRecord>({
      columnId: 'subject',
      compare: (a, b) => (a.subject || '').localeCompare(b.subject || ''),
      renderHeaderCell: () => '科目',
      renderCell: (item) => item.subject || '-',
    }),
    createTableColumn<PendingRecord>({
      columnId: 'points',
      compare: (a, b) => (a.points || 0) - (b.points || 0),
      renderHeaderCell: () => '扣分',
      renderCell: (item) => item.points || 2,
    }),
    createTableColumn<PendingRecord>({
      columnId: 'actions',
      renderHeaderCell: () => '操作',
      renderCell: (item) => (
        <div className={styles.actions}>
          <Button
            appearance="subtle"
            icon={<Add20Regular />}
            onClick={() => handleEdit(item)}
          >
            编辑
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className={styles.container}>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {success && (
        <MessageBar intent="success">
          <MessageBarBody>{success}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.header}>
        <Title2>待处理记录</Title2>
        <div className={styles.headerButtons}>
          <Button
            appearance="primary"
            icon={<CheckmarkCircle20Regular />}
            onClick={handleBatchAdd}
            disabled={selectedRecords.size === 0}
          >
            批量添加 ({selectedRecords.size})
          </Button>
          <Button
            appearance="subtle"
            icon={<DismissCircle20Regular />}
            onClick={handleBatchDiscard}
            disabled={selectedRecords.size === 0}
          >
            批量舍弃 ({selectedRecords.size})
          </Button>
        </div>
      </div>

      <Card className={styles.infoCard}>
        <Title3>说明</Title3>
        <div>
          此页面显示 AI 导入时未能识别学生姓名的记录。请为每条记录补充学生姓名后，系统会自动匹配学号和班级信息。
          您可以多选记录后批量添加到数据库，或选择舍弃不需要的记录。
        </div>
      </Card>

      {pendingRecords.length === 0 ? (
        <Card>
          <div className={styles.emptyState}>
            <Title3>暂无待处理记录</Title3>
            <div>所有 AI 导入的记录都已成功识别学生信息</div>
          </div>
        </Card>
      ) : (
        <DataGrid
          items={pendingRecords}
          columns={columns}
          sortable
          resizableColumns
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody<PendingRecord>>
            {({ item, rowId }) => (
              <DataGridRow<PendingRecord> key={rowId}>
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>编辑待处理记录</DialogTitle>
            <DialogContent>
              <div className={styles.form}>
                <div>
                  <Label required>学生姓名</Label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Combobox
                      style={{ flex: 1 }}
                      placeholder="输入或选择学生姓名"
                      value={editForm.studentName}
                      onOptionSelect={(_, data) => {
                        const student = students.find(s => s.name === data.optionValue);
                        if (student) {
                          setEditForm({
                            ...editForm,
                            studentName: student.name,
                            studentId: student.student_id,
                            class: student.class,
                          });
                        }
                      }}
                      onChange={(e) => setEditForm({ ...editForm, studentName: (e.target as HTMLInputElement).value })}
                    >
                      {students.map(student => (
                        <Option key={student.id} text={student.name} value={student.name}>
                          {student.name} - {student.class}
                        </Option>
                      ))}
                    </Combobox>
                    <Button onClick={handleAutoMatchStudent}>匹配</Button>
                  </div>
                </div>

                <div>
                  <Label>学号</Label>
                  <Input
                    value={editForm.studentId}
                    placeholder="自动匹配或手动输入"
                    disabled
                  />
                </div>

                <div>
                  <Label>班级</Label>
                  <Input
                    value={editForm.class}
                    placeholder="自动匹配"
                    disabled
                  />
                </div>

                <div>
                  <Label required>原因</Label>
                  <Input
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    placeholder="扣分原因"
                  />
                </div>

                <div>
                  <Label required>教师</Label>
                  <Input
                    value={editForm.teacherName}
                    onChange={(e) => setEditForm({ ...editForm, teacherName: e.target.value })}
                    placeholder="教师姓名"
                  />
                </div>

                <div>
                  <Label>科目</Label>
                  <Input
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    placeholder="科目（可选）"
                  />
                </div>

                <div>
                  <Label>扣分</Label>
                  <Input
                    type="number"
                    value={String(editForm.points)}
                    onChange={(e) => setEditForm({ ...editForm, points: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label>其他信息</Label>
                  <Input
                    value={editForm.others}
                    onChange={(e) => setEditForm({ ...editForm, others: e.target.value })}
                    placeholder="其他信息（可选）"
                  />
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" onClick={handleSaveEdit}>
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default PendingRecordsPage;
