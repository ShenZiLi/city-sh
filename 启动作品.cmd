@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22 或更新版本，再双击运行。
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo 未找到成品目录，请先运行 npm install 和 npm run build。
  pause
  exit /b 1
)
start "" http://127.0.0.1:4173
node scripts\serve.mjs
pause
