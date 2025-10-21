import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import nodeCrypto from 'crypto';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || './data/database.db';

// 确保数据目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db: Database.Database = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表
export function initializeDatabase() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      security_question TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 学生表
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 教师表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT,
      phone TEXT,
      email TEXT,
      teaching_classes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 添加新字段（如果不存在）
  try {
    db.exec(`ALTER TABLE teachers ADD COLUMN grade TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }

  try {
    db.exec(`ALTER TABLE teachers ADD COLUMN phone TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }

  try {
    db.exec(`ALTER TABLE teachers ADD COLUMN email TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }

  try {
    db.exec(`ALTER TABLE teachers ADD COLUMN teaching_classes TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 积分记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      points REAL NOT NULL,
      reason TEXT,
      teacher_name TEXT,
      date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // 日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 备份记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_size INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
    CREATE INDEX IF NOT EXISTS idx_scores_student_id ON scores(student_id);
    CREATE INDEX IF NOT EXISTS idx_scores_date ON scores(date);
    CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
  `);

  console.log('Database initialized');
}

// Encrypt password (for backup recovery) using Node.js crypto
export function encryptPassword(password: string, securityAnswer: string): string {
  const algorithm = 'aes-256-cbc';
  const key = nodeCrypto.createHash('sha256').update(securityAnswer).digest();
  const iv = nodeCrypto.randomBytes(16);
  
  const cipher = nodeCrypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt password using Node.js crypto
export function decryptPassword(encryptedPassword: string, securityAnswer: string): string {
  const algorithm = 'aes-256-cbc';
  const key = nodeCrypto.createHash('sha256').update(securityAnswer).digest();
  
  const parts = encryptedPassword.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = nodeCrypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// 检查用户数量（系统只允许单个用户）
export function getUserCount(): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return result.count;
}

// 验证是否可以创建新用户（只在没有用户时允许）
export function canCreateUser(): boolean {
  return getUserCount() === 0;
}

// Generate random password (16 characters, includes uppercase, lowercase, numbers and special characters)
export function generateRandomPassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one character of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Create default admin account
export async function createDefaultAdmin(): Promise<string | null> {
  try {
    // Check if users already exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (userCount.count > 0) {
      console.log('Users already exist, skipping admin creation');
      return null;
    }
    
    // Generate random password
    const password = generateRandomPassword(16);
    const username = 'admin';
    const securityQuestion = 'Default security question (must be changed on first login)';
    const securityAnswer = 'default';
    
    // Encrypt password
    const passwordHash = await bcrypt.hash(password, 10);
    const encryptedPassword = encryptPassword(password, securityAnswer);
    
    // Create admin user, mark as must change password
    db.prepare(`
      INSERT INTO users (username, password_hash, security_question, encrypted_password, must_change_password)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, passwordHash, securityQuestion, encryptedPassword);
    
    console.log('='.repeat(80));
    console.log('FIRST RUN: Admin account created automatically');
    console.log('Username: admin');
    console.log('Password:', password);
    console.log('WARNING: Please save this password! You must change it on first login!');
    console.log('='.repeat(80));
    
    // Write password to log file
    const logDir = path.dirname('./logs/admin-password.txt');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(
      './logs/admin-password.txt',
      `Admin Account Information\nCreated: ${new Date().toLocaleString('en-US')}\nUsername: admin\nInitial Password: ${password}\n\nWARNING: Change password and set security question on first login!\nWARNING: Delete this file after reading!\n`,
      'utf-8'
    );
    
    return password;
  } catch (error) {
    console.error('Failed to create default admin account:', error);
    return null;
  }
}

export default db;
