-- chat_intent_patterns 테이블에 display_type 컬럼 추가
-- HANA DB용
ALTER TABLE EAR.chat_intent_patterns ADD (DISPLAY_TYPE NVARCHAR(20) DEFAULT 'inline');

-- 기존 레코드 업데이트: 기존 동작 유지 (firewall_open과 application_improvement는 inline, 나머지는 modal)
-- 새 레코드는 기본값 'inline' 사용
UPDATE EAR.chat_intent_patterns 
SET DISPLAY_TYPE = CASE 
  WHEN INTENT_CATEGORY = 'firewall_open' OR INTENT_CATEGORY = 'application_improvement' THEN 'inline'
  ELSE 'modal'
END
WHERE DISPLAY_TYPE = 'inline' 
  AND INTENT_CATEGORY IS NOT NULL 
  AND INTENT_CATEGORY != 'firewall_open' 
  AND INTENT_CATEGORY != 'application_improvement';

