# 데이터베이스 마이그레이션 가이드

## 2025-10-22: 사용자별 채팅 히스토리 분리

### 개요
채팅 히스토리를 사용자별로 구분하여 저장하고 조회하도록 시스템이 업그레이드되었습니다.

### 변경 사항
- `chat_history` 테이블에 `user_id` 컬럼 추가
- 모든 채팅 관련 API에 인증 미들웨어 적용
- 사용자별 세션 목록 및 히스토리 조회

### 기존 데이터베이스 업그레이드 방법

#### PostgreSQL

```bash
# PostgreSQL 데이터베이스에 연결
psql -h localhost -U postgres -d ragdb

# 마이그레이션 SQL 실행
\i server/migrations/add_user_id_to_chat_history.sql

# 또는 수동으로 실행:
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id);
```

#### HANA DB

```bash
# HANA DB 클라이언트로 연결 후 실행

ALTER TABLE EAR.chat_history ADD (USER_ID NVARCHAR(100));
CREATE INDEX idx_chat_user_id ON EAR.chat_history(USER_ID);
```

### 기존 데이터 처리

기존에 저장된 채팅 히스토리는 `user_id`가 NULL로 남아있습니다. 
필요한 경우 아래 쿼리로 특정 사용자에게 할당할 수 있습니다:

#### PostgreSQL
```sql
-- 모든 기존 데이터를 특정 사용자에게 할당 (예: admin)
UPDATE chat_history SET user_id = 'admin' WHERE user_id IS NULL;

-- 또는 세션별로 다른 사용자에게 할당
UPDATE chat_history 
SET user_id = 'user1' 
WHERE session_id = 'session_xxxxx' AND user_id IS NULL;
```

#### HANA DB
```sql
-- 모든 기존 데이터를 특정 사용자에게 할당 (예: admin)
UPDATE EAR.chat_history SET USER_ID = 'admin' WHERE USER_ID IS NULL;

-- 또는 세션별로 다른 사용자에게 할당
UPDATE EAR.chat_history 
SET USER_ID = 'user1' 
WHERE SESSION_ID = 'session_xxxxx' AND USER_ID IS NULL;
```

### 테스트

마이그레이션 후 다음 사항을 확인하세요:

1. 로그인 후 채팅 가능 여부
2. 새 채팅 메시지가 올바른 user_id로 저장되는지
3. 사용자별로 세션 목록이 분리되는지
4. 세션 삭제가 올바르게 동작하는지

### 롤백

문제가 발생한 경우 아래 명령으로 롤백할 수 있습니다:

#### PostgreSQL
```sql
DROP INDEX IF EXISTS idx_chat_user_id;
ALTER TABLE chat_history DROP COLUMN IF EXISTS user_id;
```

#### HANA DB
```sql
DROP INDEX idx_chat_user_id;
ALTER TABLE EAR.chat_history DROP (USER_ID);
```

단, 롤백 시 코드도 이전 버전으로 복원해야 합니다.



