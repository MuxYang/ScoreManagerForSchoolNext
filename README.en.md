# Student Score Management System

A web-based student score management system built with TypeScript, React, Express, and SQLite.

## Features

- Student information management
- Teacher information management
- Score record management
- Data import/export (CSV format)
- Database backup and restore
- Dark/Light theme switching
- Teacher grouping by subject
- Student total score statistics

## Technology Stack

### Backend
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- JWT authentication
- Winston logging

### Frontend
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Vite

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Install dependencies
```bash
npm run install:all
```

## Start

### Windows
```powershell
.\start-optimized.ps1
```

### Manual start
```bash
# Backend
cd backend
npm run dev

# Frontend (new terminal)
cd frontend
npm run dev
```

### Access
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Project Structure

```
Workload/
├── backend/           # Backend service
├── frontend/          # Frontend app
└── logs/              # System logs
```

## Security Features

- Local access only
- bcrypt password encryption
- JWT token authentication
- Rate limiting protection
- Security headers

## License

MIT License
