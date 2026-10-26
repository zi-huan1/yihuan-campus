@echo off
chcp 65001 >nul 2>nul
setlocal
cd /d "%~dp0"

rem 优先使用系统安装的 Node.js
where node >nul 2>nul
if errorlevel 1 goto try_agent
set "NODE_EXE=node"
set "NODE_FLAGS="
goto run

:try_agent
rem 回退到码道 Agent 内置 Node 运行时（Node 22，需 --experimental-sqlite）
if not exist "D:\CodeArts Agent\codearts-agent.exe" goto missing
set "ELECTRON_RUN_AS_NODE=1"
set "NODE_EXE=D:\CodeArts Agent\codearts-agent.exe"
set "NODE_FLAGS=--experimental-sqlite"
goto run

:missing
echo Node.js was not found on PATH, and the CodeArts Agent runtime was not found either.
echo Please install Node.js 24 or later from https://nodejs.org/ , then open this file again.
pause
exit /b 1

:run
"%NODE_EXE%" %NODE_FLAGS% "%~dp0scripts\start.cjs"
if errorlevel 1 pause
exit /b
