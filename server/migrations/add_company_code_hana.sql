-- chat_intent_patterns 테이블에 company_code 컬럼 추가
-- HANA DB용
ALTER TABLE EAR.chat_intent_patterns ADD (COMPANY_CODE NVARCHAR(10) DEFAULT 'SKN');

-- users 테이블에 company_code 컬럼 추가
ALTER TABLE EAR.users ADD (COMPANY_CODE NVARCHAR(10) DEFAULT 'SKN');

-- 기존 레코드 업데이트: 모든 기존 레코드를 SKN으로 설정
UPDATE EAR.chat_intent_patterns 
SET COMPANY_CODE = 'SKN'
WHERE COMPANY_CODE IS NULL;

UPDATE EAR.users 
SET COMPANY_CODE = 'SKN'
WHERE COMPANY_CODE IS NULL;

-- 인덱스 생성
CREATE INDEX idx_chat_intent_patterns_company_code ON EAR.chat_intent_patterns(COMPANY_CODE);
CREATE INDEX idx_users_company_code ON EAR.users(COMPANY_CODE);

