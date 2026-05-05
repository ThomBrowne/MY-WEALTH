@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem .env 파일 로드
for /f "tokens=1,2 delims==" %%a in (..\\.env) do set %%a=%%b

echo [Finance API] 서버 시작 중...
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
