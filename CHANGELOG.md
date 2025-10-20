# 更新日志

本文件记录项目的所有重要更改。

## [1.0.0-beta1] - 2025-10-20

### 功能特性

#### 核心功能
- 完整的学生积分管理系统
- 学生、教师、积分管理模块
- 基于 JWT 的认证系统，支持自动登录 Cookie
- 数据导入/导出（CSV 格式，UTF-8 BOM 编码）
- 自动数据库备份功能
- 深色/浅色主题支持，系统偏好检测

#### UI/UX 增强
- 基于 Fluent UI v9 的现代化界面
- 响应式设计
- 高级数据过滤和搜索
- 教师按科目分组，显示汇总积分总计
- 学生积分总计显示，带颜色编码指示器
- 内联导入/导出对话框（无需页面跳转）
- 数据导出的日期范围筛选

#### 后端特性
- 使用 better-sqlite3 的 SQLite 数据库
- Winston 全面日志系统
- 英文日志防止编码问题
- 项目根目录的集中式日志目录
- 自动登录的安全 Cookie 加密
- Helmet 速率限制和安全头部
- 积分计算的 SQL 聚合

#### 开发体验
- 优化的启动脚本，实时日志监控
- 前后端均使用 TypeScript
- 工作区管理的 Monorepo 结构
- Vite 实现快速前端开发
- 热模块替换（HMR）支持

### 技术细节

#### 前端技术栈
- React 18
- TypeScript
- Fluent UI v9
- React Router v6
- Axios
- Vite

#### 后端技术栈
- Express
- TypeScript
- better-sqlite3
- Winston（日志）
- bcryptjs（密码哈希）
- jsonwebtoken（JWT 认证）
- crypto-js（Cookie 加密）

### 数据库架构
- Users：管理员账户管理
- Students：学生信息（姓名、学号、班级、总积分）
- Teachers：教师信息（姓名、科目、年级、电话、邮箱、总积分）
- Scores：积分记录，包含学生-教师关系

### 配置
- 日志文件：logs/application-YYYY-MM-DD-HHmmss.log
- 数据库：backend/data/database.sqlite
- 备份：backend/backups/
- 端口：后端（3000），前端（5173）

### 已知问题
- 系统可能需要在初始设置后手动重启
- 首次运行的管理员创建检测需要验证

### 安全性
- bcryptjs 密码哈希
- JWT 令牌认证
- 加密的自动登录 Cookie
- 敏感端点的速率限制
- Helmet 安全头部

---

## 未来计划
- 基于角色的访问控制（多用户角色）
- 增强的报告和分析
- 邮件通知
- 移动应用支持
- 多语言支持
- 高级积分计算规则
