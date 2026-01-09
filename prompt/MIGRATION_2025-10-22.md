# 채팅 히스토리 사용자별 분리 업데이트

## 날짜: 2025-10-22

## 업데이트 내용

채팅 히스토리와 채팅 화면이 로그인한 사용자 ID 기준으로 저장되고 표시되도록 시스템이 업데이트되었습니다.

## 주요 변경사항

### 1. 백엔드 변경

#### 1.1 데이터베이스 스키마
- `chat_history` 테이블에 `user_id` 컬럼 추가
- `user_id`에 대한 인덱스 생성

#### 1.2 인증 미들웨어
- 새로운 인증 미들웨어 추가: `server/middleware/auth.ts`
- JWT 토큰에서 사용자 정보 추출
- 모든 채팅 API에 인증 적용

#### 1.3 API 변경
- `/api/chat/` - POST: 채팅 메시지 저장 시 user_id 포함
- `/api/chat/stream` - POST: 스트리밍 채팅 시 user_id 포함
- `/api/chat/sessions` - GET: 사용자별 세션 목록 조회
- `/api/chat/history/:sessionId` - GET: 사용자별 채팅 히스토리 조회
- `/api/chat/session/:sessionId` - DELETE: 사용자별 세션 삭제

### 2. 프론트엔드 변경

#### 2.1 API 호출 시 인증 토큰 포함
- `ChatPane.tsx`: 채팅 메시지 전송 및 히스토리 로드 시 Authorization 헤더 포함
- `HistoryPane.tsx`: 세션 목록 조회 및 세션 삭제 시 Authorization 헤더 포함

## 배포 절차

### 1단계: 데이터베이스 마이그레이션

기존 데이터베이스를 사용 중인 경우 다음 SQL을 실행하세요:

**PostgreSQL:**
```bash
psql -h localhost -U postgres -d ragdb -f server/migrations/add_user_id_to_chat_history.sql
```

**HANA DB:**
```sql
ALTER TABLE EAR.chat_history ADD (USER_ID NVARCHAR(100));
CREATE INDEX idx_chat_user_id ON EAR.chat_history(USER_ID);
```

### 2단계: 애플리케이션 재시작

```bash
# 서버 중지
# (Ctrl+C 또는 해당 프로세스 종료)

# 의존성 확인
npm install

# 서버 시작
npm run dev
# 또는 프로덕션 환경:
npm start
```

### 3단계: 테스트

1. 관리자 계정으로 로그인 (admin / admin123)
2. 새 채팅 메시지 전송
3. 채팅 히스토리가 올바르게 표시되는지 확인
4. 다른 사용자 계정으로 로그인하여 분리된 히스토리 확인
5. 세션 삭제 테스트

## 주의사항

### 기존 데이터 처리

- 기존 채팅 데이터는 `user_id`가 NULL로 남아있습니다
- 이 데이터는 어느 사용자에게도 표시되지 않습니다
- 필요한 경우 수동으로 user_id를 할당해야 합니다:

```sql
-- PostgreSQL
UPDATE chat_history SET user_id = 'admin' WHERE user_id IS NULL;

-- HANA DB
UPDATE EAR.chat_history SET USER_ID = 'admin' WHERE USER_ID IS NULL;
```

### 인증 필요

- 이제 모든 채팅 API는 JWT 토큰 인증이 필요합니다
- 로그인하지 않으면 채팅을 사용할 수 없습니다
- 토큰이 만료되면 다시 로그인해야 합니다

## 롤백 방법

문제가 발생한 경우:

1. Git에서 이전 커밋으로 복원
2. 데이터베이스 롤백:

```sql
-- PostgreSQL
DROP INDEX IF EXISTS idx_chat_user_id;
ALTER TABLE chat_history DROP COLUMN IF EXISTS user_id;

-- HANA DB
DROP INDEX idx_chat_user_id;
ALTER TABLE EAR.chat_history DROP (USER_ID);
```

3. 애플리케이션 재시작

## 문의

문제가 발생하거나 질문이 있는 경우 개발팀에 문의하세요.



