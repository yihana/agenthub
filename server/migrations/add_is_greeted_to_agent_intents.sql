-- PostgreSQL: agent_intents 테이블에 is_greeted 컬럼 추가
ALTER TABLE agent_intents 
ADD COLUMN IF NOT EXISTS is_greeted BOOLEAN DEFAULT false;

-- 기존 데이터는 모두 false로 설정 (인사 안된 것으로 간주)
UPDATE agent_intents 
SET is_greeted = false 
WHERE is_greeted IS NULL;

