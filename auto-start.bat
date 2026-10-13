@echo off
cd /d "%~dp0"
echo Starting local dev server (npm run dev)...
echo Imagine Live TV: http://localhost:8090
start "" "http://localhost:8090/"
call npm run dev -- --host 0.0.0.0 --port 8090
