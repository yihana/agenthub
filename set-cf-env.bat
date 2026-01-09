@echo off
REM SAP BTP Cloud Foundry 환경 변수 설정 스크립트

echo ========================================
echo SAP BTP 환경 변수 설정 중...
echo ========================================
echo.

REM HANA DB 접속 정보 (SAP HANA Database Explorer에서 생성한 사용자 정보)
echo [1/7] HANA_USER 설정...
cf set-env ear-app HANA_USER "EAR"

echo [2/7] HANA_PASSWORD 설정...
cf set-env ear-app HANA_PASSWORD ""

echo [3/7] HANA_HOST 설정...
cf set-env ear-app HANA_HOST "43a0d1f8-c468-4a80-a730-137cc0a88699.hana.prod-ap12.hanacloud.ondemand.com"

echo [4/7] HANA_PORT 설정...
cf set-env ear-app HANA_PORT "443"

echo [5/7] HANA_ENCRYPT 설정...
cf set-env ear-app HANA_ENCRYPT "true"

echo [6/7] HANA_SSL_VALIDATE_CERTIFICATE 설정...
cf set-env ear-app HANA_SSL_VALIDATE_CERTIFICATE "false"

echo [7/7] HANA_SCHEMA 설정...
cf set-env ear-app HANA_SCHEMA "EAR"

echo.
echo ========================================
echo 환경 변수 설정 완료!
echo 이제 'cf restage ear-app' 명령을 실행하세요.
echo ========================================
echo.

pause

