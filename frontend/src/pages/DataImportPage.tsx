import React, { useState } from 'react';
import {
  Button,
  Card,
  makeStyles,
  Spinner,
  Label,
  Select,
  Tab,
  TabList,
  Subtitle1,
  Body1,
  tokens,
} from '@fluentui/react-components';
import { ArrowUpload20Regular, DocumentArrowUp20Regular, Checkmark20Regular } from '@fluentui/react-icons';
import { importExportAPI } from '../services/api';
import { useToast } from '../utils/toast';

const useStyles = makeStyles({
  container: {
    padding: '20px',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  uploadSection: {
    marginBottom: '24px',
  },
  uploadCard: {
    padding: '24px',
    textAlign: 'center' as const,
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px',
    marginTop: '24px',
  },
  previewSection: {
    height: '600px',
    overflow: 'auto',
  },
  mappingSection: {
    padding: '20px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  fieldMapping: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '16px',
  },
  mappingField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dataGrid: {
    maxHeight: '550px',
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  fileInfo: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
});

interface ColumnMapping {
  [key: string]: string;
}

const DataImportPage: React.FC = () => {
  const { showToast } = useToast();
  const styles = useStyles();
  const [importType, setImportType] = useState<'students' | 'teachers'>('students');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 解析后的数据
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  
  // 列映射
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // 学生字段要求
  const studentFields = [
    { key: 'name', label: '姓名', required: true },
    { key: 'studentId', label: '学号', required: true },
    { key: 'class', label: '班级', required: true },
  ];

  // 教师字段要求
  const teacherFields = [
    { key: 'name', label: '姓名', required: true },
    { key: 'subject', label: '科目', required: true },
    { key: 'teachingClasses', label: '任教班级', required: true },
  ];

  const currentFields = importType === 'students' ? studentFields : teacherFields;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!['csv', 'xls', 'xlsx'].includes(extension || '')) {
        showToast({ title: '错误', body: '不支持的文件格式，请使用 CSV、XLS 或 XLSX 格式', intent: 'error' });
        return;
      }
      setSelectedFile(file);
      parseFile(file);
    }
  };

  const handleCardClick = () => {
    document.getElementById('fileInput')?.click();
  };

  const parseFile = async (file: File) => {
    try {
      setLoading(true);
      const response = await importExportAPI.parseFile(file);
      
      setHeaders(response.data.headers);
      setPreviewData(response.data.preview);
      setAllData(response.data.allData);
      
      // 自动映射（尝试智能匹配）
      autoMapColumns(response.data.headers);
      
      showToast({ title: "成功", body: `文件解析成功！共 ${response.data.totalRows} 行数据`, intent: "success" });
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '文件解析失败', intent: 'error' });
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const autoMapColumns = (fileHeaders: string[]) => {
    const mapping: ColumnMapping = {};
    
    fileHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase().trim();
      
      // 学生字段映射
      if (lowerHeader.includes('姓名') || lowerHeader.includes('name')) {
        mapping.name = header;
      } else if (lowerHeader.includes('学号') || lowerHeader.includes('studentid') || lowerHeader.includes('student_id')) {
        mapping.studentId = header;
      } else if (lowerHeader.includes('班级') || lowerHeader.includes('class')) {
        mapping.class = header;
      }
      
      // 教师字段映射
      else if (lowerHeader.includes('科目') || lowerHeader.includes('subject')) {
        mapping.subject = header;
      } else if (lowerHeader.includes('任教班级') || lowerHeader.includes('班级') || lowerHeader.includes('teaching') || lowerHeader.includes('class')) {
        mapping.teachingClasses = header;
      }
    });
    
    setColumnMapping(mapping);
  };

  const handleMappingChange = (fieldKey: string, columnName: string) => {
    setColumnMapping({
      ...columnMapping,
      [fieldKey]: columnName,
    });
  };

  const validateMapping = (): boolean => {
    const requiredFields = currentFields.filter(f => f.required);
    for (const field of requiredFields) {
      if (!columnMapping[field.key]) {
        showToast({ title: '验证失败', body: `请为必填字段 "${field.label}" 选择对应的列`, intent: 'warning' });
        return false;
      }
    }
    return true;
  };

  const handleImport = async () => {
    if (!validateMapping()) {
      return;
    }

    try {
      setLoading(true);
      let response;
      if (importType === 'students') {
        response = await importExportAPI.importStudents(allData, columnMapping);
      } else {
        response = await importExportAPI.importTeachers(allData, columnMapping);
      }
      
      showToast({ title: '导入成功', body: response.data.message, intent: 'success' });
      
      // 显示导入结果
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('导入错误:', response.data.errors);
      }
      
      // 清空数据
      setTimeout(() => {
        setSelectedFile(null);
        setHeaders([]);
        setPreviewData([]);
        setAllData([]);
        setColumnMapping({});
      }, 3000);
      
    } catch (err: any) {
      showToast({ title: '错误', body: err.response?.data?.error || '导入失败', intent: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderPreviewTable = () => {
    if (previewData.length === 0) return null;

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index} style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
                  backgroundColor: tokens.colorNeutralBackground2,
                  fontWeight: 600,
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ 
                borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
              }}>
                {headers.map((header, colIndex) => (
                  <td key={colIndex} style={{ 
                    padding: '12px',
                    whiteSpace: 'nowrap',
                  }}>
                    {row[header]?.toString() || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Subtitle1>数据导入</Subtitle1>
        <Body1>上传 CSV、XLS 或 XLSX 文件以批量导入数据</Body1>
      </div>

      {/* 导入类型选择 */}
      <TabList
        selectedValue={importType}
        onTabSelect={(_, data) => {
          setImportType(data.value as 'students' | 'teachers');
          setColumnMapping({});
        }}
        style={{ marginBottom: '24px' }}
      >
        <Tab value="students">学生导入</Tab>
        <Tab value="teachers">教师导入</Tab>
      </TabList>

      {/* 文件上传区域 */}
      <div className={styles.uploadSection}>
        <input
          id="fileInput"
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <Card className={styles.uploadCard} onClick={handleCardClick}>
          <DocumentArrowUp20Regular style={{ fontSize: '48px', color: tokens.colorBrandForeground1 }} />
          <div style={{ marginTop: '12px' }}>
            <Body1>点击选择文件或拖拽文件到此处</Body1>
            <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
              支持格式：CSV、XLS、XLSX
            </Body1>
          </div>
        </Card>

        {selectedFile && (
          <div className={styles.fileInfo}>
            <Body1>
              <strong>已选择文件：</strong> {selectedFile.name} 
              ({(selectedFile.size / 1024).toFixed(2)} KB)
            </Body1>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spinner label="处理中..." />
        </div>
      )}

      {/* 主布局：左侧预览，右侧映射 */}
      {!loading && previewData.length > 0 && (
        <div className={styles.mainLayout}>
          {/* 左侧：数据预览 */}
          <div>
            <Card>
              <Subtitle1>数据预览 (前50行)</Subtitle1>
              <div className={styles.previewSection}>
                {renderPreviewTable()}
              </div>
            </Card>
          </div>

          {/* 右侧：字段映射 */}
          <div>
            <Card className={styles.mappingSection}>
              <Subtitle1>字段映射</Subtitle1>
              <Body1 style={{ marginTop: '8px', color: tokens.colorNeutralForeground3 }}>
                将文件中的列映射到系统字段
              </Body1>

              <div className={styles.fieldMapping}>
                {currentFields.map(field => (
                  <div key={field.key} className={styles.mappingField}>
                    <Label required={field.required}>
                      {field.label}
                      {columnMapping[field.key] && (
                        <Checkmark20Regular style={{ marginLeft: '8px', color: tokens.colorPaletteGreenForeground1 }} />
                      )}
                    </Label>
                    <Select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) => handleMappingChange(field.key, e.target.value)}
                    >
                      <option value="">-- 请选择 --</option>
                      {headers.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              <div className={styles.actionButtons}>
                <Button
                  appearance="primary"
                  icon={<ArrowUpload20Regular />}
                  onClick={handleImport}
                  disabled={loading}
                >
                  开始导入 ({allData.length} 条)
                </Button>
                <Button
                  appearance="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setHeaders([]);
                    setPreviewData([]);
                    setAllData([]);
                    setColumnMapping({});
                    }}
                >
                  重置
                </Button>
              </div>

              {/* 导入说明 */}
              <div style={{ marginTop: '24px', padding: '12px', backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusSmall }}>
                <Body1 style={{ fontWeight: 600, marginBottom: '8px' }}>导入说明：</Body1>
                {importType === 'students' ? (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                    <li>姓名、学号、班级为必填字段</li>
                    <li>学号重复的数据将被跳过</li>
                    <li>支持阿拉伯数字班级（如：1、2、3班）</li>
                  </ul>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                    <li>姓名、科目、任教班级为必填字段</li>
                    <li>任教班级支持多个，使用分隔符：; ； , ，</li>
                    <li>示例：1班;2班;3班 或 一班;二班;三班</li>
                    <li>支持阿拉伯数字班级</li>
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImportPage;
