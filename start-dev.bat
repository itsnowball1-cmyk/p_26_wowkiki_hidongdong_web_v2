@echo off
cd /d d:\p_26_wowkiki_hidongdong_web_v2\code
start "Frontend" cmd /k "npm run dev"
start "Worker" cmd /k "npm run worker"
