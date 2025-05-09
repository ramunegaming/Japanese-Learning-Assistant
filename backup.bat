@echo off
setlocal enabledelayedexpansion

echo Starting backup of current project version...
echo Current time: %date% %time%

REM Create backup folder if it doesn't exist
if not exist "backup" mkdir backup

REM Create timestamped backup folder
set "timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "timestamp=%timestamp: =0%"
mkdir "backup\backup_%timestamp%"

REM Copy all files and directories EXCEPT the backup folder and node_modules
for /D %%i in (*) do (
    if /I not "%%i"=="backup" (
        if /I not "%%i"=="node_modules" (
            echo Copying directory: %%i
            xcopy /E /Y /I "%%i" "backup\backup_%timestamp%\%%i"
        )
    )
)

REM Copy all files in the root directory EXCEPT those in the backup folder
for %%i in (*) do (
    if /I not "%%i"=="backup.bat" (
        if /I not "%%i"=="loadbackup.bat" (
            echo Copying file: %%i
            copy "%%i" "backup\backup_%timestamp%\%%i"
        )
    )
)

REM Create a backup info file
echo Backup created on %date% at %time% > "backup\backup_%timestamp%\backup_info.txt"
echo Project: Jisho App >> "backup\backup_%timestamp%\backup_info.txt"
echo Backup ID: %timestamp% >> "backup\backup_%timestamp%\backup_info.txt"

echo.
echo Backup completed successfully!
echo Backup location: backup\backup_%timestamp%
echo.
pause