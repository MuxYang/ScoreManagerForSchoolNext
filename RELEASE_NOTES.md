# 学生积分管理系统 v1.0.0-beta1 发布说明

## 概述

学生积分管理系统首个测试版本，为学校提供学生积分管理的网页应用程序。

## 主要功能

### 完整的管理系统
- 学生管理：跟踪学生学号、姓名、班级和总积分
- 教师管理：按科目组织教师，显示汇总积分总计
- 积分管理：记录和管理积分条目，保留完整历史
- 科目分组：教师自动按科目分组，显示总积分

### 现代化用户界面
- 基于 Microsoft Fluent UI v9 构建，外观现代一致
- 深色/浅色主题支持，自动检测系统偏好
- 响应式设计，支持桌面和移动设备
- 实时数据更新和内联编辑

### 安全与认证
- 基于 JWT 的认证系统
- 使用加密 Cookie 的安全自动登录
- bcryptjs 密码哈希
- 速率限制和安全头部

### 导入/导出
- CSV 导入/导出，使用 UTF-8 BOM 编码（Excel 兼容）
- 内联对话框实现快速导入/导出，无需页面跳转
- 导出支持日期范围筛选（精确到天）
- 模板下载方便数据录入

### 数据管理
- SQLite 数据库，可靠的数据存储
- 自动备份功能
- 积分汇总和总计计算
- 外键约束保证数据完整性

### 日志系统
- Winston 实现的全面日志记录
- 日期时间戳命名的日志文件（logs/application-YYYY-MM-DD-HHmmss.log）
- 项目根目录的集中式日志目录
- 英文日志防止编码问题

## 快速开始

### 前置要求
- Node.js v16 或更高版本
- npm 或 yarn

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/score-manager.git
cd score-manager
```

2. 安装依赖：
```bash
npm run install:all
```

3. 启动系统（Windows）：
```powershell
.\start-optimized.ps1
```

或手动启动：
```bash
# 终端 1 - 后端
cd backend
npm run dev

# 终端 2 - 前端
cd frontend
npm run dev
```

4. 访问应用程序：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000

### 默认管理员账户
首次运行时，系统将创建默认管理员账户。查看控制台输出获取凭据。

## 技术栈

**前端：**
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Axios
- Vite

**后端：**
- Express + TypeScript
- better-sqlite3
- Winston（日志）
- JWT 认证
- bcryptjs

## Beta1 版本新增功能

### 新增
- 学生、教师、积分的完整 CRUD 操作
- 基于科目的教师分组及汇总总分
- 学生总积分显示，带颜色编码
- 内联导入/导出对话框
- 主题切换器，支持系统偏好
- 基于加密 Cookie 的自动登录
- 带日期时间文件名的集中式日志
- 优化的启动脚本，实时日志监控

### 更改
- 日志目录移至项目根目录（logs/）
- 所有后端日志转换为英文
- 日志文件名现在包含完整时间戳（YYYY-MM-DD-HHmmss）
- 教师字段从"classes"改为"grade"

### 修复
- CSV 编码问题（现使用 UTF-8 BOM）
- 后端启动时输出前端 URL
- 颜色编码的积分显示（正分为绿色，负分为红色）

## 已知问题

1. 系统可能需要在初始数据库设置后手动重启
2. 首次运行的管理员检测在某些情况下可能需要验证
3. 后台进程可能在某些系统上意外停止

这些问题将在下一个版本中解决。

## 贡献

欢迎贡献代码，请提交 Pull Request。

## 许可证

本项目采用 MIT 许可证。

## 致谢

- 使用 Microsoft Fluent UI 构建
- 由 Express 和 React 驱动
- SQLite 数据库

## 支持

如有问题、疑问或建议，请在 GitHub 上开启 issue。
