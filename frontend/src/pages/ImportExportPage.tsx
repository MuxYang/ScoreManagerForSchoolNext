import React, { useState } from 'react';
import {
  Button,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ArrowUpload20Regular } from '@fluentui/react-icons';
import { importExportAPI } from '../services/api';

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
});

const ImportExportPage: React.FC = () => {
  const styles = useStyles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExportStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await importExportAPI.exportStudentsExcel();
      
      // 创建下载链接
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
      
      setSuccess('积分数据导出成功');
    } catch (err: any) {
      setError(err.response?.data?.error || '导出失败');
    } finally {
      setLoading(false);
    }
  };

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
          <h3>导出积分数据</h3>
          <p>将所有积分记录导出为 Excel 文件</p>
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

        <Card className={styles.card}>
          <h3>导入学生数据</h3>
          <p>从 Excel 文件导入学生信息（开发中）</p>
          <div className={styles.actions}>
            <Button
              icon={<ArrowUpload20Regular />}
              disabled
            >
              导入学生数据
            </Button>
          </div>
        </Card>

        <Card className={styles.card}>
          <h3>导入积分数据</h3>
          <p>从 Excel 文件导入积分记录（开发中）</p>
          <div className={styles.actions}>
            <Button
              icon={<ArrowUpload20Regular />}
              disabled
            >
              导入积分数据
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ImportExportPage;
