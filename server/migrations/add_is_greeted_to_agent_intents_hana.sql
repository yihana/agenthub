-- HANA: agent_intents 테이블에 IS_GREETED 컬럼 추가
ALTER TABLE EAR.agent_intents 
ADD (IS_GREETED BOOLEAN DEFAULT false);

-- 기존 데이터는 모두 false로 설정 (인사 안된 것으로 간주)
UPDATE EAR.agent_intents 
SET IS_GREETED = false 
WHERE IS_GREETED IS NULL;

