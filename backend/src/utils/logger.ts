import winston from 'winston';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

// Log directory at root
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // Default log level: info (excludes debug)

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Generate current session log filename (format: YYYY-MM-DD-HHmmss)
const SESSION_START_TIME = new Date();
const SESSION_TIMESTAMP = SESSION_START_TIME.toISOString()
  .replace(/T/, '-')
  .replace(/:/g, '')
  .replace(/\..+/, '')
  .substring(0, 17); // YYYY-MM-DD-HHmmss

const SESSION_LOG_FILE = path.join(LOG_DIR, `session-${SESSION_TIMESTAMP}.log`);
const SESSION_ERROR_FILE = path.join(LOG_DIR, `session-${SESSION_TIMESTAMP}-error.log`);

/**
 * Compress previous run's log files
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
      console.log('No old log files to compress');
      return;
    }

    // Sort by filename, get the latest set of logs
    logFiles.sort().reverse();
    
    // Find the latest session (may have .log and -error.log files)
    const latestSession = logFiles[0].match(/session-(\d{4}-\d{2}-\d{2}-\d{6})/)?.[1];
    
    if (!latestSession) return;

    const filesToCompress = logFiles.filter(f => f.includes(latestSession));
    const zipFileName = path.join(LOG_DIR, `session-${latestSession}.zip`);

    // Skip if zip file already exists
    if (fs.existsSync(zipFileName)) {
      // Delete original log files
      filesToCompress.forEach(f => {
        const filePath = path.join(LOG_DIR, f);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      return;
    }

    console.log(`Compressing previous log files: ${filesToCompress.join(', ')}`);

    // Create zip compression stream
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        console.log(`Logs compressed: ${zipFileName} (${archive.pointer()} bytes)`);
        
        // Delete original log files
        filesToCompress.forEach(f => {
          const filePath = path.join(LOG_DIR, f);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted original log: ${f}`);
          }
        });
        
        resolve();
      });

      archive.on('error', (err: Error) => {
        console.error('Failed to compress log files:', err);
        reject(err);
      });

      archive.pipe(output);

      // Add log files to archive
      filesToCompress.forEach(f => {
        const filePath = path.join(LOG_DIR, f);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: f });
        }
      });

      archive.finalize();
    });
  } catch (error) {
    console.error('Error compressing previous logs:', error);
  }
}

// Compress previous logs on startup
compressPreviousLogs();

// Detailed log format with more metadata
const detailedLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level.toUpperCase().padEnd(5)}]`;
    
    // Add caller location info (if available)
    const meta = metadata as any;
    if (meta?.caller) {
      log += ` [${meta.caller}]`;
    }
    
    log += `: ${message}`;
    
    // Add metadata
    const metaKeys = Object.keys(meta || {}).filter(k => k !== 'caller');
    if (metaKeys.length > 0) {
      const metaObj: any = {};
      metaKeys.forEach(k => metaObj[k] = meta[k]);
      log += `\n  └─ ${JSON.stringify(metaObj, null, 2).replace(/\n/g, '\n     ')}`;
    }
    
    // Add stack trace
    if (stack) {
      log += `\n  └─ Stack: ${stack}`;
    }
    
    return log;
  })
);

// Console output format (with colors)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    
    // Filter out internal metadata
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

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    // Console output (concise format)
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Current session's full log file (detailed format)
    new winston.transports.File({
      filename: SESSION_LOG_FILE,
      format: detailedLogFormat,
      level: 'info', // Exclude debug level
      options: { encoding: 'utf8' },
    }),
    // Current session's error log file (detailed format)
    new winston.transports.File({
      filename: SESSION_ERROR_FILE,
      format: detailedLogFormat,
      level: 'error', // Only record errors
      options: { encoding: 'utf8' },
    }),
  ],
});

// Log session startup info
logger.info('='.repeat(80));
logger.info(`Log session started: ${SESSION_TIMESTAMP}`);
logger.info(`Log file: ${SESSION_LOG_FILE}`);
logger.info(`Error log file: ${SESSION_ERROR_FILE}`);
logger.info(`Log level: ${LOG_LEVEL}`);
logger.info('='.repeat(80));

export default logger;
