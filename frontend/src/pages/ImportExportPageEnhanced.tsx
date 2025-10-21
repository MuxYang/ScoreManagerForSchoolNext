import React, { useState } from 'react';
import {
  Button,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Label,
  Select,
  Checkbox,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridBody,
  DataGridCell,
  createTableColumn,
  TableColumnDefinition,
  Tab,
  TabList,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ArrowUpload20Regular } from '@fluentui/react-icons';
import { importExportAPI, studentAPI, scoreAPI } from '../services/api';
import * as XLSX from 'xlsx';

const useStyles = makeStyles({
  container: {
    padding: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  card: {
    padding: '20px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  fileInput: {
    marginTop: '12px',
  },
  columnMapping: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  previewSection: {
    marginTop: '20px',
  },
});

interface PreviewData {
  [key: string]: string | number;
}

const ImportExportPageEnhanced: React.FC = () => {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState('export');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 导入相关状态
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<'students' | 'scores'>('students');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  
  // 列映射
  const [columnMapping, setColumnMapping] = useState<{[key: string]: string}>({});

  const handleExportStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await importExportAPI.exportStudentsExcel();
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('学生数据导出成功');
    } catch (err: any) {
      setError(err.response?.data?.error || '导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportScores = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await importExportAPI.exportScoresExcel();
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scores_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('扣分数据导出成功');
    } catch (err: any) {
      setError(err.response?.data?.error || '导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');

    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (jsonData.length === 0) {
          setError('文件为空');
          return;
        }

        // 获取表头
        const fileHeaders = hasHeader ? jsonData[0].map(String) : jsonData[0].map((_, i) => `列${i + 1}`);
        setHeaders(fileHeaders);

        // 获取预览数据（最多10行）
        const dataRows = hasHeader ? jsonData.slice(1, 11) : jsonData.slice(0, 10);
        const preview = dataRows.map(row => {
          const obj: PreviewData = {};
          fileHeaders.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        setPreviewData(preview);

        // 初始化列映射（尝试自动匹配）
        const autoMapping: {[key: string]: string} = {};
        if (importType === 'students') {
          fileHeaders.forEach(header => {
            const lower = header.toLowerCase();
            if (lower.includes('学号') || lower.includes('id') || lower.includes('number')) {
              autoMapping['student_id'] = header;
            } else if (lower.includes('姓名') || lower.includes('name')) {
              autoMapping['name'] = header;
            } else if (lower.includes('班级') || lower.includes('class')) {
              autoMapping['class'] = header;
            }
          });
        } else {
          fileHeaders.forEach(header => {
            const lower = header.toLowerCase();
            if (lower.includes('学号') || lower.includes('student')) {
              autoMapping['student_id'] = header;
            } else if (lower.includes('扣分') || lower.includes('积分') || lower.includes('points') || lower.includes('分数')) {
              autoMapping['points'] = header;
            } else if (lower.includes('事由') || lower.includes('reason')) {
              autoMapping['reason'] = header;
            } else if (lower.includes('教师') || lower.includes('teacher')) {
              autoMapping['teacher_name'] = header;
            } else if (lower.includes('日期') || lower.includes('date')) {
              autoMapping['date'] = header;
            }
          });
        }
        setColumnMapping(autoMapping);

      } catch (err) {
        setError('文件解析失败，请确保是有效的Excel文件');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenImportDialog = (type: 'students' | 'scores') => {
    setImportType(type);
    setImportDialogOpen(true);
    setSelectedFile(null);
    setPreviewData([]);
    setHeaders([]);
    setColumnMapping({});
    setError('');
  };

  const handleImport = async () => {
    if (!selectedFile || previewData.length === 0) {
      setError('请先选择文件');
      return;
    }

    // 验证列映射
    if (importType === 'students') {
      if (!columnMapping.student_id || !columnMapping.name || !columnMapping.class) {
        setError('请完成所有必填字段的列映射（学号、姓名、班级）');
        return;
      }
    } else {
      if (!columnMapping.student_id || !columnMapping.points || !columnMapping.reason) {
        setError('请完成所有必填字段的列映射（学号、扣分、事由）');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      // 读取完整文件
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          const dataRows = hasHeader ? jsonData.slice(1) : jsonData;
          const fileHeaders = hasHeader ? jsonData[0].map(String) : jsonData[0].map((_, i) => `列${i + 1}`);

          if (importType === 'students') {
            // 构建学生数据
            const students = dataRows.map(row => ({
              studentId: row[fileHeaders.indexOf(columnMapping.student_id)],
              name: row[fileHeaders.indexOf(columnMapping.name)],
              studentClass: row[fileHeaders.indexOf(columnMapping.class)],
            })).filter(s => s.studentId && s.name && s.studentClass);

            // 批量导入
            await studentAPI.batchImport(students);
            setSuccess(`成功导入 ${students.length} 条学生记录`);
          } else {
            // 构建扣分数据
            const scores = dataRows.map(row => ({
              studentId: row[fileHeaders.indexOf(columnMapping.student_id)],
              points: Number(row[fileHeaders.indexOf(columnMapping.points)]) || 0,
              reason: row[fileHeaders.indexOf(columnMapping.reason)],
              teacherName: columnMapping.teacher_name ? row[fileHeaders.indexOf(columnMapping.teacher_name)] : '',
              date: columnMapping.date ? row[fileHeaders.indexOf(columnMapping.date)] : new Date().toISOString().split('T')[0],
            })).filter(s => s.studentId && s.points && s.reason);

            // 批量导入
            await scoreAPI.batchImport(scores);
            setSuccess(`成功导入 ${scores.length} 条扣分记录`);
          }

          setImportDialogOpen(false);
        } catch (err: any) {
          setError(err.response?.data?.error || '导入失败');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (err: any) {
      setError('导入失败');
      setLoading(false);
    }
  };

  const previewColumns: TableColumnDefinition<PreviewData>[] = headers.map(header =>
    createTableColumn<PreviewData>({
      columnId: header,
      renderHeaderCell: () => header,
      renderCell: (item) => item[header],
    })
  );

  return (
    <div className={styles.container}>
      <h2>数据导入导出</h2>

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

      <TabList
        selectedValue={selectedTab}
        onTabSelect={(_, data) => setSelectedTab(data.value as string)}
        style={{ marginTop: '20px' }}
      >
        <Tab value="export">数据导出</Tab>
        <Tab value="import">数据导入</Tab>
      </TabList>

      {selectedTab === 'export' && (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <h3>导出学生数据</h3>
            <p>将所有学生信息导出为 Excel 文件</p>
            <div className={styles.actions}>
              <Button
                appearance="primary"
                icon={<ArrowDownload20Regular />}
                onClick={handleExportStudents}
                disabled={loading}
              >
                {loading ? <Spinner size="tiny" /> : '导出学生数据'}
              </Button>
            </div>
          </Card>

          <Card className={styles.card}>
            <h3>导出扣分数据</h3>
            <p>将所有扣分记录导出为 Excel 文件</p>
            <div className={styles.actions}>
              <Button
                appearance="primary"
                icon={<ArrowDownload20Regular />}
                onClick={handleExportScores}
                disabled={loading}
              >
                {loading ? <Spinner size="tiny" /> : '导出积分数据'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {selectedTab === 'import' && (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <h3>导入学生数据</h3>
            <p>从 Excel 文件导入学生信息</p>
            <div className={styles.actions}>
              <Button
                appearance="primary"
                icon={<ArrowUpload20Regular />}
                onClick={() => handleOpenImportDialog('students')}
              >
                选择文件导入
              </Button>
            </div>
          </Card>

          <Card className={styles.card}>
            <h3>导入积分数据</h3>
            <p>从 Excel 文件导入积分记录</p>
            <div className={styles.actions}>
              <Button
                appearance="primary"
                icon={<ArrowUpload20Regular />}
                onClick={() => handleOpenImportDialog('scores')}
              >
                选择文件导入
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 导入对话框 */}
      <Dialog 
        open={importDialogOpen} 
        onOpenChange={(_, data) => setImportDialogOpen(data.open)}
      >
        <DialogSurface style={{ minWidth: '800px' }}>
          <DialogBody>
            <DialogTitle>
              导入{importType === 'students' ? '学生' : '积分'}数据
            </DialogTitle>
            <DialogContent>
              <div>
                <Label>选择文件</Label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                  style={{ marginTop: '8px' }}
                />
              </div>

              <div style={{ marginTop: '16px' }}>
                <Checkbox
                  checked={hasHeader}
                  onChange={(_, data) => setHasHeader(data.checked as boolean)}
                  label="第一行是标题行"
                />
              </div>

              {previewData.length > 0 && (
                <>
                  <div className={styles.columnMapping}>
                    <h4>列映射设置</h4>
                    {importType === 'students' ? (
                      <>
                        <div>
                          <Label required>学号列</Label>
                          <Select
                            value={columnMapping.student_id || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, student_id: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label required>姓名列</Label>
                          <Select
                            value={columnMapping.name || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, name: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label required>班级列</Label>
                          <Select
                            value={columnMapping.class || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, class: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label required>学号列</Label>
                          <Select
                            value={columnMapping.student_id || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, student_id: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label required>积分列</Label>
                          <Select
                            value={columnMapping.points || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, points: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label required>事由列</Label>
                          <Select
                            value={columnMapping.reason || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, reason: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>教师列（可选）</Label>
                          <Select
                            value={columnMapping.teacher_name || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, teacher_name: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>日期列（可选）</Label>
                          <Select
                            value={columnMapping.date || ''}
                            onChange={(e) => setColumnMapping({...columnMapping, date: e.target.value})}
                          >
                            <option value="">请选择</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </Select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className={styles.previewSection}>
                    <h4>数据预览（前10行）</h4>
                    <DataGrid
                      items={previewData}
                      columns={previewColumns}
                      getRowId={(item) => previewData.indexOf(item).toString()}
                    >
                      <DataGridHeader>
                        <DataGridRow>
                          {({ renderHeaderCell }) => (
                            <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                          )}
                        </DataGridRow>
                      </DataGridHeader>
                      <DataGridBody<PreviewData>>
                        {({ item, rowId }) => (
                          <DataGridRow<PreviewData> key={rowId}>
                            {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                          </DataGridRow>
                        )}
                      </DataGridBody>
                    </DataGrid>
                  </div>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setImportDialogOpen(false)}>
                取消
              </Button>
              <Button 
                appearance="primary" 
                onClick={handleImport}
                disabled={loading || previewData.length === 0}
              >
                {loading ? <Spinner size="tiny" /> : '确认导入'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default ImportExportPageEnhanced;
