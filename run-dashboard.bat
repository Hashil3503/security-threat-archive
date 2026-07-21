@echo off
chcp 65001 >nul
echo ===================================================
echo   보안 위협 아카이브 (Security Threat Archive)
echo   일괄 실행 및 외부 연동 스크립트
echo ===================================================
echo.

:: 1. MariaDB 포트 (3306) 확인
echo [1/3] 데이터베이스 MariaDB 연결 상태 확인 중...
netstat -ano | findstr :3306 >nul
if %errorlevel% neq 0 (
    echo [경고] 3306 포트 MariaDB 가 열려있지 않은 것 같습니다.
    echo MariaDB 서비스가 실행 중인지 확인해 주세요.
    echo.
) else (
    echo [성공] MariaDB가 3306 포트에서 응답 중입니다.
)

:: 2. Spring Boot 서버 시작
echo [2/3] Spring Boot 서버 실행 시작 (포트: 8082)...
start "Security Archive Backend" cmd /k ".\gradlew.bat bootRun"
echo Spring Boot 서버 기동 명령을 새로운 창에서 실행했습니다.
echo.

:: 3. ngrok 환경을 확인하는 중...
echo [3/3] ngrok 환경을 확인하는 중...
set NGROK_PATH=ngrok
where ngrok >nul 2>nul
if %errorlevel% equ 0 (
    goto RUN_NGROK
)

if exist "C:\ngrok\ngrok.exe" (
    set NGROK_PATH=C:\ngrok\ngrok.exe
    goto RUN_NGROK
)

if exist ".\ngrok.exe" (
    set NGROK_PATH=.\ngrok.exe
    goto RUN_NGROK
)

echo [안내] 시스템 PATH 또는 C:\ngrok\ 폴더에서 ngrok.exe를 찾지 못했습니다.
echo ngrok을 실행하려면 ngrok이 설치된 전체 경로를 입력하거나 엔터를 눌러 다운로드 가이드를 확인하세요.
set /p USER_NGROK_PATH="ngrok.exe 파일 경로 입력 (예: C:\tools\ngrok.exe) 또는 엔터: "

if "%USER_NGROK_PATH%"=="" (
    echo.
    echo ---------------------------------------------------
    echo ngrok 연동을 위해 다음 단계를 먼저 진행해 주세요:
    echo 1. https://ngrok.com 에서 회원가입 및 다운로드
    echo 2. 압축을 풀어 C:\ngrok\ngrok.exe 로 배치
    echo 3. 다음 명령어로 인증 토큰 등록:
    echo    C:\ngrok\ngrok.exe config add-authtoken [내_인증_토큰]
    echo ---------------------------------------------------
    echo.
    echo Spring Boot 서버는 실행 중입니다. 엔터를 누르면 종료됩니다.
    pause >nul
    exit
) else (
    set NGROK_PATH=%USER_NGROK_PATH%
)

:RUN_NGROK
echo.
echo ngrok 터널링 (Port: 8082 to 외부 HTTPS) 을 시작합니다...
echo 새로운 터미널 창에서 ngrok이 실행됩니다.
start "ngrok Tunneling (Port 8082)" cmd /k ""%NGROK_PATH%" http 8082 --url https://grope-gauze-rockslide.ngrok-free.dev"
echo.
echo ===================================================
echo 모든 서비스 기동 명령을 전송했습니다.
echo 1. Spring Boot 서버가 정상적으로 기동되었는지 콘솔을 확인해 주세요.
echo 2. ngrok 콘솔에서 생성된 HTTPS 외부 접속 링크(https://grope-gauze-rockslide.ngrok-free.dev)를 확인해 주세요.
echo ===================================================
pause