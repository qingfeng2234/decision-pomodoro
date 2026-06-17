@echo off
title Decision Pomodoro
cd /d "%~dp0decision-pomodoro"
start "" http://localhost:5173/
node_modules\.bin\vite.cmd
pause
