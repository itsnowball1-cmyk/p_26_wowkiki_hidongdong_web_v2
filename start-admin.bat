@echo off
cd /d d:\p_26_wowkiki_hidongdong_web_v2\code
start "API" cmd /k "npm run api"
cd /d d:\p_26_wowkiki_hidongdong_web_v2\admin
start "Admin" cmd /k "npm run dev"
