-- 채팅 의도 패턴 초기 데이터 (PostgreSQL용)
-- 사용법: psql -U postgres -d your_database -f server/init-chat-intent-data.sql
-- 
-- 주의: 이 파일은 PostgreSQL 전용입니다.
-- HANA DB를 사용하는 경우: server/init-chat-intent-data-hana.sql 파일을 사용하세요.

-- 기존 데이터 삭제 (선택사항)
-- DELETE FROM chat_intent_options;
-- DELETE FROM chat_intent_patterns;

-- 1. SAP 로그인 문제 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', 'SAP 로그인,로그인 안돼,로그인 실패,계정 잠금,계정 잠김,로그인 안됨,로그인이 안돼,접속 안됨', 
        '계정이 잠겼을 수 있습니다. 계정 잠금 해제 요청을 진행하시겠습니까?', 
        'account_lock', true, 10)
ON CONFLICT DO NOTHING;

-- 계정 잠금 해제 요청 선택지
INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '계정 잠금 해제 요청', 'SAP 계정 잠금 해제를 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'Lock', 1
FROM chat_intent_patterns 
WHERE intent_category = 'account_lock' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 계정 정보 확인 선택지
INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '계정 정보 확인', '계정 상태를 확인합니다', 'navigate', 
       '{"route": "/user-management"}'::jsonb, 'User', 2
FROM chat_intent_patterns 
WHERE intent_category = 'account_lock' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 2. 비밀번호 변경 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', '비밀번호 변경,패스워드 변경,비밀번호 바꾸기,비밀번호 재설정,비밀번호 초기화,패스워드 재설정', 
        '비밀번호 변경이 필요하신가요? 비밀번호 변경 요청을 진행하시겠습니까?', 
        'password_change', true, 9)
ON CONFLICT DO NOTHING;

INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '비밀번호 변경 요청', '비밀번호 변경을 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'Lock', 1
FROM chat_intent_patterns 
WHERE intent_category = 'password_change' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. 시스템 접근 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', '시스템 접근,시스템 권한,접근 권한,시스템 사용,시스템 사용권한,시스템 접속,시스템 로그인', 
        '시스템 접근 권한이 필요하신가요? 시스템 접근 신청을 진행하시겠습니까?', 
        'system_access', true, 8)
ON CONFLICT DO NOTHING;

INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '시스템 접근 신청', '시스템 접근 권한을 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'Shield', 1
FROM chat_intent_patterns 
WHERE intent_category = 'system_access' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 4. 방화벽 오픈 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', '방화벽 오픈,방화벽 신청,포트 오픈,포트 개방,방화벽 허용,네트워크 접근', 
        '방화벽 오픈가 필요하신가요? 방화벽 오픈 신청을 진행하시겠습니까?', 
        'firewall_open', true, 7)
ON CONFLICT DO NOTHING;

INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '방화벽 오픈 신청', '방화벽 포트 오픈을 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'Shield', 1
FROM chat_intent_patterns 
WHERE intent_category = 'firewall_open' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 5. IT 장비 신청 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', '장비 신청,IT 장비,노트북 신청,PC 신청,모니터 신청,장비 구매', 
        'IT 장비 신청이 필요하신가요? IT 장비 신청을 진행하시겠습니까?', 
        'equipment_request', true, 6)
ON CONFLICT DO NOTHING;

INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, 'IT 장비 신청', 'IT 장비 신청을 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'FileText', 1
FROM chat_intent_patterns 
WHERE intent_category = 'equipment_request' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. 계정 생성 패턴
INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
VALUES ('keyword', '계정 생성,계정 만들기,새 계정,사용자 계정 생성,계정 신청', 
        '새로운 계정이 필요하신가요? 계정 생성 요청을 진행하시겠습니까?', 
        'account_create', true, 5)
ON CONFLICT DO NOTHING;

INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
SELECT id, '계정 생성 요청', '새로운 계정 생성을 위한 EAR 요청을 등록합니다', 'ear_request', 
       '{"keyword_id": null, "template_id": null}'::jsonb, 'User', 1
FROM chat_intent_patterns 
WHERE intent_category = 'account_create' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- 확인 쿼리
SELECT 
  p.id,
  p.intent_category,
  p.pattern_value,
  p.response_message,
  p.priority,
  COUNT(o.id) as option_count
FROM chat_intent_patterns p
LEFT JOIN chat_intent_options o ON p.id = o.intent_pattern_id
GROUP BY p.id, p.intent_category, p.pattern_value, p.response_message, p.priority
ORDER BY p.priority DESC;

