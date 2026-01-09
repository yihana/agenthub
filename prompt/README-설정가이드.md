# EAR 시스템 - 데이터베이스 설정 가이드

## 개요
이 프로젝트는 PostgreSQL과 SAP HANA DB를 모두 지원합니다.

## 실행 방법

### 1. HANA DB로 실행 (기본)
```bash
npm run dev
```

### 2. PostgreSQL로 실행
```bash
npm run postgres
```

## 환경 설정

### 1단계: 패키지 설치
먼저 필요한 패키지를 설치합니다:

```bash
# 루트 디렉토리에서
npm install

# 서버 디렉토리에서
cd server
npm install
```

### 2단계: .env 파일 생성

`server` 디렉토리에 `.env` 파일을 생성하고 아래 내용을 복사합니다:

```env
# 기본 환경 변수
# DB_TYPE은 스크립트에서 자동으로 설정됩니다 (dev = hana, postgres = postgres)

# PostgreSQL 설정
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=fhzjfdlwl88!#
DB_DATABASE=ragdb

# SAP HANA DB 설정 (EAR 스키마 사용)
HANA_HOST=43a0d1f8-c468-4a80-a730-137cc0a88699.hana.prod-ap12.hanacloud.ondemand.com
HANA_PORT=443
HANA_USER=EAR
HANA_PASSWORD=Earuser1234!@
HANA_ENCRYPT=true
HANA_SSL_VALIDATE_CERTIFICATE=false

# 주의: HANA DB는 EAR 스키마를 사용합니다. 
# 모든 테이블은 EAR.테이블명 형식으로 생성됩니다.

# OpenAI API Key (필수)
OPENAI_API_KEY=your_openai_api_key_here

# JWT Secret (필수)
JWT_SECRET=your_jwt_secret_here

# Server Port
PORT=3001
```

**중요**: `OPENAI_API_KEY`와 `JWT_SECRET`을 실제 값으로 변경해야 합니다.

### 3단계: 데이터베이스 준비

#### PostgreSQL 사용 시
1. PostgreSQL이 설치되어 있어야 합니다
2. pgvector extension이 설치되어 있어야 합니다
3. `ragdb` 데이터베이스를 생성합니다:
   ```sql
   CREATE DATABASE ragdb;
   ```

#### HANA DB 사용 시
- HANA DB는 이미 설정된 클라우드 인스턴스를 사용합니다
- 연결 정보는 이미 .env 파일에 포함되어 있습니다
- **중요**: HANA DB에서는 `EAR` 스키마를 사용합니다
- 모든 테이블은 `EAR.테이블명` 형식으로 생성 및 접근됩니다
- EAR 스키마가 HANA DB에 미리 생성되어 있어야 합니다

## 데이터베이스별 차이점

### PostgreSQL
- **장점**: 
  - pgvector를 통한 고성능 벡터 검색
  - 로컬 개발에 적합
  - 무료
- **단점**: 
  - 별도 설치 필요

### SAP HANA DB
- **장점**: 
  - 엔터프라이즈급 성능
  - 클라우드 기반
  - 고급 분석 기능
- **단점**: 
  - 벡터 검색 기능 제한적 (직접 구현 필요)
  - 라이선스 필요

## 실행 흐름

### HANA DB로 실행
```bash
npm run dev
```
1. `DB_TYPE=hana` 환경변수가 설정됩니다
2. HANA DB 클라이언트로 연결됩니다
3. HANA용 테이블이 자동으로 생성됩니다
4. 서버가 시작됩니다

### PostgreSQL로 실행
```bash
npm run postgres
```
1. `DB_TYPE=postgres` 환경변수가 설정됩니다
2. PostgreSQL 풀로 연결됩니다
3. pgvector extension이 활성화됩니다
4. PostgreSQL용 테이블이 자동으로 생성됩니다
5. 서버가 시작됩니다

## 문제 해결

### HANA DB 연결 실패
- HANA 클라우드 인스턴스가 실행 중인지 확인
- 방화벽 설정 확인
- 연결 정보(호스트, 포트, 사용자명, 비밀번호) 확인
- **EAR 스키마가 존재하는지 확인**
  ```sql
  -- HANA DB에 접속하여 실행
  CREATE SCHEMA EAR;
  ```

### PostgreSQL 연결 실패
- PostgreSQL 서비스가 실행 중인지 확인
- 데이터베이스가 생성되었는지 확인
- 연결 정보(호스트, 포트, 사용자명, 비밀번호, 데이터베이스명) 확인

### pgvector extension 오류
PostgreSQL에서 pgvector extension을 설치:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-15-pgvector

# macOS (Homebrew)
brew install pgvector

# 또는 소스에서 빌드
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

### @sap/hana-client 설치 오류
HANA 클라이언트는 네이티브 모듈이므로 빌드 도구가 필요합니다:

Windows:
```bash
npm install --global windows-build-tools
```

Linux:
```bash
sudo apt-get install build-essential
```

macOS:
```bash
xcode-select --install
```

## 기본 관리자 계정
- **사용자명**: admin
- **비밀번호**: admin123
- 최초 로그인 후 비밀번호를 변경하세요

## 추가 정보
- 데이터베이스 타입은 런타임에 환경변수로 결정됩니다
- 동일한 코드베이스로 두 데이터베이스 모두 지원합니다
- 쿼리는 자동으로 각 DB 타입에 맞게 변환됩니다

## 주의사항
1. HANA DB는 벡터 검색이 제한적이므로, 대용량 RAG 검색에는 PostgreSQL을 권장합니다
2. 프로덕션 환경에서는 .env 파일을 .gitignore에 추가하여 보안을 유지하세요
3. OpenAI API 키는 실제 서비스용 키로 교체하세요

