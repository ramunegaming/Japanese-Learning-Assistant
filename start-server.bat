@echo off

echo ============================================
echo Starting Twitch Token Manager...
echo ============================================

call "C:\Users\RamuneGaming\CascadeProjects\Twitch OAuth\RunTokenManager.bat"

if errorlevel 1 (
    echo.
    echo ❌ Twitch token manager failed.
    echo ❌ Bot will NOT be started.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo Starting Japanese Learning App Server...
echo ============================================

cd /d "C:\Users\RamuneGaming\CascadeProjects\jisho-app"

start /B node --no-deprecation server.js

timeout /t 8 /nobreak >nul

set /p open_website="Do you want me to open the website as well? Y/N: "

if /I "%open_website%"=="Y" (
    start chrome --new-window http://localhost:3001/
    echo Server and Chrome window launched successfully!
) else (
    echo Server started without opening the website.
)

pause