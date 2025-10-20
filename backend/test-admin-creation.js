// 简单的测试脚本来验证管理员创建功能
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto-js');
const path = require('path');
const fs = require('fs');

const DB_PATH = './data/test-database.db';

// 删除旧的测试数据库
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('已删除旧测试数据库');
}

// 创建数据库
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// 创建用户表
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

// 生成随机密码
function generateRandomPassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// 加密密码
function encryptPassword(password, securityAnswer) {
  return crypto.AES.encrypt(password, securityAnswer).toString();
}

// 创建管理员
async function createDefaultAdmin() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  if (userCount.count > 0) {
    console.log('已存在用户，跳过创建管理员');
    return null;
  }
  
  const password = generateRandomPassword(16);
  const username = 'admin';
  const securityQuestion = '默认密保问题（首次登录后必须修改）';
  const securityAnswer = 'default';
  
  const passwordHash = await bcrypt.hash(password, 10);
  const encryptedPassword = encryptPassword(password, securityAnswer);
  
  db.prepare(`
    INSERT INTO users (username, password_hash, security_question, encrypted_password, must_change_password)
    VALUES (?, ?, ?, ?, 1)
  `).run(username, passwordHash, securityQuestion, encryptedPassword);
  
  console.log('='.repeat(80));
  console.log('✅ 管理员账户创建成功！');
  console.log('用户名: admin');
  console.log('密码:', password);
  console.log('必须修改密码:', true);
  console.log('='.repeat(80));
  
  return password;
}

// 执行测试
createDefaultAdmin().then(() => {
  // 验证用户是否创建成功
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  console.log('\n验证结果:');
  console.log('用户ID:', user.id);
  console.log('用户名:', user.username);
  console.log('必须修改密码:', user.must_change_password === 1);
  console.log('密保问题:', user.security_question);
  
  db.close();
  console.log('\n✅ 测试完成！');
}).catch(err => {
  console.error('❌ 测试失败:', err);
  db.close();
});
