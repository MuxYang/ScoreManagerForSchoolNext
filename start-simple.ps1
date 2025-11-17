# 简化的启动脚本
Write-Host "启动学生积分管理系统..." -ForegroundColor Green

# 停止现有进程
Write-Host "停止现有服务..." -ForegroundColor Yellow

# 停止端口 3000 (后端)
$conn3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn3000) { 
    Stop-Process -Id $conn3000.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "已停止端口 3000 的进程" -ForegroundColor Green
} else { 
    Write-Host "端口 3000 没有运行的进程" -ForegroundColor Gray
}

# 停止端口 4173 (前端预览)
$conn4173 = Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue
if ($conn4173) { 
    Stop-Process -Id $conn4173.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "已停止端口 4173 的进程" -ForegroundColor Green
} else { 
    Write-Host "端口 4173 没有运行的进程" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# 启动后端
Write-Host "启动后端服务..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$backendPath'; npm start" -WindowStyle Minimized

# 等待后端启动
Start-Sleep -Seconds 5

# 启动前端
Write-Host "启动前端服务..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "frontend"
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "cd '$frontendPath'; npm run preview" -WindowStyle Minimized

# 等待前端启动
Start-Sleep -Seconds 5

Write-Host "系统启动完成！" -ForegroundColor Green
Write-Host "前端地址: http://localhost:4173" -ForegroundColor Cyan
Write-Host "后端地址: http://localhost:3000" -ForegroundColor Cyan

# 打开浏览器
Start-Process "http://localhost:4173"

