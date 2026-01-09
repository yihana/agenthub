# 빠른 배포 가이드 (Quick Start)

SAP BTP Cloud Foundry 환경에 5분 안에 배포하기

## 🚀 전제 조건

- [x] CF CLI 설치됨
- [x] SAP BTP 계정 있음
- [x] OpenAI API 키 있음

## 📝 5단계 배포

### 1️⃣ Cloud Foundry 로그인
```bash
cf login -a https://api.cf.eu10.hana.ondemand.com
```

### 2️⃣ HANA 서비스 생성
```bash
cf create-service hana hdi-shared ear-hana-db
```

### 3️⃣ 배포 실행
```bash
# Windows
cf-deploy.bat

# Mac/Linux
chmod +x cf-deploy.sh
./cf-deploy.sh
```

### 4️⃣ 환경 변수 설정
```bash
cf set-env ear-app OPENAI_API_KEY "sk-your-api-key"
cf set-env ear-app JWT_SECRET "$(openssl rand -hex 32)"
cf restart ear-app
```

### 5️⃣ 앱 열기
```bash
cf app ear-app
# 또는
cf open ear-app
```

## 🎉 완료!

브라우저에서 애플리케이션이 열립니다.

- 기본 관리자 계정: `admin` / `admin123`
- 첫 로그인 후 비밀번호를 즉시 변경하세요!

---

## 🔧 문제 해결

### 배포 실패 시
```bash
cf logs ear-app --recent
```

### 서비스 생성 대기 중
```bash
cf service ear-hana-db
# 상태가 "create succeeded"가 될 때까지 대기
```

### 환경 변수 확인
```bash
cf env ear-app
```

---

## 📚 상세 가이드

더 자세한 정보는 다음 문서를 참고하세요:

- [📘 전체 BTP 배포 가이드](./README-BTP배포가이드.md)
- [🔐 환경 변수 설정 가이드](./README-환경변수설정.md)
- [⚙️ HANA DB 전환 가이드](./README-hanadb전환.md)

---

## 💡 유용한 명령어

```bash
# 앱 상태 확인
cf app ear-app

# 로그 스트리밍
cf logs ear-app

# 앱 재시작
cf restart ear-app

# 앱 중지
cf stop ear-app

# 앱 삭제
cf delete ear-app

# 서비스 목록
cf services

# 환경 변수 설정
cf set-env ear-app KEY "value"

# 스케일링
cf scale ear-app -i 2 -m 2G
```

Happy Deploying! 🎈






