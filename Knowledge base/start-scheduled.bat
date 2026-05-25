@echo off
:: KnowledgeBase Daily Scheduled Import
:: Triggered by Windows Task Scheduler at 6:00 AM daily.
::
:: To register this task, run as Administrator:
::   powershell -ExecutionPolicy Bypass -File "register-scheduled-task.ps1"

cd /d "C:\My stuff\My Vibe Coding Projects\Knowledge base"

echo [%date% %time%] Starting KnowledgeBase scheduled import...

:: Use the full Node.js path to avoid PATH issues in scheduled tasks
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: node.exe not found in PATH. Ensure Node.js is installed.
    exit /b 1
)

node scripts/scheduled-daily.js

echo [%date% %time%] Scheduled import completed.
