@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

cd /d "%SCRIPT_DIR%..\next"
if errorlevel 1 (
    echo Failed to change directory to next
    exit /b 1
)

echo Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo Failed to install dependencies
    exit /b 1
)

echo Building project...
call pnpm build
if errorlevel 1 (
    echo Failed to build project
    exit /b 1
)

echo Copying static assets...
xcopy /E /I /Y "%SCRIPT_DIR%..\next\.next\static" "%SCRIPT_DIR%..\next\.next\standalone\.next\static"
xcopy /E /I /Y "%SCRIPT_DIR%..\next\public" "%SCRIPT_DIR%..\next\.next\standalone\public"

echo Copying standalone files into tauri...
if exist "%SCRIPT_DIR%..\tauri\standalone" rmdir /S /Q "%SCRIPT_DIR%..\tauri\standalone"
move "%SCRIPT_DIR%..\next\.next\standalone" "%SCRIPT_DIR%..\tauri\standalone" >nul

rem 处理该死的 styled-jsx
if exist "%SCRIPT_DIR%..\tauri\standalone\node_modules\styled-jsx" rmdir /S /Q "%SCRIPT_DIR%..\tauri\standalone\node_modules\styled-jsx"
xcopy /E /I /Y "%SCRIPT_DIR%..\tauri\standalone\node_modules\.pnpm\styled-jsx@5.1.6_react@19.2.3\node_modules\styled-jsx" "%SCRIPT_DIR%..\tauri\standalone\node_modules\styled-jsx"

cd /d "%SCRIPT_DIR%..\tauri"

echo Installing tauri dependencies...
call pnpm install
if errorlevel 1 (
    echo Failed to install tauri dependencies
    exit /b 1
)

echo Building tauri...
call pnpm tauri build
if errorlevel 1 (
    echo Failed to build tauri
    exit /b 1
)

echo Returning to original directory...
cd /d "%SCRIPT_DIR%.."

echo Build completed successfully!