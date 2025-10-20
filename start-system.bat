@echo off
chcp 65001 >nul
title Student Score Management System - Startup

echo ========================================
echo    Student Score System - Starting
echo ========================================
echo.

REM Check PowerShell execution policy
echo [Check] Checking PowerShell execution policy...
powershell -Command "Get-ExecutionPolicy" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot check PowerShell execution policy
    pause
    exit /b 1
)

REM Get current execution policy
for /f "delims=" %%i in ('powershell -Command "Get-ExecutionPolicy"') do set POLICY=%%i

REM Check if execution policy allows script execution
if /i "%POLICY%"=="Restricted" (
    echo [WARNING] PowerShell execution policy is Restricted
    echo.
    echo Trying to run with Bypass policy...
    echo If it fails, please run as Administrator:
    echo Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0start-optimized.ps1"
) else if /i "%POLICY%"=="AllSigned" (
    echo [WARNING] PowerShell execution policy is AllSigned
    echo.
    echo Trying to run with Bypass policy...
    powershell -ExecutionPolicy Bypass -File "%~dp0start-optimized.ps1"
) else (
    echo [OK] Execution policy: %POLICY%
    echo.
    powershell -ExecutionPolicy Bypass -File "%~dp0start-optimized.ps1"
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo   Startup Failed
    echo ========================================
    echo.
    echo If you encounter permission issues, run as Administrator:
    echo Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo.
    echo Or right-click this script and select "Run as Administrator"
    echo.
)

pause
