-- 채팅 히스토리 테이블에 intent_options 컬럼 추가
-- PostgreSQL용
ALTER TABLE chat_history 
ADD COLUMN IF NOT EXISTS intent_options JSONB;

-- HANA DB용 (별도로 실행 필요)
-- ALTER TABLE EAR.chat_history ADD (INTENT_OPTIONS NCLOB);

