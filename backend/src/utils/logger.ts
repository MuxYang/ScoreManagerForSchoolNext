import winston from 'winston';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

// 日志目录位于根目录
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'debug'; // 提高默认日志级别到 debug

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 生成当前 session 的日志文件名（格式：YYYY-MM-DD-HHmmss）
const SESSION_START_TIME = new Date();
const SESSION_TIMESTAMP = SESSION_START_TIME.toISOString()
  .replace(/T/, '-')
  .replace(/:/g, '')
  .replace(/\..+/, '')
  .substring(0, 17); // YYYY-MM-DD-HHmmss

const SESSION_LOG_FILE = path.join(LOG_DIR, `session-${SESSION_TIMESTAMP}.log`);
const SESSION_ERROR_FILE = path.join(LOG_DIR, `session-${SESSION_TIMESTAMP}-error.log`);

/**
 * 压缩上一次运行的日志文件
 */
async function compressPreviousLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const logFiles = files.filter(f => 
      f.startsWith('session-') && 
      f.endsWith('.log') && 
      !f.includes(SESSION_TIMESTAMP)
    );

    if (logFiles.length === 0) {
      console.log('没有需要压缩的旧日志文件');
      return;
    }

    // 按文件名排序，获取最新的一组日志
    logFiles.sort().reverse();
    
    // 找出最新的 session（可能有 .log 和 -error.log 两个文件）
    const latestSession = logFiles[0].match(/session-(\d{4}-\d{2}-\d{2}-\d{6})/)?.[1];
    
    if (!latestSession) return;

    const filesToCompress = logFiles.filter(f => f.includes(latestSession));
    const zipFileName = path.join(LOG_DIR, `session-${latestSession}.zip`);

    // 如果已经存在 zip 文件，跳过
    if (fs.existsSync(zipFileName)) {
      // 删除原始日志文件
      filesToCompress.forEach(f => {
        const filePath = path.join(LOG_DIR, f);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return;
    }

    console.log(`正在压缩上一次的日志文件: ${filesToCompress.join(', ')}`);

    // 创建 zip 压缩流
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        console.log(`日志已压缩: ${zipFileName} (${archive.pointer()} bytes)`);
        
        // 删除原始日志文件
        filesToCompress.forEach(f => {
          const filePath = path.join(LOG_DIR, f);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`已删除原始日志: ${f}`);
          }
        });
        
        resolve();
      });

      archive.on('error', (err: Error) => {
        console.error('压缩日志文件失败:', err);
        reject(err);
      });

      archive.pipe(output);

      // 添加日志文件到压缩包
      filesToCompress.forEach(f => {
        const filePath = path.join(LOG_DIR, f);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: f });
        }
      });

      archive.finalize();
    });
  } catch (error) {
    console.error('压缩上一次日志时出错:', error);
  }
}

// 启动时压缩上一次的日志
compressPreviousLogs();

// 详细的日志格式，包含更多元数据
const detailedLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level.toUpperCase().padEnd(5)}]`;
    
    // 添加调用位置信息（如果有）
    const meta = metadata as any;
    if (meta?.caller) {
      log += ` [${meta.caller}]`;
    }
    
    log += `: ${message}`;
    
    // 添加元数据
    const metaKeys = Object.keys(meta || {}).filter(k => k !== 'caller');
    if (metaKeys.length > 0) {
      const metaObj: any = {};
      metaKeys.forEach(k => metaObj[k] = meta[k]);
      log += `\n  └─ ${JSON.stringify(metaObj, null, 2).replace(/\n/g, '\n     ')}`;
    }
    
    // 添加堆栈信息
    if (stack) {
      log += `\n  └─ Stack: ${stack}`;
    }
    
    return log;
  })
);

// 控制台输出格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    
    // 过滤掉内部元数据
    const filteredMeta = { ...meta };
    delete filteredMeta.timestamp;
    delete filteredMeta.level;
    delete filteredMeta.message;
    
    if (Object.keys(filteredMeta).length > 0) {
      msg += ` ${JSON.stringify(filteredMeta)}`;
    }
    return msg;
  })
);

// 创建日志记录器
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    // 控制台输出（简洁格式）
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // 当前 session 的完整日志文件（详细格式）
    new winston.transports.File({
      filename: SESSION_LOG_FILE,
      format: detailedLogFormat,
      level: 'debug', // 记录所有级别
    }),
    // 当前 session 的错误日志文件（详细格式）
    new winston.transports.File({
      filename: SESSION_ERROR_FILE,
      format: detailedLogFormat,
      level: 'error', // 只记录错误
    }),
  ],
});

// 记录 session 启动信息
logger.info('='.repeat(80));
logger.info(`日志 Session 开始: ${SESSION_TIMESTAMP}`);
logger.info(`日志文件: ${SESSION_LOG_FILE}`);
logger.info(`错误日志文件: ${SESSION_ERROR_FILE}`);
logger.info(`日志级别: ${LOG_LEVEL}`);
logger.info('='.repeat(80));

export default logger;
