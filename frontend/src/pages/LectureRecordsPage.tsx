import React, { useState, useEffect } from 'react';
import {
  Card,
  Title2,
  Title3,
  Body1,
  Button,
  Input,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Field,
  DataGrid,
  DataGridBody,
  DataGridRow,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridCell,
  TableCellLayout,
  TableColumnDefinition,
  createTableColumn,
  makeStyles,
  tokens,
  Spinner,
  useToastController,
  Toast,
  ToastTitle,
  Toaster,
  useId,
} from '@fluentui/react-components';
import {
  Add20Regular,
  Edit20Regular,
  Delete20Regular,
  ArrowExport20Regular,
  CalendarLtr20Regular,
} from '@fluentui/react-icons';
import { lectureRecordsAPI } from '../services/api';
import { useToast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import PageTitle from '../components/PageTitle';

const useStyles = makeStyles({
  container: {
    padding: '32px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterSection: {
    marginBottom: '24px',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },
  tableCard: {
    padding: '0',
    overflow: 'hidden',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  dialogContent: {
    minWidth: '500px',
  },
});

interface LectureRecord {
  id: number;
  observer_teacher_name: string;
  teaching_teacher_name: string;
  class: string;
  date: string;
  notes?: string;
  created_at: string;
}

const LectureRecordsPage: React.FC = () => {
  const { showToast } = useToast();
  const styles = useStyles();
  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);
  const { user } = useAuth();

  const [records, setRecords] = useState<LectureRecord[]>([]);
  const [loading, setLoading] = useState(false);


  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [observerNameFilter, setObserverNameFilter] = useState('');
  const [teachingNameFilter, setTeachingNameFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // Batch selection
  const [selectedRecords, setSelectedRecords] = useState<Set<number>>(new Set());

  // Form states
  const [formData, setFormData] = useState({
    observerTeacherName: '',
    teachingTeacherName: '',
    className: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [currentRecord, setCurrentRecord] = useState<LectureRecord | null>(null);

  // Export states
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Statistics states
  const [statistics, setStatistics] = useState<any>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  // Fetch records
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (observerNameFilter) filters.observerName = observerNameFilter;
      if (teachingNameFilter) filters.teachingName = teachingNameFilter;
      if (classFilter) filters.className = classFilter;

      const response = await lectureRecordsAPI.getAll(filters);
      setRecords(response.data);
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '加载听课记录失败', intent: 'error' });
      dispatchToast(
        <Toast>
          <ToastTitle>加载失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    setLoadingStatistics(true);
    try {
      const response = await lectureRecordsAPI.getStatistics();
      setStatistics(response.data);
    } catch (err: any) {
      console.error('Failed to fetch statistics:', err);
      dispatchToast(
        <Toast>
          <ToastTitle>统计加载失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setLoadingStatistics(false);
    }
  };

  const hasFetched = React.useRef(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      showToast({ title: '错误', body: '请先登录', intent: 'error' });
      return;
    }
    
    // Prevent duplicate calls in React StrictMode (development only)
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    fetchRecords();
    fetchStatistics();
  }, [user]);

  // Handle add
  const handleAdd = async () => {
    try {
      await lectureRecordsAPI.create(formData);
      dispatchToast(
        <Toast>
          <ToastTitle>听课记录添加成功</ToastTitle>
        </Toast>,
        { intent: 'success' }
      );
      setAddDialogOpen(false);
      setFormData({
        observerTeacherName: '',
        teachingTeacherName: '',
        className: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      fetchRecords();
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>添加失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!currentRecord) return;
    try {
      await lectureRecordsAPI.update(currentRecord.id, formData);
      dispatchToast(
        <Toast>
          <ToastTitle>听课记录更新成功</ToastTitle>
        </Toast>,
        { intent: 'success' }
      );
      setEditDialogOpen(false);
      setCurrentRecord(null);
      fetchRecords();
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>更新失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!currentRecord) return;
    try {
      await lectureRecordsAPI.delete(currentRecord.id);
      dispatchToast(
        <Toast>
          <ToastTitle>听课记录删除成功</ToastTitle>
        </Toast>,
        { intent: 'success' }
      );
      setDeleteDialogOpen(false);
      setCurrentRecord(null);
      fetchRecords();
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>删除失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await lectureRecordsAPI.export(exportStartDate, exportEndDate);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `教师听课记录_${exportStartDate || 'all'}_${exportEndDate || 'all'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      dispatchToast(
        <Toast>
          <ToastTitle>听课记录导出成功</ToastTitle>
        </Toast>,
        { intent: 'success' }
      );
      setExportDialogOpen(false);
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>导出失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setExporting(false);
    }
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    try {
      // Delete all selected records
      await Promise.all(
        Array.from(selectedRecords).map(id => lectureRecordsAPI.delete(id))
      );
      
      dispatchToast(
        <Toast>
          <ToastTitle>成功删除 {selectedRecords.size} 条记录</ToastTitle>
        </Toast>,
        { intent: 'success' }
      );
      
      setSelectedRecords(new Set());
      setBatchDeleteDialogOpen(false);
      fetchRecords();
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>批量删除失败：{err.response?.data?.error || '未知错误'}</ToastTitle>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  // Table columns
  const columns: TableColumnDefinition<LectureRecord>[] = [
    createTableColumn<LectureRecord>({
      columnId: 'select',
      renderHeaderCell: () => (
        <input
          type="checkbox"
          checked={selectedRecords.size === records.length && records.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRecords(new Set(records.map(r => r.id)));
            } else {
              setSelectedRecords(new Set());
            }
          }}
        />
      ),
      renderCell: (item) => (
        <input
          type="checkbox"
          checked={selectedRecords.has(item.id)}
          onChange={(e) => {
            const newSet = new Set(selectedRecords);
            if (e.target.checked) {
              newSet.add(item.id);
            } else {
              newSet.delete(item.id);
            }
            setSelectedRecords(newSet);
          }}
        />
      ),
    }),
    createTableColumn<LectureRecord>({
      columnId: 'date',
      compare: (a, b) => a.date.localeCompare(b.date),
      renderHeaderCell: () => '日期',
      renderCell: (item) => <TableCellLayout>{item.date}</TableCellLayout>,
    }),
    createTableColumn<LectureRecord>({
      columnId: 'observer',
      compare: (a, b) => a.observer_teacher_name.localeCompare(b.observer_teacher_name),
      renderHeaderCell: () => '听课教师',
      renderCell: (item) => <TableCellLayout>{item.observer_teacher_name}</TableCellLayout>,
    }),
    createTableColumn<LectureRecord>({
      columnId: 'teaching',
      compare: (a, b) => a.teaching_teacher_name.localeCompare(b.teaching_teacher_name),
      renderHeaderCell: () => '授课教师',
      renderCell: (item) => <TableCellLayout>{item.teaching_teacher_name}</TableCellLayout>,
    }),
    createTableColumn<LectureRecord>({
      columnId: 'class',
      compare: (a, b) => a.class.localeCompare(b.class),
      renderHeaderCell: () => '班级',
      renderCell: (item) => <TableCellLayout>{item.class}</TableCellLayout>,
    }),
    createTableColumn<LectureRecord>({
      columnId: 'notes',
      renderHeaderCell: () => '备注',
      renderCell: (item) => (
        <TableCellLayout truncate title={item.notes}>
          {item.notes || '-'}
        </TableCellLayout>
      ),
    }),
    createTableColumn<LectureRecord>({
      columnId: 'actions',
      renderHeaderCell: () => '操作',
      renderCell: (item) => (
        <div className={styles.actions}>
          <Button
            appearance="subtle"
            size="small"
            icon={<Edit20Regular />}
            onClick={() => {
              setCurrentRecord(item);
              setFormData({
                observerTeacherName: item.observer_teacher_name,
                teachingTeacherName: item.teaching_teacher_name,
                className: item.class,
                date: item.date,
                notes: item.notes || '',
              });
              setEditDialogOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete20Regular />}
            onClick={() => {
              setCurrentRecord(item);
              setDeleteDialogOpen(true);
            }}
          >
            删除
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className={styles.container}>
      <Toaster toasterId={toasterId} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <PageTitle title="教师听课记录" subtitle="管理和查看教师听课记录" />
        </div>
        <div className={styles.headerActions}>
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => {
              setFormData({
                observerTeacherName: '',
                teachingTeacherName: '',
                className: '',
                date: new Date().toISOString().split('T')[0],
                notes: '',
              });
              setAddDialogOpen(true);
            }}
          >
            添加听课记录
          </Button>
          <Button
            appearance="secondary"
            icon={<ArrowExport20Regular />}
            onClick={() => setExportDialogOpen(true)}
          >
            导出记录
          </Button>
          {selectedRecords.size > 0 && (
            <Button
              appearance="secondary"
              icon={<Delete20Regular />}
              onClick={() => setBatchDeleteDialogOpen(true)}
              style={{ backgroundColor: tokens.colorPaletteRedBackground2 }}
            >
              批量删除 ({selectedRecords.size})
            </Button>
          )}
          <Button
            appearance="subtle"
            onClick={() => {
              if (!showStatistics && !statistics) {
                fetchStatistics();
              }
              setShowStatistics(!showStatistics);
            }}
            disabled={loadingStatistics}
          >
            {loadingStatistics ? '加载中...' : showStatistics ? '隐藏统计' : '📊 显示统计'}
          </Button>
        </div>
      </div>

      {/* Statistics Section */}
      {showStatistics && (
        loadingStatistics ? (
          <Card style={{ marginBottom: '24px', padding: '20px', textAlign: 'center' }}>
            <Spinner size="large" />
            <div style={{ marginTop: '16px' }}>正在加载统计数据...</div>
          </Card>
        ) : (
          statistics ? (
            <Card style={{ marginBottom: '24px', padding: '20px' }}>
              <Title2 style={{ marginBottom: '16px' }}>📊 听课统计分析</Title2>
              
              {/* Overall Statistics */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '16px',
                marginBottom: '24px'
              }}>
                <Card style={{ padding: '16px', textAlign: 'center', backgroundColor: tokens.colorBrandBackground2 }}>
                  <Body1 style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px' }}>总记录数</Body1>
                  <Title2>{statistics.overall.total_records}</Title2>
                </Card>
                <Card style={{ padding: '16px', textAlign: 'center', backgroundColor: tokens.colorNeutralBackground3 }}>
                  <Body1 style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px' }}>听课教师</Body1>
                  <Title2>{statistics.overall.total_observers}</Title2>
                </Card>
                <Card style={{ padding: '16px', textAlign: 'center', backgroundColor: tokens.colorNeutralBackground3 }}>
                  <Body1 style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px' }}>授课教师</Body1>
                  <Title2>{statistics.overall.total_teachers}</Title2>
                </Card>
                <Card style={{ padding: '16px', textAlign: 'center', backgroundColor: tokens.colorNeutralBackground3 }}>
                  <Body1 style={{ color: tokens.colorNeutralForeground3, marginBottom: '8px' }}>涉及班级</Body1>
                  <Title2>{statistics.overall.total_classes}</Title2>
                </Card>
              </div>

              {/* Observer Statistics (听课教师排行) */}
              <div style={{ marginBottom: '24px' }}>
            <Title3 style={{ marginBottom: '12px' }}>👨‍🏫 听课教师排行（前10名）</Title3>
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>排名</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>教师姓名</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>听课次数</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>首次听课</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>最近听课</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.observerStats.slice(0, 10).map((stat: any, index: number) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                      <td style={{ padding: '12px', fontWeight: index < 3 ? 'bold' : 'normal' }}>
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index >= 3 && `${index + 1}`}
                      </td>
                      <td style={{ padding: '12px', fontWeight: index < 3 ? 'bold' : 'normal' }}>{stat.observer_teacher_name}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: tokens.colorBrandForeground1 }}>
                        {stat.lecture_count}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: tokens.colorNeutralForeground3 }}>
                        {stat.first_lecture_date}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: tokens.colorNeutralForeground3 }}>
                        {stat.last_lecture_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Teaching Statistics (被听课教师) */}
          <div style={{ marginBottom: '24px' }}>
            <Title3 style={{ marginBottom: '12px' }}>👨‍🎓 被听课教师统计（前10名）</Title3>
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>排名</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>教师姓名</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>被听课次数</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>听课人数</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.teachingStats.slice(0, 10).map((stat: any, index: number) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                      <td style={{ padding: '12px' }}>{index + 1}</td>
                      <td style={{ padding: '12px' }}>{stat.teaching_teacher_name}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: tokens.colorBrandForeground1 }}>
                        {stat.lecture_count}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: tokens.colorNeutralForeground2 }}>
                        {stat.observer_count} 人
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Class Statistics */}
          <div>
            <Title3 style={{ marginBottom: '12px' }}>🏫 班级听课统计（前10名）</Title3>
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>排名</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>班级</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>听课次数</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: `2px solid ${tokens.colorNeutralStroke1}` }}>听课人数</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.classStats.slice(0, 10).map((stat: any, index: number) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                      <td style={{ padding: '12px' }}>{index + 1}</td>
                      <td style={{ padding: '12px' }}>{stat.class}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: tokens.colorBrandForeground1 }}>
                        {stat.lecture_count}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', color: tokens.colorNeutralForeground2 }}>
                        {stat.observer_count} 人
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </Card>
          ) : null
        )
      )}

      {/* Filters */}
      <Card className={styles.filterSection}>
        <div className={styles.filterGrid}>
          <Field label="开始日期">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              contentBefore={<CalendarLtr20Regular />}
            />
          </Field>
          <Field label="结束日期">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              contentBefore={<CalendarLtr20Regular />}
            />
          </Field>
          <Field label="听课教师">
            <Input
              value={observerNameFilter}
              onChange={(e) => setObserverNameFilter(e.target.value)}
              placeholder="搜索听课教师"
            />
          </Field>
          <Field label="授课教师">
            <Input
              value={teachingNameFilter}
              onChange={(e) => setTeachingNameFilter(e.target.value)}
              placeholder="搜索授课教师"
            />
          </Field>
          <Field label="班级">
            <Input
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              placeholder="搜索班级"
            />
          </Field>
        </div>
        <Button appearance="primary" onClick={fetchRecords}>
          筛选
        </Button>
      </Card>

      {/* Error message */}
      {/* Table */}
      <Card className={styles.tableCard}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Spinner label="加载中..." />
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Body1 style={{ color: tokens.colorNeutralForeground3 }}>暂无听课记录</Body1>
          </div>
        ) : (
          <DataGrid
            items={records}
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
            <DataGridBody<LectureRecord>>
              {({ item, rowId }) => (
                <DataGridRow<LectureRecord> key={rowId}>
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </Card>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(_, data) => setAddDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>添加听课记录</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <div className={styles.formGrid}>
                <Field label="听课教师姓名" required>
                  <Input
                    value={formData.observerTeacherName}
                    onChange={(e) =>
                      setFormData({ ...formData, observerTeacherName: e.target.value })
                    }
                    placeholder="请输入听课教师姓名"
                  />
                </Field>
                <Field label="授课教师姓名" required>
                  <Input
                    value={formData.teachingTeacherName}
                    onChange={(e) =>
                      setFormData({ ...formData, teachingTeacherName: e.target.value })
                    }
                    placeholder="请输入授课教师姓名"
                  />
                </Field>
                <Field label="班级" required>
                  <Input
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    placeholder="请输入班级"
                  />
                </Field>
                <Field label="日期" required>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </Field>
                <Field label="备注">
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="请输入备注（可选）"
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setAddDialogOpen(false)}>
                取消
              </Button>
              <Button
                appearance="primary"
                onClick={handleAdd}
                disabled={
                  !formData.observerTeacherName ||
                  !formData.teachingTeacherName ||
                  !formData.className
                }
              >
                添加
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(_, data) => setEditDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>编辑听课记录</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <div className={styles.formGrid}>
                <Field label="听课教师姓名" required>
                  <Input
                    value={formData.observerTeacherName}
                    onChange={(e) =>
                      setFormData({ ...formData, observerTeacherName: e.target.value })
                    }
                  />
                </Field>
                <Field label="授课教师姓名" required>
                  <Input
                    value={formData.teachingTeacherName}
                    onChange={(e) =>
                      setFormData({ ...formData, teachingTeacherName: e.target.value })
                    }
                  />
                </Field>
                <Field label="班级" required>
                  <Input
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  />
                </Field>
                <Field label="日期" required>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </Field>
                <Field label="备注">
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button
                appearance="primary"
                onClick={handleEdit}
                disabled={
                  !formData.observerTeacherName ||
                  !formData.teachingTeacherName ||
                  !formData.className
                }
              >
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(_, data) => setDeleteDialogOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>确认删除</DialogTitle>
            <DialogContent>
              <Body1>确定要删除这条听课记录吗？此操作不可撤销。</Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteDialogOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" onClick={handleDelete}>
                删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onOpenChange={(_, data) => setExportDialogOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>导出听课记录</DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <div className={styles.formGrid}>
                <Field label="开始日期">
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </Field>
                <Field label="结束日期">
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </Field>
              </div>
              <Body1 style={{ marginTop: '16px', color: tokens.colorNeutralForeground3 }}>
                导出的 Excel 文件将包含：日期、听课教师姓名、授课教师姓名、班级、备注
              </Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setExportDialogOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" onClick={handleExport} disabled={exporting}>
                {exporting ? '导出中...' : '导出'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Batch Delete Dialog */}
      <Dialog
        open={batchDeleteDialogOpen}
        onOpenChange={(_, data) => setBatchDeleteDialogOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogContent>
              <Body1>确定要删除选中的 {selectedRecords.size} 条听课记录吗？此操作不可撤销。</Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setBatchDeleteDialogOpen(false)}>
                取消
              </Button>
              <Button appearance="primary" onClick={handleBatchDelete}>
                确认删除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default LectureRecordsPage;

