-- chat_intent_patterns 테이블에 display_type 컬럼 추가
-- PostgreSQL용
ALTER TABLE chat_intent_patterns 
ADD COLUMN IF NOT EXISTS display_type VARCHAR(20) DEFAULT 'inline';

-- 기존 레코드 업데이트: 기존 동작 유지 (firewall_open과 application_improvement는 inline, 나머지는 modal)
-- 새 레코드는 기본값 'inline' 사용
UPDATE chat_intent_patterns 
SET display_type = CASE 
  WHEN intent_category = 'firewall_open' OR intent_category = 'application_improvement' THEN 'inline'
  ELSE 'modal'
END
WHERE display_type = 'inline' 
  AND intent_category IS NOT NULL 
  AND intent_category != 'firewall_open' 
  AND intent_category != 'application_improvement';

