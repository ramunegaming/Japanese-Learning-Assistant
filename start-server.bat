@echo off
cd /d %~dp0
echo Starting Japanese Learning App Server...
start /B node server.js

:: Wait for the server to start (you can adjust this time if needed)
timeout /t 2 /nobreak >nul

:: Ask if you want to open the website
set /p open_website="Do you want me to open the website as well? Y/N: "

:: Check the input and decide whether to open the website
if /I "%open_website%"=="Y" (
    start chrome --new-window http://localhost:3001/
    echo Server and Chrome window launched successfully!
) else (
    echo Server started without opening the website.
)

pause