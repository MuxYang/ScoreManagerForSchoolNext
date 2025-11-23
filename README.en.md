# Comprehensive Quantitative Management System

A web-based student comprehensive quantitative management system built with TypeScript, React, Express, and SQLite.

## Features

### Core Functions
- Student information management (ID, name, class, dorm, total score, etc.)
- Teacher information management (staff ID, name, subject, status, etc.)
- Score record management (deduction records, bonus records, pending records)
- Lecture record management (lecture attendance statistics)
- Overtime record management (teacher overtime statistics)

### Data Management
- Data import/export (CSV format, Excel format)
- Database backup and restore
- Batch operation support

### System Features
- Dark/Light theme switching
- Responsive design (desktop and mobile support)
- Teacher grouping by subject
- Student total score statistics and ranking
- AI configuration detection (DeepSeek, Tongyi Qianwen, Zhipu AI)
- Real-time server status monitoring
- Auto-reconnection mechanism

## Technology Stack

### Backend
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- JWT authentication
- Winston logging
- bcrypt password encryption
- Rate limiting (express-rate-limit)

### Frontend
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Vite
- Axios
- ExcelJS

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Install dependencies
```bash
npm run install:all
```

## Start

### Windows One-Click Start (Recommended)
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

### Production Build
```bash
# Build backend and frontend
npm run build

# Start production
npm start
```

### Access
- Development: http://localhost:5173
- Production: http://localhost:3000

## Project Structure

```
ScoreManagerForSchoolNext/
├── backend/              # Backend service
│   ├── src/             # Source code
│   ├── data/            # SQLite database
│   ├── backups/         # Database backups
│   └── logs/            # Backend logs
├── frontend/            # Frontend app
│   ├── src/            
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   ├── contexts/   # React Context
│   │   ├── services/   # API services
│   │   └── utils/      # Utility functions
│   └── dist/           # Build output
├── logs/                # System logs
└── start-*.ps1          # Startup scripts
```

## Main Pages

### Student Management
- Student list: View, search, filter student information
- Add/Edit students: Manage student basic information
- Batch import: Support CSV/Excel format import

### Teacher Management
- Teacher list: Display grouped by subject
- Add/Edit teachers: Manage teacher information
- Status management: Enable/Disable teacher accounts

### Score Records
- Deduction records: Record student violation deductions
- Bonus records: Record student bonus rewards
- Pending records: Score changes requiring review
- Record query: Filter by student, time, type

### Other Features
- Lecture records: Manage student lecture attendance
- Overtime records: Statistics of teacher overtime
- Data import/export: Batch data processing
- Database backup: Regular backup and restore
- System settings: Personal info, password change

## Security Features

- Local access only (localhost only)
- bcrypt password encryption storage
- JWT token authentication
- Rate limiting protection (prevent brute force)
- Security HTTP header configuration
- XSS protection
- CSRF protection
- SQL injection protection

## Default Account

First installation creates default admin account:
- Username: admin
- Password: admin123
- **Please change password immediately after first login!**

## Development Guide

### Backend Development
```bash
cd backend
npm run dev     # Development mode (hot reload)
npm run build   # Build
npm start       # Production mode
```

### Frontend Development
```bash
cd frontend
npm run dev     # Development mode (hot reload)
npm run build   # Build
npm run preview # Preview build result
```

## FAQ

### Port Conflicts
- Backend default port: 3000
- Frontend dev port: 5173
- Can be modified in backend/.env and frontend/vite.config.ts

### Database Location
- Development: backend/data/scores.db
- Backup location: backend/backups/

### Log Location
- Backend logs: backend/logs/
- System logs: logs/

## Changelog

### v2.0.1 (2025-11-23)
- Optimized UI interface consistency
- Fixed Toast notification horizontal scrollbar issue
- Improved button loading state feedback
- Optimized dark/light theme adaptation
- Enhanced mobile responsive design

### v2.0.0
- Refactored to TypeScript architecture
- Upgraded to Fluent UI v9
- Added lecture and overtime record management
- Improved data import/export functionality
- Optimized user experience

## License

GPL-3.0 License

## Contributing

Issues and Pull Requests are welcome!

## Contact

For questions or suggestions, please contact via GitHub Issues.
