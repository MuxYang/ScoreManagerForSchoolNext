# Score Manager v1.0.0-beta1 Release Notes

## Overview

First beta release of the Student Score Management System - a web application for schools to manage student points and scores.

## Key Features

### Complete Management System
- Student Management: Track students with ID, name, class, and total points
- Teacher Management: Organize teachers by subject with aggregated score totals
- Score Management: Record and manage score entries with full history
- Subject Grouping: Teachers are automatically grouped by subject with total points displayed

### Modern User Interface
- Built with Microsoft Fluent UI v9 for a modern, consistent look
- Dark/Light theme support with automatic system preference detection
- Responsive design that works on desktop and mobile devices
- Real-time data updates and inline editing

### Security & Authentication
- JWT-based authentication system
- Secure auto-login with encrypted cookies
- Password hashing with bcryptjs
- Rate limiting and security headers

### Import/Export
- CSV import/export with UTF-8 BOM encoding (Excel-compatible)
- Inline dialogs for quick import/export without page navigation
- Date range filtering for exports (precise to day)
- Template download for easy data entry

### Data Management
- SQLite database for reliable data storage
- Automatic backup functionality
- Score aggregation and totals calculation
- Data integrity with foreign key constraints

### Logging System
- Comprehensive logging with Winston
- Date-time stamped log files (logs/application-YYYY-MM-DD-HHmmss.log)
- Centralized log directory at project root
- English logs to prevent encoding issues

## Quick Start

### Prerequisites
- Node.js v16 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/score-manager.git
cd score-manager
```

2. Install dependencies:
```bash
npm run install:all
```

3. Start the system (Windows):
```powershell
.\start-optimized.ps1
```

Or start manually:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

4. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Default Admin Account
On first run, the system will create a default admin account. Check the console output for credentials.

## Technology Stack

**Frontend:**
- React 18 + TypeScript
- Fluent UI v9
- React Router v6
- Axios
- Vite

**Backend:**
- Express + TypeScript
- better-sqlite3
- Winston (logging)
- JWT authentication
- bcryptjs

## What's New in Beta1

### Added
- Complete CRUD operations for students, teachers, and scores
- Subject-based teacher grouping with aggregate totals
- Student total points display with color coding
- Inline import/export dialogs
- Theme switcher with system preference
- Encrypted cookie-based auto-login
- Centralized logging with date-time filenames
- Optimized startup script with real-time monitoring

### Changed
- Log directory moved to project root (logs/)
- All backend logs converted to English
- Log filenames now include full timestamp (YYYY-MM-DD-HHmmss)
- Teacher field changed from "classes" to "grade"

### Fixed
- CSV encoding issues (now UTF-8 BOM)
- Frontend URL output on backend startup
- Color-coded score display (green for positive, red for negative)

## Known Issues

1. System may require manual restart after initial database setup
2. First-run admin detection may need verification in some cases
3. Background process may stop unexpectedly on some systems

These issues will be addressed in the next release.

## Contributing

Contributions are welcome. Please submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with Microsoft Fluent UI
- Powered by Express and React
- Database by SQLite

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
