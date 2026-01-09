-- 채팅 히스토리 테이블에 intent_options 컬럼 추가
-- HANA DB용
ALTER TABLE EAR.chat_history ADD (INTENT_OPTIONS NCLOB);

