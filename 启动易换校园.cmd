@echo off
chcp 65001 >nul 2>nul
setlocal
set "ELECTRON_RUN_AS_NODE=1"
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
echo ============================================
echo   易换校园 - 正在启动...
echo   访问地址: http://localhost:3000
echo   按 Ctrl+C 停止服务
echo ============================================
echo.
"D:\CodeArts Agent\codearts-agent.exe" --experimental-sqlite "%PROJECT_ROOT%server\src\index.js"
echo.
echo 服务已停止。按任意键关闭窗口。
pause >nul