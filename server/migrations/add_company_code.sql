-- chat_intent_patterns 테이블에 company_code 컬럼 추가
-- PostgreSQL용
ALTER TABLE chat_intent_patterns 
ADD COLUMN IF NOT EXISTS company_code VARCHAR(10) DEFAULT 'SKN';

-- users 테이블에 company_code 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS company_code VARCHAR(10) DEFAULT 'SKN';

-- 기존 레코드 업데이트: 모든 기존 레코드를 SKN으로 설정
UPDATE chat_intent_patterns 
SET company_code = 'SKN'
WHERE company_code IS NULL;

UPDATE users 
SET company_code = 'SKN'
WHERE company_code IS NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_intent_patterns_company_code ON chat_intent_patterns(company_code);
CREATE INDEX IF NOT EXISTS idx_users_company_code ON users(company_code);

