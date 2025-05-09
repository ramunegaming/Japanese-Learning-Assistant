@echo off
setlocal enabledelayedexpansion

echo Loading backup...
echo.

REM Check if backup folder exists
if not exist "backup" (
    echo Error: Backup folder not found!
    pause
    exit /b 1
)

REM Get the most recent backup folder
set "latest_backup="
for /f "tokens=*" %%i in ('dir /b /ad /o-d "backup\backup_*"') do (
    if not defined latest_backup set "latest_backup=%%i"
)

if not defined latest_backup (
    echo Error: No backup found in the backup folder!
    pause
    exit /b 1
)

echo Found latest backup: %latest_backup%
echo.

REM Confirm with user
set /p confirm="Are you sure you want to restore from this backup? This will overwrite current files. (Y/N): "
if /I not "%confirm%"=="Y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo Starting restore process...

REM Delete current files (except backup folder and batch files)
for /D %%i in (*) do (
    if /I not "%%i"=="backup" (
        if /I not "%%i"=="node_modules" (
            echo Removing directory: %%i
            rmdir /s /q "%%i"
        )
    )
)

for %%i in (*) do (
    if /I not "%%i"=="backup.bat" (
        if /I not "%%i"=="loadbackup.bat" (
            echo Removing file: %%i
            del /q "%%i"
        )
    )
)

REM Copy files from backup
echo.
echo Restoring files from backup...
xcopy /E /Y /I "backup\%latest_backup%\*" "."

echo.
echo Restore completed successfully!
echo Project has been restored to the state from: %latest_backup%
echo.
pause 