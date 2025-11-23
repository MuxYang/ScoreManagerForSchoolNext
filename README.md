# 综合量化管理系统

基于 Web 的学生综合量化管理系统，使用 TypeScript、React、Express 和 SQLite 构建。

## 功能特性

### 核心功能
- 学生信息管理（学号、姓名、班级、宿舍、总分等）
- 教师信息管理（工号、姓名、科目、状态等）
- 积分记录管理（扣分记录、加分记录、待审核记录）
- 讲座记录管理（讲座出勤统计）
- 加班记录管理（教师加班统计）

### 数据管理
- 数据导入导出（CSV 格式、Excel 格式）
- 数据库备份恢复
- 批量操作支持

### 系统功能
- 深色/浅色主题切换
- 响应式设计（支持桌面端和移动端）
- 教师按科目分组显示
- 学生积分总分统计与排名
- AI 配置检测（DeepSeek、通义千问、智谱 AI）
- 实时服务器状态监控
- 自动重连机制

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- JWT 认证
- Winston 日志
- bcrypt 密码加密
- 速率限制（express-rate-limit）

### 前端
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Vite
- Axios
- ExcelJS

## 安装

### 前置要求
- Node.js 18+
- npm 或 yarn

### 安装依赖
```bash
npm run install:all
```

## 启动

### Windows 一键启动（推荐）
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

### 生产环境构建
```bash
# 构建后端和前端
npm run build

# 启动生产环境
npm start
```

### 访问
- 开发环境：http://localhost:5173
- 生产环境：http://localhost:3000

## 项目结构

```
ScoreManagerForSchoolNext/
├── backend/              # 后端服务
│   ├── src/             # 源代码
│   ├── data/            # SQLite 数据库
│   ├── backups/         # 数据库备份
│   └── logs/            # 后端日志
├── frontend/            # 前端应用
│   ├── src/            
│   │   ├── pages/      # 页面组件
│   │   ├── components/ # 可复用组件
│   │   ├── contexts/   # React Context
│   │   ├── services/   # API 服务
│   │   └── utils/      # 工具函数
│   └── dist/           # 构建输出
├── logs/                # 系统日志
└── start-*.ps1          # 启动脚本
```

## 主要页面

### 学生管理
- 学生列表：查看、搜索、筛选学生信息
- 添加/编辑学生：管理学生基本信息
- 批量导入：支持 CSV/Excel 格式导入

### 教师管理
- 教师列表：按科目分组显示
- 添加/编辑教师：管理教师信息
- 状态管理：启用/停用教师账号

### 积分记录
- 扣分记录：记录学生违纪扣分
- 加分记录：记录学生加分奖励
- 待审核记录：需要审核的积分变动
- 记录查询：按学生、时间、类型筛选

### 其他功能
- 讲座记录：管理学生讲座出勤
- 加班记录：统计教师加班情况
- 数据导入导出：批量数据处理
- 数据库备份：定期备份恢复
- 系统设置：个人信息、密码修改

## 安全特性

- 本地访问限制（仅 localhost）
- bcrypt 密码加密存储
- JWT Token 身份认证
- 速率限制防护（防暴力破解）
- 安全 HTTP 头部配置
- XSS 防护
- CSRF 防护
- SQL 注入防护

## 默认账号

首次安装会创建默认管理员账号：
- 用户名：admin
- 密码：admin123
- **请在首次登录后立即修改密码！**

## 开发说明

### 后端开发
```bash
cd backend
npm run dev     # 开发模式（热重载）
npm run build   # 构建
npm start       # 生产模式
```

### 前端开发
```bash
cd frontend
npm run dev     # 开发模式（热重载）
npm run build   # 构建
npm run preview # 预览构建结果
```

## 常见问题

### 端口冲突
- 后端默认端口：3000
- 前端开发端口：5173
- 可在 backend/.env 和 frontend/vite.config.ts 中修改

### 数据库位置
- 开发环境：backend/data/scores.db
- 备份位置：backend/backups/

### 日志位置
- 后端日志：backend/logs/
- 系统日志：logs/

## 更新日志

### v2.0.1 (2025-11-23)
- 优化 UI 界面一致性
- 修复 Toast 通知横向滚动条问题
- 改进按钮加载状态反馈
- 优化暗色/亮色主题适配
- 增强移动端响应式设计

### v2.0.0
- 重构为 TypeScript 架构
- 升级到 Fluent UI v9
- 新增讲座和加班记录管理
- 改进数据导入导出功能
- 优化用户体验

## 许可证

GPL-3.0 License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。
