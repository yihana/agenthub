# 환경 변수 설정 가이드

이 문서는 EAR Base Version 애플리케이션의 환경 변수 설정 방법을 설명합니다.

## 📋 목차
1. [로컬 개발 환경 설정](#로컬-개발-환경-설정)
2. [SAP BTP Cloud Foundry 환경 설정](#sap-btp-cloud-foundry-환경-설정)
3. [필수 환경 변수](#필수-환경-변수)
4. [선택적 환경 변수](#선택적-환경-변수)
5. [데이터베이스 연결 설정](#데이터베이스-연결-설정)

---

## 로컬 개발 환경 설정

### 1. .env 파일 생성
프로젝트 루트 디렉토리에 `.env` 파일을 생성합니다:

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

### 2. .env 파일 편집
텍스트 에디터로 `.env` 파일을 열고 필요한 값을 입력합니다:

```env
# OpenAI API 설정
OPENAI_API_KEY=sk-proj-abc123...

# 데이터베이스 설정
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mypassword
DB_DATABASE=ear_db

# JWT 설정
JWT_SECRET=my-very-strong-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h

# 서버 설정
PORT=8787
NODE_ENV=development
```

### 3. 환경 변수 로드 확인
애플리케이션 시작 시 자동으로 `.env` 파일을 로드합니다.

---

## SAP BTP Cloud Foundry 환경 설정

### 방법 1: CF CLI 사용 (권장)

#### 필수 환경 변수 설정
```bash
# OpenAI API 키 (필수)
cf set-env ear-app OPENAI_API_KEY "sk-your-actual-api-key"

# JWT 시크릿 키 (필수)
cf set-env ear-app JWT_SECRET "your-very-strong-secret-key-here-min-32-chars"

# Node 환경 (필수)
cf set-env ear-app NODE_ENV "production"

# 데이터베이스 타입 (필수)
cf set-env ear-app DB_TYPE "hana"
```

#### 선택적 환경 변수 설정
```bash
# OpenAI 모델 설정
cf set-env ear-app EMBEDDING_MODEL "text-embedding-3-large"
cf set-env ear-app CHAT_MODEL "gpt-4o-mini"

# JWT 토큰 만료 시간
cf set-env ear-app JWT_EXPIRES_IN "24h"

# 관리자 초기 비밀번호
cf set-env ear-app ADMIN_PASSWORD "InitialPassword123!"

# 로그 레벨
cf set-env ear-app LOG_LEVEL "info"
```

#### 환경 변수 적용
```bash
# 앱 재시작 (환경 변수 변경 후 필수)
cf restart ear-app
```

### 방법 2: manifest.yml 사용

`manifest.yml` 파일에 환경 변수를 추가할 수 있지만, **민감한 정보는 포함하지 마세요**:

```yaml
applications:
  - name: ear-app
    env:
      NODE_ENV: production
      DB_TYPE: hana
      EMBEDDING_MODEL: text-embedding-3-large
      CHAT_MODEL: gpt-4o-mini
      JWT_EXPIRES_IN: 24h
      LOG_LEVEL: info
      # 주의: API 키나 비밀번호는 여기에 넣지 마세요!
```

민감한 정보는 배포 후 CF CLI로 설정:
```bash
cf set-env ear-app OPENAI_API_KEY "sk-..."
cf set-env ear-app JWT_SECRET "..."
cf restart ear-app
```

### 방법 3: BTP Cockpit 사용

1. SAP BTP Cockpit 로그인
2. Cloud Foundry → Spaces → 해당 Space 선택
3. Applications → ear-app 선택
4. User-Provided Variables 탭
5. + 버튼으로 환경 변수 추가
6. Save 후 앱 재시작

---

## 필수 환경 변수

### OPENAI_API_KEY
- **설명**: OpenAI API 접근 키
- **필수 여부**: 필수
- **형식**: `sk-...`로 시작하는 문자열
- **예시**: `sk-proj-abc123def456...`
- **획득 방법**: [OpenAI Platform](https://platform.openai.com/api-keys)에서 생성

```bash
# 로컬
OPENAI_API_KEY=sk-proj-...

# BTP
cf set-env ear-app OPENAI_API_KEY "sk-proj-..."
```

### JWT_SECRET
- **설명**: JWT 토큰 서명에 사용되는 비밀 키
- **필수 여부**: 필수
- **형식**: 최소 32자 이상의 랜덤 문자열
- **보안**: 절대 공개하지 말 것

```bash
# 강력한 랜덤 키 생성 (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 로컬
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...

# BTP
cf set-env ear-app JWT_SECRET "a1b2c3d4e5f6..."
```

### NODE_ENV
- **설명**: 실행 환경 구분
- **필수 여부**: 권장
- **값**: `development`, `production`, `test`
- **기본값**: `development`

```bash
# 로컬 (개발)
NODE_ENV=development

# BTP (프로덕션)
cf set-env ear-app NODE_ENV "production"
```

### DB_TYPE
- **설명**: 사용할 데이터베이스 유형
- **필수 여부**: 필수
- **값**: `postgres` 또는 `hana`
- **기본값**: `postgres`

```bash
# 로컬 (PostgreSQL)
DB_TYPE=postgres

# BTP (HANA Cloud)
cf set-env ear-app DB_TYPE "hana"
```

---

## 선택적 환경 변수

### OpenAI 모델 설정

#### EMBEDDING_MODEL
- **설명**: 임베딩에 사용할 OpenAI 모델
- **기본값**: `text-embedding-3-large`
- **다른 옵션**: `text-embedding-3-small`, `text-embedding-ada-002`

```bash
EMBEDDING_MODEL=text-embedding-3-large
```

#### CHAT_MODEL
- **설명**: 채팅에 사용할 OpenAI 모델
- **기본값**: `gpt-4o-mini`
- **다른 옵션**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

```bash
CHAT_MODEL=gpt-4o-mini
```

### JWT 설정

#### JWT_EXPIRES_IN
- **설명**: JWT 토큰 만료 시간
- **기본값**: `24h`
- **형식**: `숫자 + 단위` (s=초, m=분, h=시간, d=일)
- **예시**: `30m`, `24h`, `7d`

```bash
JWT_EXPIRES_IN=24h
```

### 서버 설정

#### PORT
- **설명**: 서버 포트 번호
- **기본값**: `8787`
- **BTP**: Cloud Foundry가 자동으로 할당 (일반적으로 8080)

```bash
# 로컬
PORT=8787

# BTP (자동 할당됨, 설정 불필요)
```

#### LOG_LEVEL
- **설명**: 로그 출력 레벨
- **기본값**: `info`
- **값**: `error`, `warn`, `info`, `debug`, `trace`

```bash
LOG_LEVEL=info
```

### 관리자 설정

#### ADMIN_PASSWORD
- **설명**: 관리자 계정 초기 비밀번호
- **기본값**: `admin123` (개발용)
- **권장**: 프로덕션에서는 강력한 비밀번호 사용 후 즉시 변경

```bash
# 프로덕션
ADMIN_PASSWORD=StrongP@ssw0rd123!
```

### 파일 업로드 설정

#### MAX_FILE_SIZE
- **설명**: 업로드 가능한 최대 파일 크기 (바이트)
- **기본값**: `10485760` (10MB)

```bash
MAX_FILE_SIZE=10485760
```

#### UPLOAD_PATH
- **설명**: 업로드된 파일 저장 경로
- **기본값**: `./uploads`
- **BTP**: 임시 파일 시스템 사용 (영구 저장은 Object Storage 사용 권장)

```bash
UPLOAD_PATH=./uploads
```

---

## 데이터베이스 연결 설정

### PostgreSQL (로컬 개발용)

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mypassword
DB_DATABASE=ear_db
```

### SAP HANA (로컬 테스트용)

```env
DB_TYPE=hana
HANA_HOST=your-hana-instance.hanacloud.ondemand.com
HANA_PORT=443
HANA_USER=your-username
HANA_PASSWORD=your-password
HANA_ENCRYPT=true
HANA_SSL_VALIDATE_CERTIFICATE=false
```

### SAP HANA Cloud (BTP)

BTP에서는 VCAP_SERVICES를 통해 자동으로 연결 정보를 가져옵니다:

```bash
# DB_TYPE만 설정하면 됨
cf set-env ear-app DB_TYPE "hana"

# 서비스 바인딩 확인
cf services
cf service ear-hana-db
```

애플리케이션은 자동으로 `VCAP_SERVICES` 환경 변수에서 HANA 연결 정보를 파싱합니다.

---

## 환경 변수 확인 및 관리

### 로컬 환경

```bash
# .env 파일 확인
cat .env

# Node.js에서 환경 변수 확인
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY)"
```

### BTP 환경

```bash
# 모든 환경 변수 확인
cf env ear-app

# 특정 환경 변수만 확인 (JSON 파싱 필요)
cf env ear-app | grep OPENAI_API_KEY

# 환경 변수 제거
cf unset-env ear-app VARIABLE_NAME
cf restart ear-app
```

---

## 보안 모범 사례

### 1. 민감한 정보 관리
- ✅ `.env` 파일을 `.gitignore`에 추가
- ✅ API 키와 비밀번호는 소스 코드에 포함하지 않기
- ✅ 프로덕션에서는 강력한 JWT_SECRET 사용
- ❌ manifest.yml에 API 키 포함하지 않기

### 2. 환경 분리
```bash
# 개발 환경
.env.development

# 스테이징 환경
.env.staging

# 프로덕션 환경
# BTP에서 CF CLI로 직접 설정
```

### 3. 정기적인 키 교체
```bash
# OpenAI API 키 교체
cf set-env ear-app OPENAI_API_KEY "새로운키"

# JWT 시크릿 교체 (주의: 기존 토큰 무효화됨)
cf set-env ear-app JWT_SECRET "새로운시크릿"

# 재시작
cf restart ear-app
```

### 4. 접근 권한 제한
- BTP Space에 대한 접근 권한을 최소화
- 환경 변수 조회 권한이 있는 사용자 제한
- 감사 로그 활성화

---

## 문제 해결

### 환경 변수가 적용되지 않는 경우

```bash
# 1. 환경 변수 설정 확인
cf env ear-app

# 2. 앱 재시작
cf restart ear-app

# 3. 재배포 (restage)
cf restage ear-app
```

### VCAP_SERVICES 파싱 오류

```bash
# VCAP_SERVICES 전체 내용 확인
cf env ear-app | grep VCAP_SERVICES

# 서비스 바인딩 재설정
cf unbind-service ear-app ear-hana-db
cf bind-service ear-app ear-hana-db
cf restart ear-app
```

### OpenAI API 연결 오류

```bash
# API 키 확인
cf env ear-app | grep OPENAI_API_KEY

# API 키 재설정
cf set-env ear-app OPENAI_API_KEY "sk-..."
cf restart ear-app

# 로그 확인
cf logs ear-app --recent
```

---

## 환경 변수 템플릿

### 개발 환경 (.env.development)
```env
OPENAI_API_KEY=sk-...
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=ear_db
JWT_SECRET=dev-secret-key-not-for-production
NODE_ENV=development
PORT=8787
LOG_LEVEL=debug
```

### 프로덕션 환경 (BTP)
```bash
#!/bin/bash
# set-env-production.sh

cf set-env ear-app OPENAI_API_KEY "sk-..."
cf set-env ear-app JWT_SECRET "$(openssl rand -hex 32)"
cf set-env ear-app NODE_ENV "production"
cf set-env ear-app DB_TYPE "hana"
cf set-env ear-app EMBEDDING_MODEL "text-embedding-3-large"
cf set-env ear-app CHAT_MODEL "gpt-4o-mini"
cf set-env ear-app JWT_EXPIRES_IN "24h"
cf set-env ear-app LOG_LEVEL "info"
cf set-env ear-app ADMIN_PASSWORD "StrongP@ssw0rd123!"

cf restart ear-app
```

---

## 참고 자료

- [dotenv 문서](https://github.com/motdotla/dotenv)
- [Cloud Foundry 환경 변수](https://docs.cloudfoundry.org/devguide/deploy-apps/environment-variable.html)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [JWT 모범 사례](https://jwt.io/introduction)

---

환경 변수 설정에 문제가 있으면 로그를 확인하고, 필요시 관리자에게 문의하세요. 🔐






