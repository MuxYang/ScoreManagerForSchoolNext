import express, { Request, Response } from 'express';
import db from '../models/database';
import logger from '../utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { normalizeIp } from '../utils/ipHelper';
import ExcelJS from 'exceljs';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all lecture records with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, observerName, teachingName, className } = req.query;
    
    let query = "SELECT * FROM teaching_observations WHERE date != '1970-01-01'";
    const params: any[] = [];
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    if (observerName) {
      query += ' AND observer_teacher_name LIKE ?';
      params.push(`%${observerName}%`);
    }
    
    if (teachingName) {
      query += ' AND teaching_teacher_name LIKE ?';
      params.push(`%${teachingName}%`);
    }
    
    if (className) {
      query += ' AND class LIKE ?';
      params.push(`%${className}%`);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const records = db.prepare(query).all(...params);
    
    logger.info('Lecture records fetched', { 
      count: records.length,
      filters: { startDate, endDate, observerName, teachingName, className }
    });
    
    res.json(records);
  } catch (error: any) {
    logger.error('Failed to fetch lecture records:', error);
    res.status(500).json({ error: 'Failed to fetch lecture records' });
  }
});

// Get lecture statistics (teacher observation counts) - MUST be before /:id route
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    // Observer teacher statistics (听课教师统计)
    const observerStats = db.prepare(`
      SELECT 
        observer_teacher_name,
        COUNT(*) as lecture_count,
        MIN(date) as first_lecture_date,
        MAX(date) as last_lecture_date
      FROM teaching_observations
      GROUP BY observer_teacher_name
      ORDER BY lecture_count DESC
    `).all();

    // Teaching teacher statistics (授课教师统计)
    const teachingStats = db.prepare(`
      SELECT 
        teaching_teacher_name,
        COUNT(*) as lecture_count,
        COUNT(DISTINCT observer_teacher_name) as observer_count,
        MIN(date) as first_lecture_date,
        MAX(date) as last_lecture_date
      FROM teaching_observations
      GROUP BY teaching_teacher_name
      ORDER BY lecture_count DESC
    `).all();

    // Class statistics (班级统计)
    const classStats = db.prepare(`
      SELECT 
        class,
        COUNT(*) as lecture_count,
        COUNT(DISTINCT observer_teacher_name) as observer_count,
        MIN(date) as first_lecture_date,
        MAX(date) as last_lecture_date
      FROM teaching_observations
      GROUP BY class
      ORDER BY lecture_count DESC
    `).all();

    // Overall statistics
    const overall = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT observer_teacher_name) as total_observers,
        COUNT(DISTINCT teaching_teacher_name) as total_teachers,
        COUNT(DISTINCT class) as total_classes,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM teaching_observations
    `).get();

    logger.info('Lecture statistics fetched successfully');

    res.json({
      observerStats,
      teachingStats,
      classStats,
      overall
    });
  } catch (error: any) {
    logger.error('Failed to fetch lecture statistics:', error);
    res.status(500).json({ error: 'Failed to fetch lecture statistics' });
  }
});

// Get a single lecture record by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = db.prepare('SELECT * FROM teaching_observations WHERE id = ?').get(id);
    
    if (!record) {
      return res.status(404).json({ error: 'Lecture record not found' });
    }
    
    res.json(record);
  } catch (error: any) {
    logger.error('Failed to fetch lecture record:', error);
    res.status(500).json({ error: 'Failed to fetch lecture record' });
  }
});

// Create a new lecture record
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { observerTeacherName, teachingTeacherName, className, date, notes, period } = req.body;
    
    if (!observerTeacherName || !teachingTeacherName || !className) {
      return res.status(400).json({ 
        error: 'Observer teacher name, teaching teacher name, and class are required' 
      });
    }
    
    const periodValue = Math.min(13, Math.max(1, Number(period) || 1));

    const result = db.prepare(`
      INSERT INTO teaching_observations 
      (observer_teacher_name, teaching_teacher_name, class, date, period, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      observerTeacherName,
      teachingTeacherName,
      className,
      date || new Date().toISOString().split('T')[0],
      periodValue,
      notes || null,
      authReq.userId
    );
    
    logger.info('Lecture record created', { 
      recordId: result.lastInsertRowid,
      observerTeacherName,
      teachingTeacherName,
      className
    });
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      message: 'Lecture record created successfully' 
    });
  } catch (error: any) {
    logger.error('Failed to create lecture record:', error);
    res.status(500).json({ error: 'Failed to create lecture record' });
  }
});

// Update a lecture record
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { observerTeacherName, teachingTeacherName, className, date, notes, period } = req.body;
    
    const record = db.prepare('SELECT * FROM teaching_observations WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Lecture record not found' });
    }
    
    if (!observerTeacherName || !teachingTeacherName || !className) {
      return res.status(400).json({ 
        error: 'Observer teacher name, teaching teacher name, and class are required' 
      });
    }
    
    const periodValue = Math.min(13, Math.max(1, Number(period) || 1));

    db.prepare(`
      UPDATE teaching_observations 
      SET observer_teacher_name = ?,
          teaching_teacher_name = ?,
          class = ?,
          date = ?,
          period = ?,
          notes = ?
      WHERE id = ?
    `).run(
      observerTeacherName,
      teachingTeacherName,
      className,
      date,
      periodValue,
      notes || null,
      id
    );
    
    logger.info('Lecture record updated', { 
      recordId: id,
      observerTeacherName,
      teachingTeacherName,
      className
    });
    
    res.json({ message: 'Lecture record updated successfully' });
  } catch (error: any) {
    logger.error('Failed to update lecture record:', error);
    res.status(500).json({ error: 'Failed to update lecture record' });
  }
});

// Delete a lecture record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const record = db.prepare('SELECT * FROM teaching_observations WHERE id = ?').get(id);
    if (!record) {
      return res.status(404).json({ error: 'Lecture record not found' });
    }
    
    db.prepare('DELETE FROM teaching_observations WHERE id = ?').run(id);
    
    logger.info('Lecture record deleted', { recordId: id });
    
    res.json({ message: 'Lecture record deleted successfully' });
  } catch (error: any) {
    logger.error('Failed to delete lecture record:', error);
    res.status(500).json({ error: 'Failed to delete lecture record' });
  }
});

// Batch create lecture records (for AI import)
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }
    
    const insertStmt = db.prepare(`
      INSERT INTO teaching_observations 
      (observer_teacher_name, teaching_teacher_name, class, date, period, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let successCount = 0;
    const errors: string[] = [];
    
    records.forEach((record: any, index: number) => {
      try {
        const { teacherName, teachName, class: className, date, notes, period } = record;
        
        if (!teacherName || !teachName || !className) {
          errors.push(`Record ${index + 1}: Missing required fields`);
          return;
        }
        
        const periodValue = Math.min(13, Math.max(1, Number(period) || 1));

        insertStmt.run(
          teacherName,
          teachName,
          className,
          date || new Date().toISOString().split('T')[0],
          periodValue,
          notes || null,
          authReq.userId
        );
        
        successCount++;
      } catch (error: any) {
        errors.push(`Record ${index + 1}: ${error.message}`);
      }
    });
    
    logger.info('Batch lecture records created', {
      total: records.length,
      success: successCount,
      failed: errors.length
    });
    
    res.json({
      success: true,
      total: records.length,
      successCount,
      failedCount: errors.length,
      errors
    });
  } catch (error: any) {
    logger.error('Failed to batch create lecture records:', error);
    res.status(500).json({ error: 'Failed to batch create lecture records' });
  }
});

// Export lecture records to Excel（排除占位记录）
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    
    let query = "SELECT * FROM teaching_observations WHERE date != '1970-01-01'";
    const params: any[] = [];
    
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY date DESC, created_at DESC';
    
    const records = db.prepare(query).all(...params) as any[];
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('听课记录');
    
    // Define columns
    worksheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '节数', key: 'period', width: 8 },
      { header: '听课教师姓名', key: 'observer_teacher_name', width: 15 },
      { header: '授课教师姓名', key: 'teaching_teacher_name', width: 15 },
      { header: '班级', key: 'class', width: 12 },
      { header: '备注', key: 'notes', width: 30 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Add data rows
    records.forEach((record) => {
      worksheet.addRow({
        date: record.date,
        period: record.period || 1,
        observer_teacher_name: record.observer_teacher_name,
        teaching_teacher_name: record.teaching_teacher_name,
        class: record.class,
        notes: record.notes || ''
      });
    });
    
    // Generate filename
    const filename = `教师听课记录_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
    
    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    
    logger.info('Lecture records exported', {
      count: records.length,
      startDate,
      endDate,
      filename
    });
    
    res.end();
  } catch (error: any) {
    logger.error('Failed to export lecture records:', error);
    res.status(500).json({ error: 'Failed to export lecture records' });
  }
});

export default router;

