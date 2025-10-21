// 测试待处理记录 API
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:3000/api';

async function test() {
  try {
    // 1. 登录获取token
    console.log('1. 登录...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'Admin@123' // 使用你的实际管理员密码
    });
    
    const token = loginRes.data.token;
    console.log('✓ 登录成功，token:', token.substring(0, 20) + '...');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // 2. 测试 AI 导入（故意使用不存在的学生姓名）
    console.log('\n2. 测试 AI 导入...');
    const aiImportRes = await axios.post(
      `${API_BASE}/scores/ai-import`,
      {
        records: [
          {
            name: '张三',
            className: '1班',
            teacherName: '李老师',
            points: 2,
            reason: '测试原因1',
            date: '2025-10-21'
          },
          {
            name: '不存在的学生XYZ',
            className: '2班',
            teacherName: '王老师',
            points: 3,
            reason: '测试原因2',
            date: '2025-10-21'
          }
        ]
      },
      { headers }
    );
    
    console.log('✓ AI 导入响应:', JSON.stringify(aiImportRes.data, null, 2));
    
    // 3. 获取待处理记录
    console.log('\n3. 获取待处理记录...');
    const pendingRes = await axios.get(`${API_BASE}/scores/pending`, { headers });
    
    console.log('✓ 待处理记录数量:', pendingRes.data.records.length);
    console.log('✓ 第一条记录:', JSON.stringify(pendingRes.data.records[0], null, 2));
    
    // 检查字段名
    if (pendingRes.data.records.length > 0) {
      const record = pendingRes.data.records[0];
      console.log('\n字段检查:');
      console.log('  - studentName:', record.studentName);
      console.log('  - class:', record.class);
      console.log('  - teacherName:', record.teacherName);
      console.log('  - points:', record.points);
      console.log('  - reason:', record.reason);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

test();
