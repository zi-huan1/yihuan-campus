@echo off
chcp 65001 >nul 2>nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto try_agent
set "NODE_EXE=node"
set "NODE_FLAGS="
goto run

:try_agent
if not exist "D:\CodeArts Agent\codearts-agent.exe" goto missing
set "ELECTRON_RUN_AS_NODE=1"
set "NODE_EXE=D:\CodeArts Agent\codearts-agent.exe"
set "NODE_FLAGS=--experimental-sqlite"
goto run

:missing
echo Node.js was not found, and the CodeArts Agent runtime was not found either.
echo Please install Node.js 24 or later from https://nodejs.org/ , then open this file again.
pause
exit /b 1

:run
echo ============================================
echo   易换校园 - 公网访问模式
echo   正在启动本地服务并开通公网网址...
echo   公网网址会显示在下方，把它发给要访问的人
echo   按 Ctrl+C 停止服务并关闭公网网址
echo ============================================
echo.
"%NODE_EXE%" %NODE_FLAGS% "%~dp0scripts\tunnel.cjs"
if errorlevel 1 pause
exit /b