import express, { Request, Response } from 'express';
import XLSX from 'xlsx';
import { authenticateToken } from '../middleware/auth';
import db from '../models/database';
import logger from '../utils/logger';

const router = express.Router();

// 导出学生数据为 Excel
router.get('/students/excel', authenticateToken, (req: Request, res: Response) => {
  try {
    const students = db.prepare('SELECT * FROM students ORDER BY class, name').all();

    const worksheet = XLSX.utils.json_to_sheet(students);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '学生名单');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    res.send(buffer);

    logger.info('导出学生数据成功');
  } catch (error) {
    logger.error('导出学生数据失败:', error);
    res.status(500).json({ error: '导出学生数据失败' });
  }
});

// 导出积分数据为 Excel
router.get('/scores/excel', authenticateToken, (req: Request, res: Response) => {
  try {
    const scores = db.prepare(`
      SELECT s.*, st.student_id, st.name, st.class
      FROM scores s
      JOIN students st ON s.student_id = st.id
      ORDER BY s.date DESC
    `).all();

    const worksheet = XLSX.utils.json_to_sheet(scores);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '积分记录');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=scores.xlsx');
    res.send(buffer);

    logger.info('导出积分数据成功');
  } catch (error) {
    logger.error('导出积分数据失败:', error);
    res.status(500).json({ error: '导出积分数据失败' });
  }
});

// 解析 Excel/CSV 文件并返回预览
router.post('/parse', authenticateToken, (req: Request, res: Response) => {
  try {
    const { fileData, fileType, hasHeader = true } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: '未提供文件数据' });
    }

    // 将 base64 数据转换为 buffer
    const buffer = Buffer.from(fileData, 'base64');

    let workbook;
    if (fileType === 'csv') {
      workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: hasHeader ? undefined : 1 });

    res.json({ 
      preview: jsonData.slice(0, 10), // 只返回前10行预览
      totalRows: jsonData.length,
      columns: Object.keys(jsonData[0] || {})
    });

    logger.info('解析文件成功', { rows: jsonData.length });
  } catch (error) {
    logger.error('解析文件失败:', error);
    res.status(500).json({ error: '解析文件失败' });
  }
});

// AI 文本解析（stub - 将来可集成真实 AI）
router.post('/parse-text', authenticateToken, (req: Request, res: Response) => {
  try {
    const { text, dataType } = req.body;

    if (!text) {
      return res.status(400).json({ error: '未提供文本数据' });
    }

    // 简单的文本解析逻辑（stub）
    const lines = text.trim().split('\n');
    const data: any[] = [];

    for (const line of lines) {
      const parts = line.split(/[\t,]/); // 支持 tab 和逗号分隔

      if (dataType === 'students' && parts.length >= 3) {
        data.push({
          studentId: parts[0].trim(),
          name: parts[1].trim(),
          class: parts[2].trim()
        });
      } else if (dataType === 'scores' && parts.length >= 3) {
        data.push({
          studentId: parts[0].trim(),
          points: parseFloat(parts[1].trim()),
          reason: parts[2]?.trim() || '',
          teacherName: parts[3]?.trim() || '',
          date: parts[4]?.trim() || new Date().toISOString().split('T')[0]
        });
      }
    }

    res.json({ 
      preview: data.slice(0, 10),
      totalRows: data.length,
      message: '文本解析完成（使用简单解析逻辑）'
    });

    logger.info('解析文本成功', { rows: data.length, dataType });
  } catch (error) {
    logger.error('解析文本失败:', error);
    res.status(500).json({ error: '解析文本失败' });
  }
});

export default router;
