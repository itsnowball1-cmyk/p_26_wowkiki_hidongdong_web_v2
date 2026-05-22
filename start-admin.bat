@echo off
cd /d d:\p_26_wowkiki_hidongdong_web_v2\code
start "Worker" cmd /k "npm run worker"
cd /d d:\p_26_wowkiki_hidongdong_web_v2\admin
start "Admin" cmd /k "npm run dev"
