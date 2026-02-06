# EAR Base Version

React + LangChain + Postgres/pgvector를 사용한 사내 지식기반 어시스턴트 시스템입니다.

## 🚀 빠른 시작

### 1. 환경 설정

#### PostgreSQL + pgvector 설치
```bash
# PostgreSQL 설치 (Windows)
# https://www.postgresql.org/download/windows/

# pgvector 확장 설치
# https://github.com/pgvector/pgvector#installation
```

#### 데이터베이스 설정
```sql
-- 데이터베이스 생성
CREATE DATABASE ragdb;

-- pgvector 확장 활성화
\c ragdb
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. 환경 변수 설정

루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
OPENAI_API_KEY=sk-your-openai-api-key
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=ragdb
EMBEDDING_MODEL=text-embedding-3-large
CHAT_MODEL=gpt-4o-mini
PORT=8787
```

### 3. 의존성 설치 및 실행

```bash
# 루트 디렉토리에서
npm install

# 백엔드 의존성 설치
cd server
npm install

# 프론트엔드 의존성 설치
cd ../web
npm install

# 루트로 돌아가서 개발 서버 실행
cd ..
npm run dev
```

### 4. 빌드 검증

```bash
# 루트 디렉토리에서 전체 빌드 검증
npm run build
```

## 📁 프로젝트 구조

```
rag-app/
├── .env                     # 환경 변수
├── package.json             # 루트 패키지 설정
├── server/                  # 백엔드 (Express + LangChain)
│   ├── index.ts            # Express 서버 진입점
│   ├── rag.ts              # RAG 파이프라인
│   ├── db.ts               # PostgreSQL 연결 및 헬퍼
│   ├── schemas.sql         # 데이터베이스 스키마
│   └── routes/             # API 라우트
│       ├── chat.ts         # 채팅 API
│       ├── ingest.ts       # 문서 적재 API
│       └── search.ts       # 검색 API
└── web/                     # 프론트엔드 (React + Vite)
    ├── src/
    │   ├── components/      # React 컴포넌트
    │   │   ├── ChatPane.tsx
    │   │   ├── HistoryPane.tsx
    │   │   ├── FirewallIntentModal.tsx
    │   │   └── MessageItem.tsx
    │   ├── hooks/           # 커스텀 훅
    │   │   └── useFirewallIntent.ts
    │   ├── App.tsx          # 메인 앱 컴포넌트
    │   ├── main.tsx         # React 진입점
    │   └── app.css          # 스타일
    └── package.json         # 프론트엔드 패키지 설정
```

## 🔧 주요 기능

### 1. RAG 시스템
- **문서 임베딩**: OpenAI text-embedding-3-large 모델 사용
- **벡터 검색**: PostgreSQL + pgvector로 유사도 검색
- **컨텍스트 증강**: 검색된 문서를 기반으로 LLM 답변 생성

### 2. 방화벽 특수 기능
- **키워드 감지**: "방화벽" 관련 용어 자동 감지
- **ITSM 연계**: 방화벽 오픈/변경/예외/진단 요청 템플릿 제공
- **필수 필드**: 각 템플릿별 필요한 정보 안내

### 3. 채팅 인터페이스
- **실시간 채팅**: OpenAI GPT-4o-mini 모델 사용
- **히스토리 관리**: 세션별 채팅 기록 저장 및 조회
- **근거 표시**: 답변에 참고 문서 정보 포함

### 4. 문서 관리
- **다양한 형식 지원**: TXT, PDF, DOCX, Markdown
- **자동 청킹**: 문서를 적절한 크기로 분할
- **메타데이터**: 문서 정보 및 업로드 시간 추적

## 📚 API 엔드포인트

### 채팅 API
- `POST /api/chat` - 메시지 전송 및 답변 생성
- `GET /api/chat/history/:sessionId` - 채팅 히스토리 조회
- `GET /api/chat/firewall-templates` - 방화벽 템플릿 조회

### 문서 적재 API
- `POST /api/ingest/file` - 파일 업로드 및 처리
- `POST /api/ingest/text` - 텍스트 직접 입력
- `GET /api/ingest/status/:documentId` - 처리 상태 조회

### 검색 API
- `GET /api/search?q=검색어` - 문서 검색 (디버그용)
- `GET /api/search/stats` - 검색 통계

## 🛡️ 보안 고려사항

1. **API 키 보안**: OpenAI API 키는 백엔드에서만 사용
2. **민감정보 처리**: 개인정보 마스킹 및 요약 제공
3. **외부 반출 금지**: 내부 포털/티켓 링크만 안내
4. **접근 제어**: 필요시 인증/권한 시스템 추가

## 🔍 시스템 프롬프트

시스템은 다음 원칙을 따릅니다:

1. **근거 우선**: 검색된 문서 근거를 답변 마지막에 제시
2. **모르면 모른다고 말하기**: 근거 부족 시 명확히 표기
3. **민감정보 취급**: 개인정보 마스킹 및 요약 제공
4. **ITSM 연계**: 방화벽 관련 문의 시 템플릿 추천
5. **간결한 스타일**: 요약 → 상세 절차 → 근거 순서
6. **최신성**: 날짜/버전 정보 명확히 표기

## 🚨 문제 해결

### 데이터베이스 연결 오류
```bash
# PostgreSQL 서비스 확인
# Windows: services.msc에서 PostgreSQL 서비스 확인
# Linux: sudo systemctl status postgresql
```

### OpenAI API 오류
- API 키가 올바른지 확인
- 사용량 한도 확인
- 모델명이 정확한지 확인

### 의존성 설치 오류
```bash
# Node.js 버전 확인 (18.x 이상 권장)
node --version

# npm 캐시 정리
npm cache clean --force
```

## 📝 라이선스

이 프로젝트는 사내 사용을 위한 것입니다. 외부 배포 시 라이선스를 확인하세요.

## 🤝 기여

버그 리포트나 기능 제안은 내부 이슈 트래커를 통해 제출해주세요.





## EAR 요청등록 기능
EAR 요청등록 메뉴 선택시 작동되는 기능으로 새로운 화면에서으로 떠야함 
EAR 요청등록 화면에는 
1. 채팅 입력창 (가장 상단에 위치)
2. 요청제목 
3. 요청내용
4. 첨부파일
이 표시되어야함

채팅 입력창은 2 ~ 4번 항목에 대한 입력을 자동화 하기 위해 대화식으로 ITSM 요청을 입력받을 수 있는 기능이 구현되어야 함
채팅 입력창에 타이핑이 이루어 질때마타 키워드 감지 기능이 작동 되어야함

키워드 감지 기능 예제
"방화" 와 같이 2글자 이상 입력시 부터 한글자가 typing 될때마다, 키워드 가 아래 채팅창 아래 선택가능한 툴팁처럼 제시되어야함
제시예시1 : "방화벽 오픈 신청"
제시예시2 "Firewall Access Request"

사용자가 제시예시중 "방화벽 오픈 신청" 이 선택되면, 
선택된 내용이 표시되고 그 아래에 그다음 선택이나 입력받는 기능이 표시되어야함

"방화벽 오픈 신청"의 경우 "출발지 IP","도착지 IP","Port","Protocal", "오픈일","종료일","대상시스템","오픈사유","서비스명"
"모든 내용이 입력되면" 그 내용에 맞도록 방화벽 오픈 신청을 등록함

키워드는 '방화' > '방화벽 오픈 신청' > '"출발지 IP","도착지 IP","Port","Protocal", "오픈일","종료일","대상시스템","오픈사유","서비스명"' 등은 DB에 저장되어야하고, 이러한 내용이 포함되도록 DB가 구성되어야함

## 개선요청 기능
개선요청 기능은 채팅 히스토리를 선택하여 채팅의 응답결과가 불만족스러운 부분을 개선요청 하는 기능임
개선요청 기능을 선택하면 새로운 창이 열려야 하고, 
채팅히스토리와 채팅창을 볼수 있어야 하는데 여기서 채팅히스토리에서 개선요청하고 싶은 부분을 선택하여 개선요청 하는 기능이 있어야 함
개선요청시, 어떤 부분이 맘에 안드는지 개선요청하는 창이 존재해야하며, 
개선요청의 분류가 "응답품질", "말도안되는 답변", "오류 개선" 등의 분류를 선택하여 요청을 올릴수 있는 기능도 포함되어야함
개선요청된 부분은 DB의 별도 테이블로 저장되어야 하고, 
본인이 개선요청한 부분은 조회가 가능한 페이지도 별도로 존재해야함
개선요청 관리자 페이지가 있어서 개선 요청에 대해 응답을 줄 수 있는 기능도 포함되어야함
개선요청 관리자 기능은 최초페이지 메뉴에서도 개선요청 관리자 기능으로 들어갈수 있어야함


## 프로세스 시각화 메뉴

###프로세스 시각화 기능
SAP 기반 ERP 업무 프로세스를 그래프(노드-엣지)로 시각화하고, 
단계 선택 시 관련 데이터 패널을 표시, AI에게 자연어로 질의/명령하여 상태를 수정할 수 있는 기능을 구현한다. 
OpenAI/Azure OpenAI를 통한 AI 질의/액션 에이전트를 포함한다.
ERP업무중 invoice 를 접수부터 처리하는 단계를 하나의 예제 데이터로 구현해줘

###프로세스 시각화 기능상세
프로세스 그래프 UI: React Flow 기반 또는 동일 기능 라이브러리로 ERP 단계(노드)와 흐름(엣지)을 시각화.
컨텍스트 패널: 노드 선택 시 해당 단계의 KPI, 미결(Backlog), 최근 처리건, 오류/예외, 권한 기반 액션 버튼 노출.
AI 패널: 자연어 질의 → RAG/도메인 규칙 기반 질의응답, 승인/반려/상태변경 같은 툴 호출 제공. 



---

"로그인 페이지와 관련된 화면 및 관련메뉴 및 페이지 추가생성해줘"

## 로그인 메뉴
ID/Password 기반 로그인 페이지 추가
페스워드 초기화 기능 필요
키보드만으로 로그인 가능해야함
로그인 5회 실패시 잠금처리
추후 다양한 SSO 솔루션 연동을 고려한 로그인 Table 설계필요
추후 사용자 테이블 기반 로그인 필요

## 로그인 이력 조회
로그인 이력관리 기능 페이지 별도 메뉴 추가


## 사용자 관리 기능
관리자 기능으로 사용자 관리 기능 필요
관리자로 지정된 사용자만 사용자 관리메뉴 접근가능
로그인 사용자는 다른 Regacy 시스템의 HR 정보 등으로부터 받아올 예정이므로, 사용자 테이블에는
id/password 외 다양한 정보가 저장가능 하도록 설계 되어야함







## 인터페이스 자동화
### 지시사항 : "인터페이스 연동 자동화" 메뉴 추가를 아래 요건을 고려하여 구현

### 1. 배경
- 현재 시스템은 특정 회사의 사원정보를 배치 프로그램을 통해 연동하는 기능을 보유.
- 연동해야 할 회사 수가 약 1,000개로, 개별 개발 시 시간과 인력이 과도하게 소요됨.
- 이를 해결하기 위해 **스탠다드 배치 서비스**를 기반으로 한 **자동화 인터페이스 생성 프로그램** 필요.

### 2. 목표
- 회사별 사원정보 연동 프로그램을 **자동 생성/관리**하는 React 기반 UI 제공.
- URL 기반 분석 및 매핑을 통해 배치 서비스를 자동화하여 개발 효율성과 확장성 확보.

### 3. 주요 기능 요구사항

#### 3.1 스탠다드 배치 서비스 생성
- 하나의 표준 배치 서비스를 기반으로 함.
- 자동 생성되는 배치 서비스 명칭 규칙:
  - **`StandardBatchService_회사명`**

#### 3.2 URL 입력 및 분석
- 상대방 회사에서 제공하는 사원정보 API URL 입력 가능.
- URL 분석 후 해당 API 구조(JSON Schema 등) 자동 파싱.
- 파싱 결과를 스탠다드 사원정보 구조와 자동 매핑.

#### 3.3 매핑 관리 기능
- 시스템이 제안하는 **자동 매핑 정보**를 UI로 표시.
- 사용자가 **승인**하거나 **수동으로 수정** 가능.
- 매핑 정보는 저장되어 향후 재사용 가능.

#### 3.4 인증 및 보안 설정
- URL 입력 시 다양한 인증 옵션 제공:
  - 토큰 기반 인증 (Bearer Token)
  - Basic Auth
  - OAuth2 등
- HTTPS 기반 인증 정보 입력 및 저장 가능.

#### 3.5 변경 이력 관리
- 스탠다드 배치 서비스가 수정될 경우,
  - **변경 전/후 차이점 비교** 기능 제공.
  - UI에서 Diff 형태로 가시화.

---

## 4. 화면 요구사항

1. **인터페이스 자동화 메뉴**
   - URL 입력 필드
   - 인증정보 입력 Form
   - 분석 및 매핑 실행 버튼

2. **매핑 결과 화면**
   - 기존 스탠다드 필드 vs 상대방 API 필드 비교표
   - 매핑 수정/저장 버튼

3. **이력 비교 화면**
   - 변경 전/후 매핑 구조 비교 (Diff View)
   - 변경 승인/취소 기능

---

## 5. 구현 완료 사항

### 프론트엔드 (React)
1. **메뉴 추가**
   - `MenuPane.tsx`: "인터페이스 연동 자동화" 메뉴 추가
   - `App.tsx`: 라우팅 설정 추가

2. **인터페이스 자동화 페이지** (`InterfaceAutomation.tsx`)
   - **3개 탭 구조**:
     - 인터페이스 생성: URL 입력, 분석, 매핑 설정
     - 인터페이스 관리: 등록된 인터페이스 목록 및 관리
     - 변경 이력: 변경 이력 조회 및 비교

3. **주요 기능**
   - URL 입력 및 API 분석
   - 다중 인증 방식 지원 (Bearer, Basic Auth, OAuth2)
   - 자동 필드 매핑 생성
   - 매핑 수동 수정 기능
   - 인터페이스 저장/수정/삭제
   - 변경 이력 관리

4. **스타일링**
   - `InterfaceAutomation.css`: 반응형 디자인 적용
   - 카드형 레이아웃, 상태 배지, 매핑 테이블 등

### 백엔드 (Node.js/Express)
1. **데이터베이스 스키마** (`schemas.sql`)
   - `company_interfaces`: 회사별 인터페이스 정보 저장
   - `interface_history`: 변경 이력 관리
   - `standard_batch_services`: 생성된 배치 서비스 관리

2. **API 엔드포인트** (`routes/interfaceAutomation.ts`)
   - `GET /api/interface-automation/interfaces`: 인터페이스 목록 조회
   - `GET /api/interface-automation/interfaces/:id`: 상세 조회
   - `POST /api/interface-automation/analyze`: API URL 분석
   - `POST /api/interface-automation/save`: 인터페이스 저장
   - `PUT /api/interface-automation/interfaces/:id`: 수정
   - `DELETE /api/interface-automation/interfaces/:id`: 삭제
   - `GET /api/interface-automation/history`: 변경 이력 조회
   - `GET /api/interface-automation/batch-services`: 배치 서비스 목록
   - `POST /api/interface-automation/generate-batch-service/:interfaceId`: 배치 서비스 코드 생성

3. **주요 기능**
   - API 구조 자동 분석 및 필드 추출
   - 다양한 인증 방식 처리
   - 자동 필드 매핑 알고리즘
   - Spring Batch 코드 자동 생성
   - 트랜잭션 처리 및 이력 관리

### 배치 서비스 자동 생성
- 회사명 기반 서비스명: `StandardBatchService_회사명`
- Spring Batch Job/Step 자동 생성
- Reader/Processor/Writer 패턴 적용
- 필드 매핑 코드 자동 생성
- 인증 헤더 설정 자동 구성

---

## 6. 설치 및 실행

### 패키지 설치
```bash
# 서버 패키지 설치
cd server
npm install

# 클라이언트 패키지 설치
cd ../web
npm install
```

### 데이터베이스 설정
```bash
# PostgreSQL에서 스키마 실행
psql -U postgres -d ear_db -f server/schemas.sql
```

### 실행
```bash
# 전체 실행 (Windows)
start.bat

# 전체 실행 (Linux/Mac)
./start.sh
```

---

## 7. 사용 방법

### 인터페이스 생성
1. 메뉴에서 "인터페이스 연동 자동화" 클릭
2. "인터페이스 생성" 탭 선택
3. API URL 입력
4. 인증 방식 선택 및 인증 정보 입력
5. "API 분석 및 매핑" 버튼 클릭
6. 자동 생성된 매핑 확인 및 수정
7. "인터페이스 저장" 버튼으로 저장

### 인터페이스 관리
1. "인터페이스 관리" 탭에서 등록된 인터페이스 확인
2. 각 인터페이스의 상태 (active/inactive/error) 확인
3. "상세보기" 버튼으로 상세 정보 조회
4. "설정" 버튼으로 수정/삭제 가능

### 변경 이력 조회
1. "변경 이력" 탭에서 모든 변경 내역 확인
2. 생성/수정/삭제 이력 필터링
3. 변경 전/후 비교 기능 제공

---

## 8. 기술 스택

### Frontend
- React 18
- TypeScript
- React Router
- Lucide React (아이콘)
- CSS3 (반응형 디자인)

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- JWT 인증
- Axios (HTTP 클라이언트)

### 생성되는 배치 서비스
- Spring Batch
- Spring Boot
- RestTemplate
- Jackson (JSON 처리)

---

## 9. 테스트용 API 서버

인터페이스 연동 자동화 기능을 테스트하기 위한 샘플 API 서버 2개를 제공합니다.

### 테스트 API 실행

```bash
# 테스트 API 서버들 실행
cd server/test-apis
npm install
npm start
```

### 테스트용 API 정보

#### 🏢 Company 1 API (Bearer Token 방식)
- **URL**: `http://localhost:3001/api/employees`
- **인증 방식**: Bearer Token
- **테스트 토큰**: `test-token-company1-2024`
- **특징**: 
  - 표준적인 사원정보 API 구조
  - 필드명: `emp_id`, `full_name`, `dept_name`, `position_name` 등
  - 페이지네이션 지원
  - 부서/상태 필터링 지원

#### 🏢 Company 2 API (Basic Auth 방식)
- **URL**: `http://localhost:3002/api/staff`
- **인증 방식**: Basic Authentication
- **사용자명**: `company2`
- **비밀번호**: `test123`
- **특징**:
  - 다른 구조의 사원정보 API
  - 필드명: `employee_number`, `name`, `department`, `role` 등
  - 검색 기능 포함
  - 중첩 객체 구조 (`personal_info`)

### 테스트 시나리오

1. **Company 1 API 테스트**:
   ```
   URL: http://localhost:3001/api/employees
   인증 방식: Bearer Token
   토큰: test-token-company1-2024
   ```

2. **Company 2 API 테스트**:
   ```
   URL: http://localhost:3002/api/staff
   인증 방식: Basic Auth
   사용자명: company2
   비밀번호: test123
   ```

### 예상 매핑 결과

#### Company 1 → 표준 필드 매핑
- `emp_id` → `employeeId`
- `full_name` → `name`
- `dept_name` → `department`
- `position_name` → `position`
- `email_address` → `email`
- `mobile_phone` → `phone`
- `hire_date` → `hireDate`
- `work_status` → `status`

#### Company 2 → 표준 필드 매핑
- `employee_number` → `employeeId`
- `name` → `name`
- `department` → `department`
- `role` → `position`
- `email` → `email`
- `phone` → `phone`
- `start_date` → `hireDate`
- `employment_status` → `status`

## 시스템 개선요청 사항 접수 기능
"시스템개선요청" 메뉴 추가 및 기능구현
시스템개선요청 화면에는 "요청제목", "요청내용", "첨부파일" 입력받을수 있어야함
"요청내용" 편집기 기능이 있어 클립보드의 이미지 등을 붙여넣을 수 있어야 함
관리자는 
"시스템개선요청 관리" 화면에는 사용자가 요청한 모든 요청을 볼수 있어야하며, 
리스트에는 페이징 처리가 되어 있어야함


## 기존 로그인 기능 수정
### 지시사항 
기존 로그인 기능을 SAP IAS 와 연동되어 작동되도록 수정
권한은 XSUAA 기능 활용 되어야함 
새롭게 만들어져야 하는 서비스 가 있다면 생성절차 나 연동절차 자세히 알려줘 ex : XSUAA 등 

## 참고사항 
SAP IAS 는 이미 만들어진 IAS 에 연동되어야 하고, 
XSUAA 새롭게 만들어야 하는 상황
subaccount 정보 
내가 만든 react application 와 IAS 가 설정된 subaccount는 서로 다름

### XSUAA 에서 정의되어야 할 권한
EAR-ADMIN   -- 관리자 권한(현재 활용중)
EAR-USER    -- 일반사용자 권한(현재 활용중)
EAR-5TIER   -- 지금은 사용되지 않으나 이후에 사용예정이라 미리 만들어둔 권한
EAR-5TIER-ETC -- 지금은 사용되지 않으나 이후에 사용예정이라 미리 만들어둔 권한
