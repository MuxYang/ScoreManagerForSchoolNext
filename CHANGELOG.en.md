# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-beta1] - 2025-10-20

### Features

#### Core Functionality
- Complete student score management system
- Student, teacher, and score management modules
- JWT-based authentication system with auto-login cookie support
- Data import/export (CSV format with UTF-8 BOM encoding)
- Automatic database backup functionality
- Dark/Light theme support with system preference detection

#### UI/UX Enhancements
- Modern UI built with Fluent UI v9
- Responsive design
- Advanced data filtering and search
- Teacher grouping by subject with aggregate score totals
- Student score totals display with color-coded indicators
- Inline import/export dialogs (no page navigation required)
- Date range filtering for data export

#### Backend Features
- SQLite database with better-sqlite3
- Comprehensive logging system with Winston
- English logs to prevent encoding issues
- Centralized log directory at project root
- Secure cookie encryption for auto-login
- Rate limiting and security headers with Helmet
- SQL aggregation for score calculations

#### Developer Experience
- Optimized startup script with real-time log monitoring
- TypeScript for both frontend and backend
- Monorepo structure with workspace management
- Vite for fast frontend development
- Hot module replacement (HMR) support

### Technical Details

#### Frontend Stack
- React 18
- TypeScript
- Fluent UI v9
- React Router v6
- Axios
- Vite

#### Backend Stack
- Express
- TypeScript
- better-sqlite3
- Winston (logging)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- crypto-js (cookie encryption)

### Database Schema
- Users: Admin account management
- Students: Student information (name, student ID, class, total points)
- Teachers: Teacher information (name, subject, grade, phone, email, total points)
- Scores: Score records with student-teacher relationships

### Configuration
- Log files: logs/application-YYYY-MM-DD-HHmmss.log
- Database: backend/data/database.sqlite
- Backups: backend/backups/
- Ports: Backend (3000), Frontend (5173)

### Known Issues
- System may require manual restart after initial setup
- First-run admin creation detection needs verification

### Security
- Password hashing with bcryptjs
- JWT token authentication
- Encrypted auto-login cookies
- Rate limiting on sensitive endpoints
- Helmet security headers

---

## Future Plans
- Role-based access control (multiple user roles)
- Enhanced reporting and analytics
- Email notifications
- Mobile app support
- Multi-language support
- Advanced score calculation rules
