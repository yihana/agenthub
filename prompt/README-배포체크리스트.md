# SAP BTP 배포 전/후 체크리스트

## 📋 배포 전 체크리스트

### 1. 개발 환경 준비
- [ ] Node.js 18 이상 설치 확인: `node --version`
- [ ] npm 9 이상 설치 확인: `npm --version`
- [ ] Git 설치 확인: `git --version`
- [ ] CF CLI 설치 확인: `cf --version`

### 2. SAP BTP 계정 및 권한
- [ ] SAP BTP 계정 준비 (Trial 또는 Enterprise)
- [ ] Cloud Foundry Subaccount 생성
- [ ] Cloud Foundry Space 생성 (예: dev, staging, production)
- [ ] Space Developer 권한 확인

### 3. 서비스 인스턴스 준비
- [ ] SAP HANA Cloud 인스턴스 생성 또는 권한 확인
- [ ] HANA Cloud 상태 확인 (Running)
- [ ] 서비스 바인딩 권한 확인
- [ ] (선택) Redis 서비스 인스턴스 생성

### 4. API 키 및 인증 정보
- [ ] OpenAI API 키 발급 완료
- [ ] OpenAI API 사용량 한도 확인
- [ ] JWT 시크릿 키 생성 (32자 이상)
  ```bash
  # 생성 명령어
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] 관리자 초기 비밀번호 준비

### 5. 로컬 빌드 테스트
- [ ] 의존성 설치: `npm install`
- [ ] 프론트엔드 빌드: `npm run build:web`
- [ ] 백엔드 빌드: `npm run build:server`
- [ ] 빌드 결과 확인:
  - [ ] `web/dist/` 폴더 존재
  - [ ] `server/dist/` 폴더 존재
  - [ ] `server/dist/index.js` 파일 존재

### 6. 설정 파일 준비
- [ ] `manifest.yml` 파일 검토
  - [ ] 앱 이름 확인: `ear-app`
  - [ ] 메모리 설정 확인: `1G` (필요시 조정)
  - [ ] 서비스 바인딩 확인: `ear-hana-db`
  - [ ] 라우트 설정 확인
- [ ] `.cfignore` 파일 확인
- [ ] `Procfile` 파일 확인
- [ ] `.npmrc` 파일 확인

### 7. 환경 변수 준비
민감한 정보를 제외한 설정 확인:
- [ ] `NODE_ENV=production`
- [ ] `DB_TYPE=hana`
- [ ] `EMBEDDING_MODEL` (기본값 사용 또는 변경)
- [ ] `CHAT_MODEL` (기본값 사용 또는 변경)

별도로 설정할 민감 정보:
- [ ] `OPENAI_API_KEY` 준비
- [ ] `JWT_SECRET` 준비
- [ ] `ADMIN_PASSWORD` 준비

---

## 🚀 배포 단계 체크리스트

### 1. Cloud Foundry 로그인
```bash
cf login -a https://api.cf.{region}.hana.ondemand.com
```
- [ ] API 엔드포인트 연결 성공
- [ ] 이메일/비밀번호 인증 성공
- [ ] Organization 선택 완료
- [ ] Space 선택 완료
- [ ] 로그인 상태 확인: `cf target`

### 2. HANA 서비스 생성
```bash
cf create-service hana hdi-shared ear-hana-db
```
- [ ] 서비스 생성 명령 실행
- [ ] 서비스 생성 진행 상태 확인: `cf service ear-hana-db`
- [ ] 서비스 상태가 "create succeeded"로 변경될 때까지 대기
  - ⏱️ 대기 시간: 약 5-15분 소요 가능

### 3. 애플리케이션 배포
```bash
# 방법 1: 자동 스크립트 사용 (권장)
./cf-deploy.sh      # Mac/Linux
cf-deploy.bat       # Windows

# 방법 2: 수동 배포
npm install
npm run build
cf push
```
- [ ] 빌드 스크립트 실행 완료
- [ ] `cf push` 명령 실행
- [ ] 스테이징 단계 완료 확인
- [ ] 앱 시작 확인

### 4. 환경 변수 설정
```bash
cf set-env ear-app OPENAI_API_KEY "sk-..."
cf set-env ear-app JWT_SECRET "your-secret-key"
cf set-env ear-app ADMIN_PASSWORD "YourPassword123!"
cf restart ear-app
```
- [ ] 모든 필수 환경 변수 설정 완료
- [ ] 앱 재시작 완료
- [ ] 재시작 후 앱 상태 "running" 확인

---

## ✅ 배포 후 검증 체크리스트

### 1. 앱 상태 확인
```bash
cf app ear-app
```
- [ ] 상태: `running`
- [ ] 인스턴스: `1/1` (또는 설정한 인스턴스 수)
- [ ] 메모리 사용량 정상 범위
- [ ] CPU 사용량 정상 범위
- [ ] 디스크 사용량 정상 범위

### 2. 헬스 체크 API 테스트
```bash
curl https://ear-app-{your-route}/health
```
또는 브라우저에서 접속

예상 응답:
```json
{"status":"OK","timestamp":"2025-10-15T12:34:56.789Z"}
```
- [ ] 헬스 체크 API 응답 성공 (HTTP 200)
- [ ] JSON 형식 응답 확인
- [ ] timestamp 값이 현재 시간과 일치

### 3. 프론트엔드 접속 테스트
```bash
cf open ear-app
```
또는 브라우저에서 앱 URL 접속

- [ ] 로그인 페이지 정상 로드
- [ ] CSS 스타일 정상 적용
- [ ] 이미지/아이콘 정상 표시
- [ ] 콘솔에 에러 없음

### 4. 인증 기능 테스트
- [ ] 관리자 계정으로 로그인 시도
  - 기본 계정: `admin` / 설정한 비밀번호
- [ ] 로그인 성공 확인
- [ ] JWT 토큰 발급 확인 (개발자 도구 확인)
- [ ] 대시보드/메인 화면 이동 확인

### 5. 데이터베이스 연결 테스트
- [ ] 사용자 목록 조회 성공
- [ ] 로그인 이력 조회 성공
- [ ] 데이터베이스 쿼리 정상 실행 확인

### 6. OpenAI API 연동 테스트
- [ ] 채팅 기능 테스트
  - 간단한 질문 입력: "안녕하세요"
  - AI 응답 수신 확인
- [ ] RAG 검색 기능 테스트 (문서 업로드 후)
- [ ] 임베딩 생성 테스트

### 7. 파일 업로드 테스트
- [ ] RAG 문서 업로드 페이지 접근
- [ ] 샘플 파일 업로드 (PDF, TXT, DOCX)
- [ ] 업로드 성공 확인
- [ ] 임베딩 생성 완료 확인
- [ ] 업로드된 문서 목록 확인

### 8. 주요 기능 테스트
- [ ] EAR 요청 등록 기능
- [ ] 개선 요청 기능
- [ ] 프로세스 시각화 기능
- [ ] 사용자 관리 기능 (관리자)
- [ ] 로그인 이력 조회
- [ ] 인터페이스 자동화 기능

### 9. 로그 확인
```bash
cf logs ear-app --recent
```
- [ ] 심각한 에러 로그 없음
- [ ] 데이터베이스 연결 로그 정상
- [ ] OpenAI API 호출 로그 정상
- [ ] 경고(Warning) 메시지 확인 및 조치

### 10. 성능 및 모니터링
- [ ] 평균 응답 시간 확인 (< 3초)
- [ ] 페이지 로딩 속도 확인
- [ ] 메모리 사용량 추이 확인
- [ ] CPU 사용량 추이 확인
- [ ] BTP Cockpit에서 앱 메트릭 확인

---

## 🔒 보안 체크리스트

### 1. 환경 변수 보안
- [ ] API 키가 소스 코드에 포함되지 않았는지 확인
- [ ] manifest.yml에 민감한 정보 없음 확인
- [ ] .gitignore에 .env 파일 포함 확인

### 2. 접근 제어
- [ ] HTTPS 강제 적용 확인 (BTP 기본 제공)
- [ ] CORS 설정 확인
- [ ] 인증 미들웨어 작동 확인
- [ ] 권한별 접근 제어 확인

### 3. 비밀번호 정책
- [ ] 관리자 초기 비밀번호 변경 완료
- [ ] 비밀번호 복잡도 요구사항 확인
- [ ] 로그인 실패 제한 작동 확인 (5회)

### 4. 데이터 보안
- [ ] HANA Cloud 암호화 활성화 확인
- [ ] 백업 정책 설정
- [ ] 개인정보 마스킹 기능 확인

---

## 📊 모니터링 설정 체크리스트

### 1. BTP Cockpit 설정
- [ ] Application 메뉴에서 ear-app 확인
- [ ] Metrics 탭 활성화
- [ ] Logs 탭 활성화
- [ ] Events 탭 확인

### 2. 알림 설정 (선택사항)
- [ ] 앱 중단 알림 설정
- [ ] 메모리 초과 알림 설정
- [ ] 에러율 알림 설정

### 3. 로깅 전략
- [ ] 로그 레벨 설정 확인: `LOG_LEVEL=info`
- [ ] 중요 이벤트 로그 확인
- [ ] 에러 로그 모니터링 계획 수립

---

## 🔄 운영 체크리스트

### 1. 백업 계획
- [ ] HANA Cloud 자동 백업 활성화
- [ ] 백업 주기 설정 (일일/주간)
- [ ] 백업 보관 기간 설정
- [ ] 복구 절차 문서화

### 2. 스케일링 계획
- [ ] 현재 리소스 사용량 기록
- [ ] 예상 사용자 수 파악
- [ ] 스케일링 기준 설정
  ```bash
  # 수평 스케일링
  cf scale ear-app -i 2
  
  # 수직 스케일링
  cf scale ear-app -m 2G -k 2G
  ```

### 3. 업데이트 계획
- [ ] Blue-Green 배포 전략 검토
- [ ] 롤백 절차 문서화
- [ ] 업데이트 테스트 환경 준비

### 4. 비용 관리
- [ ] BTP 사용량 모니터링 설정
- [ ] OpenAI API 사용량 한도 설정
- [ ] 월별 예산 설정
- [ ] 비용 알림 설정

---

## 📞 문제 발생 시 대응

### 즉시 확인 사항
```bash
# 1. 앱 상태
cf app ear-app

# 2. 최근 로그
cf logs ear-app --recent

# 3. 환경 변수
cf env ear-app

# 4. 서비스 바인딩
cf services

# 5. 이벤트 로그
cf events ear-app
```

### 일반적인 문제 및 해결
- [ ] 앱이 시작되지 않음 → 로그 확인, 환경 변수 확인
- [ ] 데이터베이스 연결 오류 → 서비스 바인딩 확인
- [ ] OpenAI API 오류 → API 키 확인, 사용량 한도 확인
- [ ] 메모리 부족 → 스케일링 고려
- [ ] 성능 저하 → 인스턴스 증설 고려

---

## 📚 참고 문서

배포 관련 상세 문서:
- [📘 전체 BTP 배포 가이드](./README-BTP배포가이드.md)
- [🔐 환경 변수 설정 가이드](./README-환경변수설정.md)
- [⚡ 빠른 배포 가이드](./README-빠른배포.md)
- [⚙️ HANA DB 전환 가이드](./README-hanadb전환.md)

---

## ✅ 최종 확인

배포가 완료되고 모든 테스트가 통과했다면:

- [ ] 모든 체크리스트 항목 완료
- [ ] 운영 담당자에게 배포 완료 통보
- [ ] 사용자에게 서비스 URL 전달
- [ ] 모니터링 대시보드 확인
- [ ] 배포 문서 업데이트
- [ ] 다음 배포를 위한 개선사항 기록

---

**🎉 축하합니다! SAP BTP 배포가 성공적으로 완료되었습니다!**

지속적인 모니터링과 정기적인 업데이트를 통해 안정적인 서비스를 제공하세요.






