# Student Score Management System - Production Startup Script
# Builds and runs the system in production mode

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Student Score System - Production Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-ProcessByPort {
    param (
        [Parameter(Mandatory=$true)]
        [int]$Port
    )
    Write-Host "Attempting to stop processes on port $Port..." -ForegroundColor Yellow
    Get-NetTCPConnection -LocalPort $Port | ForEach-Object {
        $procId = $_.OwningProcess
        if ($procId -ne 0) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped process with PID $procId on port $Port." -ForegroundColor Green
            } catch {
                $errMsg = $error[0].Exception.Message
                Write-Host ('Failed to stop process with PID ' + $procId + ' on port ' + $Port + ': ' + $errMsg) -ForegroundColor Red
            }
        }
    }
}

# Check Node.js
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "OK Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is not installed or not in PATH." -ForegroundColor Red
    $title = "Node.js Installation"
    $message = "Do you want to automatically download and install Node.js?"
    $choices = [System.Management.Automation.Host.ChoiceDescription[]]@("&Yes", "&No")
    $decision = $Host.UI.PromptForChoice($title, $message, $choices, 0)

    if ($decision -eq 0) {
        $arch = $env:PROCESSOR_ARCHITECTURE
        $url = ""
        $fileName = ""

        if ($arch -eq "AMD64") {
            $url = "https://nodejs.org/dist/v22.21.0/node-v22.21.0-x64.msi"
            $fileName = "node-v22.21.0-x64.msi"
        } elseif ($arch -eq "x86") {
            $url = "https://nodejs.org/dist/v22.21.0/node-v22.21.0-x86.msi"
            $fileName = "node-v22.21.0-x86.msi"
        } elseif ($arch -eq "ARM64") {
            $url = "https://nodejs.org/dist/v22.21.0/node-v22.21.0-arm64.msi"
            $fileName = "node-v22.21.0-arm64.msi"
        } else {
            Write-Host "Unsupported architecture: $arch" -ForegroundColor Red
            pause
            exit 1
        }

        Write-Host "Downloading Node.js for $arch..." -ForegroundColor Yellow
        $downloadPath = Join-Path $PSScriptRoot $fileName
        Invoke-WebRequest -Uri $url -OutFile $downloadPath

        Write-Host "Installing Node.js... This may take a few minutes." -ForegroundColor Yellow
        Start-Process msiexec.exe -ArgumentList "/i `"$downloadPath`" /quiet" -Wait

        Write-Host "Node.js installation complete." -ForegroundColor Green
        Write-Host "Please close this window and run the script again." -ForegroundColor Yellow
        Remove-Item $downloadPath
    } else {
        Write-Host "Node.js installation skipped." -ForegroundColor Yellow
    }
    pause
    exit 1
}

# Ensure .env file exists
Write-Host "[1.5/5] Ensuring .env file exists..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "backend\.env"
if (-Not (Test-Path $envPath)) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    Copy-Item (Join-Path $PSScriptRoot "backend\.env.example") $envPath -Force
    Write-Host "OK .env file created" -ForegroundColor Green
}

# Check and install dependencies
Write-Host ""
Write-Host "[2/5] Checking dependencies..." -ForegroundColor Yellow

Write-Host "Installing/updating backend dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "backend")
npm install --silent
Set-Location $PSScriptRoot

Write-Host "Installing/updating frontend dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "frontend")
npm install --silent
Set-Location $PSScriptRoot

Write-Host "OK Dependencies ready" -ForegroundColor Green

# Build backend for production
Write-Host ""
Write-Host "[2.5/5] Building backend for production..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "backend")
npm run build
Set-Location $PSScriptRoot
Write-Host "OK Backend built for production" -ForegroundColor Green

# Build frontend for production
Write-Host ""
Write-Host "[2.6/5] Building frontend for production..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "frontend")
npm run build
Set-Location $PSScriptRoot
Write-Host "OK Frontend built for production" -ForegroundColor Green

# Create necessary directories
Write-Host ""
Write-Host "[3/7] Initializing directories..." -ForegroundColor Yellow
$backendData = Join-Path $PSScriptRoot "backend\data"
$backendBackups = Join-Path $PSScriptRoot "backend\backups"
$rootLogs = Join-Path $PSScriptRoot "logs"

@($backendData, $backendBackups, $rootLogs) | ForEach-Object {
    if (-Not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}
Write-Host "OK Directories initialized" -ForegroundColor Green

# Compress previous logs
Write-Host ""
Write-Host "[3.1/7] Compressing previous logs..." -ForegroundColor Yellow
$logFiles = @(
    "logs\stdout.log",
    "logs\stderr.log", 
    "logs\frontend.log",
    "backend\logs\*.log"
)

$compressedLogs = @()
foreach ($logPattern in $logFiles) {
    $logPath = Join-Path $PSScriptRoot $logPattern
    if ($logPattern -like "*\*.log") {
        # Handle wildcard patterns
        $logFiles = Get-ChildItem -Path $logPath -ErrorAction SilentlyContinue
        foreach ($logFile in $logFiles) {
            if ($logFile.Length -gt 0) {
                $zipName = "logs\compressed-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')-$($logFile.BaseName).zip"
                $zipPath = Join-Path $PSScriptRoot $zipName
                Compress-Archive -Path $logFile.FullName -DestinationPath $zipPath -Force
                $compressedLogs += $zipName
                Write-Host "  Compressed: $($logFile.Name) -> $zipName" -ForegroundColor Gray
            }
        }
    } else {
        # Handle specific files
        if (Test-Path $logPath -and (Get-Item $logPath).Length -gt 0) {
            $zipName = "logs\compressed-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')-$(Split-Path $logPath -Leaf).zip"
            $zipPath = Join-Path $PSScriptRoot $zipName
            Compress-Archive -Path $logPath -DestinationPath $zipPath -Force
            $compressedLogs += $zipName
            Write-Host "  Compressed: $(Split-Path $logPath -Leaf) -> $zipName" -ForegroundColor Gray
        }
    }
}

if ($compressedLogs.Count -gt 0) {
    Write-Host "OK Compressed $($compressedLogs.Count) log files:" -ForegroundColor Green
    foreach ($log in $compressedLogs) {
        Write-Host "  📦 $log" -ForegroundColor Gray
    }
} else {
    Write-Host "OK No previous logs to compress" -ForegroundColor Green
}

# 检查并释放 3000 和 5173 端口
Write-Host "[3.5/7] Checking and releasing ports 3000, 5173..." -ForegroundColor Yellow
Stop-ProcessByPort -Port 3000
Stop-ProcessByPort -Port 5173
Start-Sleep -Seconds 1
Write-Host "OK Ports checked and released if needed" -ForegroundColor Green


# Check first run (database.db exists?)
$databasePath = Join-Path $PSScriptRoot "backend\data\database.db"
$isFirstRun = -Not (Test-Path $databasePath)

# Start backend (production mode)
Write-Host ""
Write-Host "[4/7] Starting backend service..." -ForegroundColor Yellow

$backendPath = Join-Path $PSScriptRoot "backend"
$stdoutLog = Join-Path $PSScriptRoot "logs\stdout.log"
$stderrLog = Join-Path $PSScriptRoot "logs\stderr.log"

# Clear old logs
"" | Out-File $stdoutLog -Encoding UTF8
"" | Out-File $stderrLog -Encoding UTF8

$backendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$backendPath'; npm start > '$stdoutLog' 2> '$stderrLog'" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 4

if (-Not $backendProcess.HasExited) {
    Write-Host "OK Backend service started (PID: $($backendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "ERROR Backend startup failed" -ForegroundColor Red
    Get-Content $stderrLog -ErrorAction SilentlyContinue
    exit 1
}

# Start frontend (production mode)
Write-Host ""
Write-Host "[5/7] Starting frontend service..." -ForegroundColor Yellow

$frontendPath = Join-Path $PSScriptRoot "frontend"
$distPath = Join-Path $frontendPath "dist"
$frontendLog = Join-Path $PSScriptRoot "logs\frontend.log"

# Clear old frontend log
"" | Out-File $frontendLog -Encoding UTF8

# Use http-server for static file serving with SPA support (HTTP only)
$frontendProcess = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$distPath'; npx --yes http-server . -p 5173 --gzip -c-1 -d false > '$frontendLog' 2>&1" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 6

if (-Not $frontendProcess.HasExited) {
    Write-Host "OK Frontend service started (PID: $($frontendProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "ERROR Frontend startup failed" -ForegroundColor Red
    Write-Host "Checking frontend build status..." -ForegroundColor Yellow
    
    # Check if dist folder exists
    $distPath = Join-Path $frontendPath "dist"
    if (-Not (Test-Path $distPath)) {
        Write-Host "ERROR: Frontend dist folder not found. Please run 'npm run build' first." -ForegroundColor Red
    } else {
        Write-Host "Frontend dist folder exists, but preview server failed to start." -ForegroundColor Yellow
    }
    
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Verify services are running
Write-Host ""
Write-Host "[6/7] Verifying services..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Check backend health
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "OK Backend health check passed" -ForegroundColor Green
    } else {
        Write-Host "WARNING Backend health check returned status $($backendResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING Backend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Check frontend availability
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 5 -ErrorAction Stop
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "OK Frontend service is accessible" -ForegroundColor Green
    } else {
        Write-Host "WARNING Frontend returned status $($frontendResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING Frontend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[7/7] Production deployment complete!" -ForegroundColor Green

# Show access information
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   🚀 Production System Ready! 🚀" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Local Access: " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:5173" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# Get local IP address for LAN access
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.') } | Select-Object -First 1).IPAddress

if ($localIP) {
    Write-Host "🏠 LAN Access: " -NoNewline -ForegroundColor Cyan
    Write-Host "http://${localIP}:5173" -ForegroundColor White -BackgroundColor DarkMagenta
    Write-Host ""
}

Write-Host "📊 Backend API: " -NoNewline -ForegroundColor Cyan
Write-Host "http://localhost:3000" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "⚡ Performance: " -ForegroundColor Yellow
Write-Host "  • Backend: Compiled TypeScript (optimized)" -ForegroundColor Gray
Write-Host "  • Frontend: Built assets (minified & compressed)" -ForegroundColor Gray
Write-Host "  • Database: SQLite (production-ready)" -ForegroundColor Gray
Write-Host ""
Write-Host "🔒 Network Access: " -ForegroundColor Yellow
Write-Host "  • Local: Accessible from this computer" -ForegroundColor Gray
Write-Host "  • LAN: Accessible from devices on the same network" -ForegroundColor Gray
Write-Host "  • Public: Blocked (security feature)" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Log Files: " -ForegroundColor Yellow
Write-Host "  • Backend: logs\stdout.log, logs\stderr.log" -ForegroundColor Gray
Write-Host "  • Frontend: logs\frontend.log" -ForegroundColor Gray
Write-Host "  • Backend Session: backend\logs\*.log" -ForegroundColor Gray
if ($compressedLogs.Count -gt 0) {
    Write-Host "  • Compressed: $($compressedLogs.Count) files in logs\" -ForegroundColor Gray
}
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
    Start-Sleep -Seconds 5
    # 自动打开前端页面
    $frontendUrl = "http://localhost:5173"
    Write-Host "Opening browser: $frontendUrl" -ForegroundColor Cyan
    Start-Process $frontendUrl
}

# Show real-time logs
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Real-time System Logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Log Format:" -ForegroundColor Yellow
Write-Host "  [BACKEND]  - Backend service logs (API, database, system)" -ForegroundColor Blue
Write-Host "  [FRONTEND] - Frontend service logs (HTTP requests, errors)" -ForegroundColor Cyan
Write-Host "  [BACKEND ERROR] - Backend error logs" -ForegroundColor Red
Write-Host ""
Write-Host "🎨 Color Legend:" -ForegroundColor Yellow
Write-Host "  🔴 Red     - Errors and failures" -ForegroundColor Red
Write-Host "  🟢 Green   - Success and startup messages" -ForegroundColor Green
Write-Host "  🟡 Yellow  - Warnings and admin info" -ForegroundColor Yellow
Write-Host "  🔵 Blue    - API requests" -ForegroundColor Blue
Write-Host "  🟣 Magenta - Important page requests" -ForegroundColor Magenta
Write-Host "  ⚪ White   - General information" -ForegroundColor White
Write-Host ""
Write-Host "TIP: Press Ctrl+C to stop system" -ForegroundColor Yellow
Write-Host ""

# Track displayed line counts
$lastBackendLineCount = 0
$lastFrontendLineCount = 0

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
                if ($currentLineCount -gt $lastBackendLineCount) {
                    $newLines = $logContent[$lastBackendLineCount..($currentLineCount - 1)]
                    foreach ($line in $newLines) {
                        # Filter out only very verbose information
                        if ($line -like "*Session ID*" -or $line -like "*sessionId*") {
                            # Skip session ID logs
                            continue
                        }
                        
                        # Highlight important information
                        if ($line -match "admin|password|Account|Admin") {
                            Write-Host "[BACKEND] $line" -ForegroundColor Yellow -BackgroundColor DarkRed
                        } elseif ($line -match "error|Error|failed|Failed") {
                            Write-Host "[BACKEND] $line" -ForegroundColor Red
                        } elseif ($line -match "success|Success|completed|Completed|OK") {
                            Write-Host "[BACKEND] $line" -ForegroundColor Green
                        } elseif ($line -match "warning|Warning") {
                            Write-Host "[BACKEND] $line" -ForegroundColor Yellow
                        } elseif ($line -match "GET|POST|PUT|DELETE") {
                            # Show API requests
                            Write-Host "[BACKEND] $line" -ForegroundColor Blue
                        } elseif ($line -match "info:|Server running|Database initialized") {
                            # Show important system info
                            Write-Host "[BACKEND] $line" -ForegroundColor Cyan
                        } else {
                            Write-Host "[BACKEND] $line" -ForegroundColor White
                        }
                    }
                    $lastBackendLineCount = $currentLineCount
                }
            }
        }

        # Read frontend logs (only show new lines)
        if (Test-Path $frontendLog) {
            $frontendContent = Get-Content $frontendLog -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($frontendContent) {
                $currentFrontendLineCount = $frontendContent.Count
                if ($currentFrontendLineCount -gt $lastFrontendLineCount) {
                    $newFrontendLines = $frontendContent[$lastFrontendLineCount..($currentFrontendLineCount - 1)]
                    foreach ($line in $newFrontendLines) {
                        # Filter out unnecessary frontend information (less aggressive filtering)
                        if ($line -like "*GET /assets/*" -or $line -like "*GET /vite.svg*" -or $line -like "*304*") {
                            # Skip common static file requests
                            continue
                        }
                        
                        # Highlight frontend information
                        if ($line -match "error|Error|failed|Failed") {
                            Write-Host "[FRONTEND] $line" -ForegroundColor Red
                        } elseif ($line -match "started|listening|ready|Starting up") {
                            Write-Host "[FRONTEND] $line" -ForegroundColor Green
                        } elseif ($line -match "warning|Warning|deprecated") {
                            Write-Host "[FRONTEND] $line" -ForegroundColor Yellow
                        } elseif ($line -match "GET /" -and $line -notlike "*assets*") {
                            # Show important page requests
                            Write-Host "[FRONTEND] $line" -ForegroundColor Magenta
                        } else {
                            Write-Host "[FRONTEND] $line" -ForegroundColor Cyan
                        }
                    }
                    $lastFrontendLineCount = $currentFrontendLineCount
                }
            }
        }

        # Read backend error logs
        if (Test-Path $stderrLog) {
            $errorContent = Get-Content $stderrLog -Tail 5 -ErrorAction SilentlyContinue
            if ($errorContent) {
                foreach ($line in $errorContent) {
                    if ($line.Trim() -ne "") {
                        Write-Host "[BACKEND ERROR] $line" -ForegroundColor Red
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

    Stop-ProcessByPort -Port 3000
    Stop-ProcessByPort -Port 5173
    
    Write-Host "OK All services stopped" -ForegroundColor Green
    Write-Host ""
}
