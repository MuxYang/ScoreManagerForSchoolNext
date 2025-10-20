# Student Score Management System - Optimized Startup Script
# Only show frontend address and real-time backend logs

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Student Score System - Starting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "OK Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR Node.js not installed: https://nodejs.org/" -ForegroundColor Red
    pause
    exit 1
}

# Check and install dependencies
Write-Host ""
Write-Host "[2/5] Checking dependencies..." -ForegroundColor Yellow

$backendNodeModules = Join-Path $PSScriptRoot "backend\node_modules"
$frontendNodeModules = Join-Path $PSScriptRoot "frontend\node_modules"

if (-Not (Test-Path $backendNodeModules)) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $PSScriptRoot "backend")
    npm install --silent
    Set-Location $PSScriptRoot
}

if (-Not (Test-Path $frontendNodeModules)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $PSScriptRoot "frontend")
    npm install --silent
    Set-Location $PSScriptRoot
}

Write-Host "OK Dependencies ready" -ForegroundColor Green

# Create necessary directories
Write-Host ""
Write-Host "[3/5] Initializing directories..." -ForegroundColor Yellow
$backendData = Join-Path $PSScriptRoot "backend\data"
$backendBackups = Join-Path $PSScriptRoot "backend\backups"
$rootLogs = Join-Path $PSScriptRoot "logs"

@($backendData, $backendBackups, $rootLogs) | ForEach-Object {
    if (-Not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}
Write-Host "OK Directories initialized" -ForegroundColor Green

# Check first run (database file exists?)
$databasePath = Join-Path $PSScriptRoot "backend\data\database.sqlite"
$isFirstRun = -Not (Test-Path $databasePath)

# Start backend (silent mode)
Write-Host ""
Write-Host "[4/5] Starting backend service..." -ForegroundColor Yellow

$backendPath = Join-Path $PSScriptRoot "backend"
$stdoutLog = Join-Path $PSScriptRoot "logs\stdout.log"
$stderrLog = Join-Path $PSScriptRoot "logs\stderr.log"

# Clear old logs
"" | Out-File $stdoutLog -Encoding UTF8
"" | Out-File $stderrLog -Encoding UTF8

$backendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$backendPath'; npm run dev > '$stdoutLog' 2> '$stderrLog'" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 4

if (-Not $backendProcess.HasExited) {
    Write-Host "OK Backend service started (PID: $($backendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "ERROR Backend startup failed" -ForegroundColor Red
    Get-Content $stderrLog -ErrorAction SilentlyContinue
    exit 1
}

# Start frontend (silent mode)
Write-Host ""
Write-Host "[5/5] Starting frontend service..." -ForegroundColor Yellow

$frontendPath = Join-Path $PSScriptRoot "frontend"
$frontendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$frontendPath'; npm run dev 2>&1 | Out-Null" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

if (-Not $frontendProcess.HasExited) {
    Write-Host "OK Frontend service started (PID: $($frontendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "ERROR Frontend startup failed" -ForegroundColor Red
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Show access information
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   OK System started successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Web Access: " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:5173" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# First run notice
if ($isFirstRun) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "   NOTICE: First Run Detected" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "System will auto-create admin account" -ForegroundColor Yellow
    Write-Host "Please check backend logs below for account info!" -ForegroundColor Yellow
    Write-Host ""
    Start-Sleep -Seconds 1
}

# Show real-time backend logs
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Backend Real-time Logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "TIP: Press Ctrl+C to stop system" -ForegroundColor Yellow
Write-Host ""

# Track displayed line count
$lastLineCount = 0

try {
    while ($true) {
        # Check if processes are still running
        if ($backendProcess.HasExited) {
            Write-Host ""
            Write-Host "WARNING: Backend service stopped" -ForegroundColor Red
            break
        }
        if ($frontendProcess.HasExited) {
            Write-Host ""
            Write-Host "WARNING: Frontend service stopped" -ForegroundColor Red
            break
        }

        # Read backend logs (only show new lines)
        if (Test-Path $stdoutLog) {
            $logContent = Get-Content $stdoutLog -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($logContent) {
                $currentLineCount = $logContent.Count
                if ($currentLineCount -gt $lastLineCount) {
                    $newLines = $logContent[$lastLineCount..($currentLineCount - 1)]
                    foreach ($line in $newLines) {
                        # Filter out unnecessary information
                        if ($line -like "*Session ID*" -or $line -like "*sessionId*" -or $line -like "*http://127.0.0.1*") {
                            # Skip these lines
                            continue
                        }
                        
                        # Highlight important information
                        if ($line -match "admin|password|Account") {
                            Write-Host $line -ForegroundColor Yellow -BackgroundColor DarkRed
                        } elseif ($line -match "error|Error|failed|Failed") {
                            Write-Host $line -ForegroundColor Red
                        } elseif ($line -match "success|Success|completed|Completed") {
                            Write-Host $line -ForegroundColor Green
                        } elseif ($line -match "warning|Warning") {
                            Write-Host $line -ForegroundColor Yellow
                        } else {
                            Write-Host $line
                        }
                    }
                    $lastLineCount = $currentLineCount
                }
            }
        }

        # Read error logs
        if (Test-Path $stderrLog) {
            $errorContent = Get-Content $stderrLog -Tail 5 -ErrorAction SilentlyContinue
            if ($errorContent) {
                foreach ($line in $errorContent) {
                    if ($line.Trim() -ne "") {
                        Write-Host $line -ForegroundColor Red
                    }
                }
            }
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    # Cleanup processes
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    
    # Wait for processes to fully exit
    Start-Sleep -Seconds 1
    
    Write-Host "OK All services stopped" -ForegroundColor Green
    Write-Host ""
}
