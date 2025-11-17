import express, { Request, Response } from 'express';
import db from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import multer from 'multer';
import ExcelJS from 'exceljs';
import stream from 'stream';
import { fuzzyMatchPinyin } from '../utils/pinyinMatcher';
// import AI/解析等工具按需后续添加

const upload = multer({ storage: multer.memoryStorage(), limits: {fileSize: 5*1024*1024} });

const router = express.Router();

router.use(authenticateToken);

// 获取所有加班记录（支持传入 start/endDate，排除占位记录）
// Return aggregated statistics only (no teacher names)
router.get('/', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = "SELECT position, COUNT(*) as total_records, COUNT(DISTINCT teacher_name) as teacher_count FROM overtime_records WHERE overtime_time != '1970-01-01 00:00:00'";
    const params: any[] = [];
    if (startDate) { sql += ' AND overtime_time >= ?'; params.push(startDate); }
    if (endDate)   { sql += ' AND overtime_time <= ?'; params.push(endDate); }
    sql += ' GROUP BY position ORDER BY position';
    const stats = db.prepare(sql).all(...params);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get aggregated overtime stats', { error });
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// 按职位分组，统计加班总数和明细（聚合结构，详情为数组，标题同API需求）
// Grouped statistics per position. Do NOT return teacher names here; instead return anonymous teacher ids (if available) and counts.
router.get('/grouped', (req, res) => {
  try {
    // 获取所有教师，并左连接加班记录统计次数
    const sql = `
      SELECT 
        t.id as teacher_id,
        t.name as teacher_name,
        t.subject as position,
        COALESCE(COUNT(CASE WHEN o.overtime_time != '1970-01-01 00:00:00' THEN 1 END), 0) as count
      FROM teachers t
      LEFT JOIN overtime_records o ON t.name = o.teacher_name
      GROUP BY t.id, t.name, t.subject
      ORDER BY t.subject, t.id
    `;
    
    const results = db.prepare(sql).all() as any[];

    // 按职位分组
    const grouped: Record<string, Array<{teacher_id: number, teacher_name: string, count: number}>> = {};
    results.forEach((row: any) => {
      if (!grouped[row.position]) {
        grouped[row.position] = [];
      }
      grouped[row.position].push({ 
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        count: row.count 
      });
    });

    res.json({ success: true, data: grouped });
  } catch (error) {
    logger.error('Failed to get grouped overtime stats', { error });
    res.status(500).json({ error: 'Failed to retrieve grouped statistics' });
  }
});

// 明细接口：按职位和教师查全部加班时间明细（排除占位记录）
// detail by position + teacher_name (kept for compatibility)
router.get('/detail', (req, res) => {
  const { position, teacher_name } = req.query;
  if (!position || !teacher_name) return res.status(400).json({ error: 'missing parameters' });
  const sql = `SELECT overtime_time, note FROM overtime_records 
               WHERE position = ? AND teacher_name = ? AND overtime_time != '1970-01-01 00:00:00' 
               ORDER BY overtime_time DESC`;
  const data = db.prepare(sql).all(position, teacher_name);
  res.json({ success: true, data });
});

// detail by teacher id - returns teacher name and their overtime entries
router.get('/detail-by-id', (req, res) => {
  const { teacher_id } = req.query;
  if (!teacher_id) return res.status(400).json({ error: 'missing teacher_id' });
  const teacher = db.prepare(`SELECT id, name, subject FROM teachers WHERE id = ?`).get(teacher_id) as any;
  if (!teacher) return res.status(404).json({ error: 'teacher not found' });
  const sql = `SELECT overtime_time, note FROM overtime_records WHERE teacher_name = ? AND overtime_time != '1970-01-01 00:00:00' ORDER BY overtime_time DESC`;
  const data = db.prepare(sql).all(teacher.name);
  res.json({ success: true, teacher: { id: teacher.id, name: teacher.name, subject: teacher.subject }, data });
});

/**
 * 按拼音匹配同职位的教师
 * 优先匹配同职位的教师，如果没有则返回原名称
 * @param name 教师姓名
 * @param position 职位/科目
 * @returns 匹配的标准教师名称
 */
function matchTeacherByPosition(name: string, position: string): string {
  try {
    // 1. 先尝试精确匹配
    const exactMatch = db.prepare(`
      SELECT DISTINCT name FROM teachers WHERE name = ? AND subject = ?
    `).get(name, position) as { name: string } | undefined;
    
    if (exactMatch) {
      return exactMatch.name;
    }
    
    // 2. 尝试拼音匹配同科目的教师
    const sameSubjectTeachers = db.prepare(`
      SELECT DISTINCT name FROM teachers WHERE subject = ?
    `).all(position) as Array<{ name: string }>;
    
    for (const teacher of sameSubjectTeachers) {
      if (fuzzyMatchPinyin(teacher.name, name)) {
        return teacher.name;
      }
    }
    
    // 3. 如果没有匹配到同科目教师，尝试所有教师的拼音匹配
    const allTeachers = db.prepare(`
      SELECT DISTINCT name, subject FROM teachers
    `).all() as Array<{ name: string; subject: string }>;
    
    for (const teacher of allTeachers) {
      if (fuzzyMatchPinyin(teacher.name, name)) {
        return teacher.name;
      }
    }
    
    // 4. 没有匹配到任何教师，返回原名称
    return name;
  } catch (error) {
    console.error('Error matching teacher by position:', error);
    return name;
  }
}

/**
 * 确保教师在数据库中存在
 * 如果教师不存在，自动添加到对应科目组
 * @param name 教师姓名
 * @param position 职位/科目
 * @returns 标准化后的教师名称
 */
function ensureTeacherExists(name: string, position: string): string | null {
  try {
    // Attempt phonetic/pinyin match first
    const matchedName = matchTeacherByPosition(name, position);

    // If matched to an existing teacher name, return it
    if (matchedName && matchedName !== name) {
      return matchedName;
    }

    // Check if exact name exists
    const existing = db.prepare(`SELECT id FROM teachers WHERE name = ?`).get(name) as { id: number } | undefined;
    if (existing) {
      return name;
    }

    // Do NOT auto-add teachers here. Return null to indicate no match.
    return null;
  } catch (error) {
    logger.error('Error ensuring teacher exists', { error });
    return null;
  }
}

// 批量导入加班名单（职位+多人，xlsx/csv/txt格式）
router.post('/import-namelist', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未检测到文件' });
    }

    const file = req.file as Express.Multer.File;
    const filename = file.originalname.toLowerCase();
    
    if (!filename.endsWith('.csv') && !filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return res.status(400).json({ error: '仅支持 .csv, .xlsx, .xls 格式' });
    }

    const workbook = new ExcelJS.Workbook();
    if (filename.endsWith('.csv')) {
      await workbook.csv.read(stream.Readable.from(file.buffer));
    } else {
      // @ts-expect-error exceljs Buffer 类型声明不兼容，实际运行无问题
      await workbook.xlsx.load(file.buffer);
    }

    const arr: Array<{ position: string; employee_number: string; name: string }> = [];
    
    // 读取第一个工作表
    workbook.eachSheet((sheet: any) => {
      sheet.eachRow((row: any, rowIndex: number) => {
        if (rowIndex === 1) return; // 跳过表头
        
        const values = row.values;
        if (!Array.isArray(values) || values.length < 4) return;
        
        // A列=职位(index 1), B列=编号(index 2), C列=姓名(index 3)
        const position = String(values[1] || '').trim();
        const employee_number = String(values[2] || '').trim();
        const name = String(values[3] || '').trim();
        
        if (position && name) {
          arr.push({ position, employee_number, name });
        }
      });
    });

    if (!arr.length) {
      return res.status(400).json({ error: '未能识别有效的教师数据' });
    }

    // 准备语句：查询、插入、更新
    const checkStmt = db.prepare('SELECT id FROM teachers WHERE name = ?');
    const insertStmt = db.prepare('INSERT INTO teachers (name, subject, employee_number) VALUES (?, ?, ?)');
    const updateStmt = db.prepare('UPDATE teachers SET subject = ?, employee_number = ? WHERE name = ?');

    let success = 0;
    let failed = 0;
    let updated = 0;

    arr.forEach(item => {
      try {
        const existing = checkStmt.get(item.name);
        if (existing) {
          // 教师已存在，更新信息
          updateStmt.run(item.position, item.employee_number, item.name);
          updated++;
        } else {
          // 新教师，插入
          insertStmt.run(item.name, item.position, item.employee_number);
        }
        success++;
      } catch (e) {
        logger.error('Teacher import failed for item', { item, error: e });
        failed++;
      }
    });

    return res.json({
      success: true,
      successCount: success,
      failedCount: failed,
      updatedCount: updated,
      message: `成功导入 ${success} 位教师${updated > 0 ? `（其中 ${updated} 位已更新）` : ''}${failed > 0 ? `，失败 ${failed} 位` : ''}`
    });
  } catch (e) {
    logger.error('Import namelist failed', { error: e });
    return res.status(500).json({ error: '处理导入失败: ' + e });
  }
});

// 批量导入加班数据（文本/AI）
// 注意：这个路由需要处理两种格式：multipart/form-data（文件上传）和 application/json（纯文本）
router.post('/import-data', (req, res, next) => {
  // 检查 Content-Type，如果是 JSON 则跳过 multer
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('application/json')) {
    next();
  } else {
    upload.single('file')(req, res, next);
  }
}, async (req, res) => {
  try {
    const aiMode = req.body.ai === 'true' || req.body.ai === true;
    let content = '';
    if (req.file) {
      const file = req.file as Express.Multer.File;
      const filename = file.originalname.toLowerCase();
      if (filename.endsWith('.txt')) content = file.buffer.toString('utf-8');
      else {
        const workbook = new ExcelJS.Workbook();
        if (filename.endsWith('.csv')) {
          await workbook.csv.read(stream.Readable.from(file.buffer));
        } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
          // @ts-expect-error exceljs Buffer 类型声明不兼容，实际运行无问题
          await workbook.xlsx.load(file.buffer);
        } else return res.status(400).json({ error: '仅支持xlsx/csv/txt' });
        let tmp: string[] = [];
        workbook.eachSheet((sheet: any) => { sheet.eachRow((row: any) => { tmp.push(Array.isArray(row.values) ? row.values.join(' ') : ''); }); });
        content = tmp.join('\n');
      }
    } else if (typeof req.body.text==='string') {
      content = req.body.text;
    } else {
      return res.status(400).json({ error:'未检测到数据' });
    }
    if (aiMode) {
      // AI模式：使用流式响应（与量化导入一致）
      // 从 Cookie 中读取 AI 配置（与量化管理页面共用配置）
      const authReq = req as AuthRequest;
      const encryptedConfig = authReq.cookies?.userConfig;
      
      if (!encryptedConfig) {
        return res.status(400).json({ error: 'AI未配置，请先在量化管理页面配置AI' });
      }

      let aiConfig: any;
      try {
        const { decryptUserConfig } = require('../utils/userConfigEncryption');
        const decryptedConfig = decryptUserConfig(encryptedConfig);
        aiConfig = JSON.parse(decryptedConfig);
      } catch (error) {
        return res.status(400).json({ error: 'AI配置解析失败' });
      }

      if (!aiConfig.apiKey || !aiConfig.apiUrl || !aiConfig.model) {
        return res.status(400).json({ error: 'AI配置不完整，请在量化管理页面重新配置' });
      }

      // 设置响应头为流式传输
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const today = new Date().toISOString().slice(0, 10);
      
    // Simplified AI prompt: only ask for position and teacher_name.
    const systemPrompt = `You are an assistant that extracts teacher roster entries from text.\nOnly output a JSON array where each item has exactly two fields: \"position\" and \"teacher_name\".\nDo NOT output any other fields, comments, or non-JSON text.`;

    const prompt = systemPrompt + '\n\nUser input:\n' + content;

      try {
        const response = await fetch(aiConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: aiConfig.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            temperature: 0.3
          })
        });

        if (!response.ok || !response.body) {
          throw new Error(`AI API 请求失败: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  res.write(`data: ${JSON.stringify({ type: 'content', content })}\n\n`);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
      return;
    }
    // 本地解析
    // 核心提取 1.时间 2.职位 3.姓名 4.备注（容错）
    const today = new Date().toISOString().split('T')[0];
    const lines = content.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    // 拆分规则如“xx:xx检查在校教师”或“职位:姓名 时间”
    const reTime = /(\d{1,2}:\d{2})/;
    const rePositionBlock = /^(.+?)(\(共.*?\))?[:：]([\s\S]+)$/;
    let arr: any[] = [];
    lines.forEach(line=>{
      let timeMatch = line.match(reTime);
      let overtime_time = timeMatch ? today+'T'+timeMatch[1]+':00' : today;
      let note = line;
      // 尝试职位-姓名-备注分割
      const posMatch = line.match(rePositionBlock);
      if(posMatch){
        const position = posMatch[1].trim();
        let users = posMatch[3].trim();
        users.split(/[、,;；， \t]+/).map(u=>u.trim()).filter(Boolean).forEach(name=>{
          arr.push({position, teacher_name: name, overtime_time, note});
        });
      } else {
        // 找到第一个冒号前为职位，后为姓名，后可有备注和时间
        let col = line.split(/[:：]/);
        if(col.length>=2){
          let position = col[0].trim();
          let teacher_name = col[1].split(/[、,;；，\s]/)[0] || '';
          arr.push({position, teacher_name, overtime_time, note });
        } // 兜底略
      }
    });
    if(!arr.length) return res.status(400).json({error:'未能识别加班数据'});
    
    // Insert records but DO NOT auto-add teachers. Count unmatched entries and skip them.
    const insertStmt = db.prepare(`INSERT INTO overtime_records (teacher_name, position, overtime_time, note) VALUES (?,?,?,?)`);
    let success = 0; let failed = 0; let matched = 0; let unmatched = 0; let needsSelection = 0;

    arr.forEach(i => {
      try {
        const standardName = ensureTeacherExists(i.teacher_name, i.position);
        if (!standardName) {
          unmatched++;
          failed++;
          return;
        }

        if (standardName !== i.teacher_name) matched++;

        insertStmt.run(standardName, i.position, i.overtime_time, i.note);
        success++;
      } catch (e) {
        logger.error('Failed to import overtime record', { item: i, error: e });
        failed++;
      }
    });

    res.json({
      success: true,
      successCount: success,
      failedCount: failed,
      matchedCount: matched,
      unmatchedCount: unmatched,
      message: `Imported ${success} records. ${matched} matched existing names. ${unmatched} entries were not matched and skipped.`
    });
  }catch(e){ res.status(500).json({error:'导入加班记录失败'+e}); }
});

// Get time points configuration
router.get('/time-points', (req, res) => {
  try {
    // Default time points - can be stored in database in future
    const timePoints = [
      '07:30',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '18:30',
      '19:00',
      '20:00',
      '21:30'
    ];
    res.json({ success: true, data: timePoints });
  } catch (error) {
    logger.error('Failed to get time points', { error });
    res.status(500).json({ error: 'Failed to retrieve time points' });
  }
});

// Process AI parsed overtime data (with time_point field in HH:mm format)
router.post('/import-ai-parsed', authenticateToken, (req: Request, res: Response) => {
  try {
    const { data, defaultTimePoint } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    const today = new Date().toISOString().split('T')[0];
    const insertStmt = db.prepare(`INSERT INTO overtime_records (teacher_name, position, overtime_time, note) VALUES (?,?,?,?)`);
    
    let success = 0; let failed = 0; let matched = 0; let unmatched = 0; let needsSelection = 0;

    data.forEach((item: any) => {
      try {
        const { position, teacher_name, time_point, note } = item;

        if (!position || !teacher_name) {
          failed++;
          return;
        }

        const standardName = ensureTeacherExists(teacher_name, position);
        if (!standardName) {
          // teacher not found, skip
          unmatched++;
          failed++;
          return;
        }

        if (standardName !== teacher_name) matched++;

        // Use time_point from data, or defaultTimePoint, or placeholder
        let overtime_time: string;
        if (time_point && /^\d{2}:\d{2}$/.test(time_point)) {
          overtime_time = `${today}T${time_point}:00`;
        } else if (defaultTimePoint && /^\d{2}:\d{2}$/.test(defaultTimePoint)) {
          overtime_time = `${today}T${defaultTimePoint}:00`;
          needsSelection++;
        } else {
          overtime_time = '1970-01-01 00:00:00'; // Placeholder for manual selection
          needsSelection++;
        }

        insertStmt.run(standardName, position, overtime_time, note || '');
        success++;
      } catch (e) {
        logger.error('Failed to import AI parsed data', { item, error: e });
        failed++;
      }
    });

    res.json({
      success: true,
      successCount: success,
      failedCount: failed,
      matchedCount: matched,
      unmatchedCount: unmatched,
      needsSelection,
      message: `Imported ${success} records. ${matched} matched existing names. ${needsSelection} entries need time point selection.`
    });
  } catch (e) {
    logger.error('Failed to process AI parsed data', { error: e });
    res.status(500).json({ error: 'Failed to process AI data: ' + e });
  }
});

// Export overtime records in new format
router.post('/export', async (req, res) => {
  try {
    const { date } = req.body;
    
    // Validate parameters
    if (!date) {
      return res.status(400).json({ error: 'Date required for export' });
    }
    
    // 从配置表中获取所有时间点
    const timePointsResult = db.prepare(`
      SELECT time_point FROM overtime_time_points ORDER BY time_point
    `).all() as any[];
    
    const timePoints = timePointsResult.map((row: any) => row.time_point);

    // Get all teachers (ordered by ID)
    const teachers = db.prepare(`SELECT id, name, subject, employee_number FROM teachers ORDER BY id ASC`).all() as any[];

    // Query records for specified date
    const sql = `SELECT * FROM overtime_records 
                 WHERE overtime_time != '1970-01-01 00:00:00' 
                 AND DATE(overtime_time) = ?
                 ORDER BY position, teacher_name, overtime_time`;
    const records = db.prepare(sql).all(date) as any[];

    // Create a map of teacher overtime records by teacher name
    interface OvertimeData {
      timePoints: Set<string>; // time points for this teacher on the specified date
    }
    
    const overtimeMap = new Map<string, OvertimeData>();
    
    records.forEach((record: any) => {
      const date = record.overtime_time.split('T')[0];
      const timePoint = record.overtime_time.split('T')[1]?.substring(0, 5) || '';
      
      if (!overtimeMap.has(record.teacher_name)) {
        overtimeMap.set(record.teacher_name, {
          timePoints: new Set()
        });
      }
      
      overtimeMap.get(record.teacher_name)!.timePoints.add(timePoint);
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('加班记录');

    // Build header: 职位, 编号, 姓名, 时间点1, 时间点2, ...
    const header: string[] = ['职位', '编号', '姓名'];
    timePoints.forEach((tp: string) => header.push(tp));
    ws.addRow(header);

    // Build data rows: one row per teacher (all teachers, ordered by ID)
    // For each teacher, check if they have overtime at each time point
    teachers.forEach((teacher: any) => {
      const row: any[] = [teacher.subject || '', teacher.employee_number || '', teacher.name]; // 职位, 编号, 姓名
      const teacherOvertimeData = overtimeMap.get(teacher.name);
      
      timePoints.forEach((tp: string) => {
        // If this time point has a record, put '1', otherwise leave empty
        const hasRecord = teacherOvertimeData?.timePoints.has(tp) || false;
        row.push(hasRecord ? '1' : '');
      });
      
      ws.addRow(row);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="overtime-export.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    logger.error('Failed to export overtime records', { error: e });
    res.status(500).json({ error: 'Export failed: ' + e });
  }
});

export default router;
