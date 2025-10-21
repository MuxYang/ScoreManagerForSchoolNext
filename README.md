# 学生扣分管理系统

基于 Web 的学生扣分管理系统，使用 TypeScript、React、Express 和 SQLite 构建。

## 功能特性

- 学生信息管理
- 教师信息管理
- 积分记录管理
- 数据导入导出（CSV 格式）
- 数据库备份恢复
- 深色/浅色主题切换
- 教师按科目分组显示
- 学生积分总分统计

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- JWT 认证
- Winston 日志

### 前端
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Vite

## 安装

### 前置要求
- Node.js 18+
- npm 或 yarn

### 安装依赖
```bash
npm run install:all
```

## 启动

### Windows
```powershell
.\start-optimized.ps1
```

### 手动启动
```bash
# 后端
cd backend
npm run dev

# 前端（新终端）
cd frontend
npm run dev
```

### 访问
- http://localhost:5173

## 项目结构

```
Workload/
├── backend/           # 后端服务
├── frontend/          # 前端应用
└── logs/              # 系统日志
```

## 安全特性

- 本地访问限制
- bcrypt 密码加密
- JWT Token 认证
- 速率限制防护
- 安全头部配置

## 许可证

GPL-3.0 License
