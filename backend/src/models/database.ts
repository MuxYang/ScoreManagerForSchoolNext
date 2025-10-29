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

  // Teacher quantification records table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      teacher_name TEXT NOT NULL,
      points REAL NOT NULL,
      reason TEXT,
      class TEXT,
      subject TEXT,
      date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Teaching observation records table (听课记录表)
  db.exec(`
    CREATE TABLE IF NOT EXISTS teaching_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      observer_teacher_name TEXT NOT NULL,
      teaching_teacher_name TEXT NOT NULL,
      class TEXT NOT NULL,
      date DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 待处理量化记录表（用于AI导入时无法精确匹配的记录）
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name TEXT NOT NULL,
      class_name TEXT,
      teacher_name TEXT,
      subject TEXT,
      points REAL NOT NULL,
      reason TEXT,
      others TEXT,
      date DATE DEFAULT CURRENT_DATE,
      raw_data TEXT,
      match_suggestions TEXT,
      status TEXT DEFAULT 'pending',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  // 添加新字段（如果不存在）
  try {
    db.exec(`ALTER TABLE pending_scores ADD COLUMN subject TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }
  
  try {
    db.exec(`ALTER TABLE pending_scores ADD COLUMN others TEXT`);
  } catch (err) {
    // 字段已存在，忽略错误
  }

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
    CREATE INDEX IF NOT EXISTS idx_scores_student_id ON scores(student_id);
    CREATE INDEX IF NOT EXISTS idx_scores_date ON scores(date);
    CREATE INDEX IF NOT EXISTS idx_teacher_scores_teacher_id ON teacher_scores(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_scores_date ON teacher_scores(date);
    CREATE INDEX IF NOT EXISTS idx_teaching_observations_date ON teaching_observations(date);
    CREATE INDEX IF NOT EXISTS idx_teaching_observations_observer ON teaching_observations(observer_teacher_name);
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

// 检查用户数量
export function getUserCount(): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return result.count;
}

// 验证是否可以创建新用户（管理员可以创建，或者没有用户时）
export function canCreateUser(isAdmin: boolean = false): boolean {
  return isAdmin || getUserCount() === 0;
}

// 检查用户是否为管理员
export function isAdminUser(userId: number): boolean {
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
  return user && user.username === 'admin';
}

// 获取所有用户（不包括密码等敏感信息）
export function getAllUsers(): any[] {
  return db.prepare(`
    SELECT id, username, created_at, updated_at, must_change_password
    FROM users
    ORDER BY created_at
  `).all();
}

// 创建新用户（管理员功能）
export async function createUser(username: string, password: string, createdBy: number, mustChangePassword: boolean = true): Promise<number> {
  const bcrypt = require('bcryptjs');
  
  // 检查用户名是否已存在
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    throw new Error('用户名已存在');
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  const defaultSecurityQuestion = '请在首次登录时设置密保问题';
  const defaultSecurityAnswer = 'default';
  
  // 使用默认密保答案加密密码
  const encryptedPassword = encryptPassword(password, defaultSecurityAnswer);
  
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, security_question, encrypted_password, must_change_password)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, passwordHash, defaultSecurityQuestion, encryptedPassword, mustChangePassword ? 1 : 0);
  
  // 记录创建日志
  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(createdBy, 'CREATE_USER', `创建用户: ${username}, 需要修改密码: ${mustChangePassword}`);
  
  return result.lastInsertRowid as number;
}

// 重置用户密码（管理员功能）
export async function resetUserPassword(userId: number, newPassword: string, resetBy: number): Promise<void> {
  const bcrypt = require('bcryptjs');
  
  // 获取用户信息
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 检查是否尝试重置自己的密码
  if (userId === resetBy) {
    throw new Error('不能重置自己的密码');
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const defaultSecurityAnswer = 'default';
  const encryptedPassword = encryptPassword(newPassword, defaultSecurityAnswer);
  
  // 重置密码并强制用户在下次登录时修改
  db.prepare(`
    UPDATE users 
    SET password_hash = ?, 
        encrypted_password = ?, 
        security_question = '请在首次登录时设置密保问题',
        must_change_password = 1, 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(passwordHash, encryptedPassword, userId);
  
  // 记录重置日志
  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(resetBy, 'RESET_PASSWORD', `重置用户密码: ${user.username}`);
}

// 删除用户（管理员功能，不能删除管理员自己）
export function deleteUser(userId: number, deletedBy: number): void {
  // 检查是否是管理员账户
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    throw new Error('用户不存在');
  }
  
  if (user.username === 'admin') {
    throw new Error('不能删除管理员账户');
  }
  
  if (userId === deletedBy) {
    throw new Error('不能删除自己的账户');
  }
  
  // 删除用户
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  
  // 记录删除日志
  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(deletedBy, 'DELETE_USER', `删除用户: ${user.username}`);
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
