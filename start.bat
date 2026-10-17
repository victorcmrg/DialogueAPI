@echo off
cd /d "%~dp0"
set PORT=5173
start "" http://localhost:5173/
node server.js
pause
