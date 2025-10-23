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
  ArrowExport20Regular,
  ArrowUp20Regular,
  ArrowDown20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  DismissRegular,
} from '@fluentui/react-icons';
import { studentAPI, scoreAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

// ==================== 样式定义 ====================
const useStyles = makeStyles({
  container: {
    padding: '20px',
    maxWidth: '1600px',
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
  filterSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterField: {
    minWidth: '150px',
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
    cursor: 'pointer',
    userSelect: 'none' as const,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  sortableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  tableCell: {
    padding: '16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tableRow: {
    transition: 'background-color 0.2s',
  },
  selectedRow: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    padding: '16px',
  },
  paginationButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
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
  bulkActions: {
    padding: '12px',
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
});

// ==================== 类型定义 ====================
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

type SortField = 'student_id' | 'name' | 'class' | 'total_points';
type SortDirection = 'asc' | 'desc';

// ==================== 主组件 ====================
const StudentsPageComplete: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  // ==================== 状态管理 ====================
  // 数据状态
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 对话框状态
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [studentScores, setStudentScores] = useState<Score[]>([]);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // 表单状态
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    class: '',
  });

  // 排序状态
  const [sortField, setSortField] = useState<SortField>('class');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 筛选状态
  const [filters, setFilters] = useState({
    class: '',
    minScore: '',
    maxScore: '',
    search: '',
  });

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // ==================== 数据加载 ====================
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

  // ==================== 排序逻辑 ====================
  const extractClassNumber = (className: string): number => {
    const match = className.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    let sorted = [...students];

    // 应用排序
    sorted.sort((a, b) => {
      let compareValue = 0;

      if (sortField === 'class') {
        // 班级按数字排序
        const numA = extractClassNumber(a.class);
        const numB = extractClassNumber(b.class);
        compareValue = numA - numB;
      } else if (sortField === 'total_points') {
        compareValue = (a.total_points || 0) - (b.total_points || 0);
      } else {
        compareValue = String(a[sortField]).localeCompare(String(b[sortField]));
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [students, sortField, sortDirection]);

  // ==================== 筛选逻辑 ====================
  const filteredStudents = useMemo(() => {
    return sortedStudents.filter((student) => {
      // 班级筛选
      if (filters.class && student.class !== filters.class) {
        return false;
      }

      // 分数范围筛选
      const points = student.total_points || 0;
      if (filters.minScore && points < parseFloat(filters.minScore)) {
        return false;
      }
      if (filters.maxScore && points > parseFloat(filters.maxScore)) {
        return false;
      }

      // 精确搜索（学号或姓名）
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchId = student.student_id.toLowerCase().includes(searchLower);
        const matchName = student.name.toLowerCase().includes(searchLower);
        if (!matchId && !matchName) {
          return false;
        }
      }

      return true;
    });
  }, [sortedStudents, filters]);

  // ==================== 分页逻辑 ====================
  const totalPages = Math.ceil(filteredStudents.length / pageSize);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredStudents.slice(start, end);
  }, [filteredStudents, currentPage, pageSize]);

  // 获取所有唯一的班级列表
  const classList = useMemo(() => {
    const classes = Array.from(new Set(students.map(s => s.class)));
    return classes.sort((a, b) => extractClassNumber(a) - extractClassNumber(b));
  }, [students]);

  // ==================== 批量操作 ====================
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个学生吗？`)) return;

    try {
      setLoading(true);
      for (const id of selectedIds) {
        await studentAPI.delete(id);
      }
      setSuccess(`成功删除 ${selectedIds.length} 个学生`);
      setSelectedIds([]);
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.error || '批量删除失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== CRUD 操作 ====================
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

  // 处理导出学生量化记录
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
      const response = await studentAPI.exportRecords(exportStartDate, exportEndDate);
      
      // 下载文件
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `学生量化记录-${exportStartDate}-${exportEndDate}.xlsx`;
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`成功导出学生量化记录`);
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

  // ==================== 渲染排序图标 ====================
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp20Regular /> : <ArrowDown20Regular />;
  };

  // ==================== 主渲染 ====================
  return (
    <div className={styles.container}>
      {/* 头部 */}
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
          <Button
            appearance="secondary"
            icon={<ArrowExport20Regular />}
            onClick={() => setExportDialogOpen(true)}
          >
            导出量化记录
          </Button>
        </div>
      </div>

      {/* 消息提示 */}
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

      {/* 筛选区域 */}
      <div className={styles.filterSection}>
        <div className={styles.filterField}>
          <Label>搜索</Label>
          <Input
            placeholder="学号或姓名"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className={styles.filterField}>
          <Label>班级</Label>
          <Select
            value={filters.class}
            onChange={(e) => setFilters({ ...filters, class: e.target.value })}
          >
            <option value="">全部班级</option>
            {classList.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Label>最低分数</Label>
          <Input
            type="number"
            placeholder="最低分"
            value={filters.minScore}
            onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
          />
        </div>
        <div className={styles.filterField}>
          <Label>最高分数</Label>
          <Input
            type="number"
            placeholder="最高分"
            value={filters.maxScore}
            onChange={(e) => setFilters({ ...filters, maxScore: e.target.value })}
          />
        </div>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => {
            setFilters({ class: '', minScore: '', maxScore: '', search: '' });
            setCurrentPage(1);
          }}
        >
          清除筛选
        </Button>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <div className={styles.bulkActions}>
          <span>已选择 {selectedIds.length} 项</span>
          <Button
            appearance="primary"
            size="small"
            icon={<Delete20Regular />}
            onClick={handleBulkDelete}
          >
            批量删除
          </Button>
          <Button
            appearance="subtle"
            size="small"
            onClick={() => setSelectedIds([])}
          >
            取消选择
          </Button>
        </div>
      )}

      {/* 数据表格 */}
      {loading && !detailDialogOpen ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner label="加载中..." />
        </div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.tableHeader} style={{ width: '50px' }}>
                  <Checkbox
                    checked={selectedIds.length === paginatedStudents.length && paginatedStudents.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className={styles.tableHeader} onClick={() => handleSort('student_id')}>
                  <div className={styles.sortableHeader}>
                    学号 {renderSortIcon('student_id')}
                  </div>
                </th>
                <th className={styles.tableHeader} onClick={() => handleSort('name')}>
                  <div className={styles.sortableHeader}>
                    姓名 {renderSortIcon('name')}
                  </div>
                </th>
                <th className={styles.tableHeader} onClick={() => handleSort('class')}>
                  <div className={styles.sortableHeader}>
                    班级 {renderSortIcon('class')}
                  </div>
                </th>
                <th className={styles.tableHeader} onClick={() => handleSort('total_points')}>
                  <div className={styles.sortableHeader}>
                    累计量化 {renderSortIcon('total_points')}
                  </div>
                </th>
                <th className={styles.tableHeader}>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr
                  key={student.id}
                  className={`${styles.tableRow} ${selectedIds.includes(student.id) ? styles.selectedRow : ''}`}
                  style={{
                    backgroundColor: selectedIds.includes(student.id)
                      ? tokens.colorBrandBackground2
                      : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.includes(student.id)) {
                      e.currentTarget.style.backgroundColor = tokens.colorNeutralBackground1Hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.includes(student.id)) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  <td className={styles.tableCell}>
                    <Checkbox
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleSelect(student.id)}
                    />
                  </td>
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

          {/* 分页 */}
          <div className={styles.pagination}>
            <div>
              显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredStudents.length)} 共 {filteredStudents.length} 条
            </div>
            <div className={styles.paginationButtons}>
              <Button
                appearance="subtle"
                icon={<ChevronLeft20Regular />}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span>第 {currentPage} / {totalPages} 页</span>
              <Button
                appearance="subtle"
                icon={<ChevronRight20Regular />}
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
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
                      placeholder="例如：1班、二班"
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
                    <Label>学号：{currentStudent.student_id}</Label><br />
                    <Label>姓名：{currentStudent.name}</Label><br />
                    <Label>班级：{currentStudent.class}</Label><br />
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

      {/* 导出对话框 */}
      <Dialog open={exportDialogOpen} onOpenChange={(_, data) => setExportDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>导出学生量化记录</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <MessageBar intent="info">
                  <MessageBarBody>
                    <div>• 将导出为 Excel (XLSX) 格式文件</div>
                    <div>• 仅包含有量化记录的学生</div>
                    <div>• 包含班级、姓名、学号及详细量化记录</div>
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

export default StudentsPageComplete;
