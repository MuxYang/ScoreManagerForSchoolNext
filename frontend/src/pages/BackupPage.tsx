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
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ArrowSync20Regular, Delete20Regular } from '@fluentui/react-icons';
import { backupAPI } from '../services/api';

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
  actions: {
    display: 'flex',
    gap: '8px',
  },
  card: {
    padding: '20px',
    marginBottom: '20px',
  },
});

interface Backup {
  id: number;
  filename: string;
  file_size: number;
  created_by_username: string;
  created_at: string;
}

const BackupPage: React.FC = () => {
  const styles = useStyles();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await backupAPI.getList();
      setBackups(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setError('');
      await backupAPI.create();
      setSuccess('备份创建成功');
      loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.error || '创建备份失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (filename: string) => {
    setSelectedBackup(filename);
    setRestoreDialogOpen(true);
  };

  const confirmRestore = async () => {
    if (!selectedBackup) return;

    try {
      setLoading(true);
      setError('');
      await backupAPI.restore(selectedBackup);
      setSuccess('备份恢复成功，当前数据已自动备份');
      setRestoreDialogOpen(false);
      loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.error || '恢复备份失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('确定要删除这个备份吗？')) return;

    try {
      await backupAPI.delete(filename);
      setSuccess('备份删除成功');
      loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.error || '删除备份失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const columns: TableColumnDefinition<Backup>[] = [
    createTableColumn<Backup>({
      columnId: 'filename',
      renderHeaderCell: () => '文件名',
      renderCell: (item) => item.filename,
    }),
    createTableColumn<Backup>({
      columnId: 'size',
      renderHeaderCell: () => '大小',
      renderCell: (item) => formatFileSize(item.file_size),
    }),
    createTableColumn<Backup>({
      columnId: 'creator',
      renderHeaderCell: () => '创建者',
      renderCell: (item) => item.created_by_username || '-',
    }),
    createTableColumn<Backup>({
      columnId: 'date',
      renderHeaderCell: () => '创建时间',
      renderCell: (item) => new Date(item.created_at).toLocaleString('zh-CN'),
    }),
    createTableColumn<Backup>({
      columnId: 'actions',
      renderHeaderCell: () => '操作',
      renderCell: (item) => (
        <div className={styles.actions}>
          <Button
            size="small"
            icon={<ArrowSync20Regular />}
            onClick={() => handleRestore(item.filename)}
          >
            恢复
          </Button>
          <Button
            size="small"
            icon={<Delete20Regular />}
            onClick={() => handleDelete(item.filename)}
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
        <h2>备份与恢复</h2>
        <Button
          appearance="primary"
          icon={<ArrowDownload20Regular />}
          onClick={handleCreateBackup}
          disabled={loading}
        >
          创建新备份
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

      <Card className={styles.card}>
        <h3>⚠️ 重要提示</h3>
        <ul>
          <li>备份会保存当前的所有数据（学生、积分、用户等）</li>
          <li>恢复备份前，系统会自动创建当前数据的备份</li>
          <li>恢复备份后，当前数据将被备份中的数据替换</li>
          <li>请定期创建备份以防止数据丢失</li>
        </ul>
      </Card>

      {loading ? (
        <Spinner label="加载中..." />
      ) : (
        <DataGrid
          items={backups}
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
          <DataGridBody<Backup>>
            {({ item, rowId }) => (
              <DataGridRow<Backup> key={rowId}>
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}

      <Dialog open={restoreDialogOpen} onOpenChange={(_, data) => setRestoreDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>确认恢复备份</DialogTitle>
            <DialogContent>
              <p>您确定要恢复备份 "{selectedBackup}" 吗？</p>
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                警告：当前数据将被替换为备份中的数据！
              </p>
              <p>系统会在恢复前自动备份当前数据。</p>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">取消</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={confirmRestore}>
                确认恢复
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default BackupPage;
