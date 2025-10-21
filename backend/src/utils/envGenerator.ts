import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 自动生成 .env 文件（如果不存在）
 * 这个函数必须在任何需要环境变量的模块被导入之前调用
 */
export function ensureEnvFile(): void {
  // 在编译后的代码中，__dirname 会是 dist/utils/
  // 所以我们需要回到项目根目录的 backend/
  const projectRoot = path.join(__dirname, '../..');
  const envPath = path.join(projectRoot, '.env');
  const envExamplePath = path.join(projectRoot, '.env.example');

  // 如果 .env 文件已存在，直接返回
  if (fs.existsSync(envPath)) {
    return;
  }

  console.log('检测到首次运行，正在生成 .env 配置文件...');
  console.log(`__dirname resolved to: ${__dirname}`);
  
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ 错误：找不到 .env.example 文件');
    console.error(`查找路径: ${envExamplePath}`);
    process.exit(1);
  }

  try {
    // 读取 .env.example 内容
    let envContent = fs.readFileSync(envExamplePath, 'utf-8');
    
    // 生成随机的 JWT_SECRET（64字符十六进制 = 32字节）
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(
      'JWT_SECRET=your-secret-key-change-this-in-production',
      `JWT_SECRET=${jwtSecret}`
    );
    
    // 生成随机的 ENCRYPTION_KEY（64字符十六进制 = 32字节）
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(
      'ENCRYPTION_KEY=your-encryption-key-change-this',
      `ENCRYPTION_KEY=${encryptionKey}`
    );
    
    // 写入 .env 文件
    fs.writeFileSync(envPath, envContent, 'utf-8');
    
    console.log('✅ .env 配置文件已生成');
    console.log('🔐 已自动生成安全密钥（JWT_SECRET 和 ENCRYPTION_KEY）');
    console.log(`📁 文件位置: ${envPath}`);
  } catch (error) {
    console.error('❌ 生成 .env 文件时出错:', error);
    process.exit(1);
  }
}
