-- 채팅 의도 패턴 초기 데이터 (HANA DB용)
-- 사용법: HANA DB Studio 또는 hdbsql에서 실행
-- 주의: 중복 실행 시 에러가 발생할 수 있으므로, 이미 데이터가 있는 경우 스킵하세요.

-- 기존 데이터 삭제 (선택사항 - 필요시 주석 해제)
-- DELETE FROM EAR.chat_intent_options;
-- DELETE FROM EAR.chat_intent_patterns;

-- ============================================
-- 1. SAP 로그인 문제 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword', 
  'SAP 로그인,로그인 안돼,로그인 실패,계정 잠금,계정 잠김,로그인 안됨,로그인이 안돼,접속 안됨',
  '계정이 잠겼을 수 있습니다. 계정 잠금 해제 요청을 진행하시겠습니까?',
  'account_lock', 
  true, 
  10
);

-- 계정 잠금 해제 요청 선택지 (위 패턴의 ID를 확인하여 수동으로 수정 필요)
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '계정 잠금 해제 요청',
  'SAP 계정 잠금 해제를 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'Lock',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'account_lock'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'account_lock');

-- 계정 정보 확인 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '계정 정보 확인',
  '계정 상태를 확인합니다',
  'navigate',
  '{"route": "/user-management"}',
  'User',
  2
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'account_lock'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'account_lock');

-- ============================================
-- 2. 비밀번호 변경 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '비밀번호 변경,패스워드 변경,비밀번호 바꾸기,비밀번호 재설정,비밀번호 초기화,패스워드 재설정',
  '비밀번호 변경이 필요하신가요? 비밀번호 변경 요청을 진행하시겠습니까?',
  'password_change',
  true,
  9
);

-- 비밀번호 변경 요청 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '비밀번호 변경 요청',
  '비밀번호 변경을 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'Lock',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'password_change'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'password_change');

-- ============================================
-- 3. 시스템 접근 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '시스템 접근,시스템 권한,접근 권한,시스템 사용,시스템 사용권한,시스템 접속,시스템 로그인',
  '시스템 접근 권한이 필요하신가요? 시스템 접근 신청을 진행하시겠습니까?',
  'system_access',
  true,
  8
);

-- 시스템 접근 신청 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '시스템 접근 신청',
  '시스템 접근 권한을 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'Shield',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'system_access'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'system_access');

-- ============================================
-- 4. 방화벽 오픈 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '방화벽 오픈,방화벽 신청,포트 오픈,포트 개방,방화벽 허용,네트워크 접근',
  '방화벽 오픈가 필요하신가요? 방화벽 오픈 신청을 진행하시겠습니까?',
  'firewall_open',
  true,
  7
);

-- 방화벽 오픈 신청 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '방화벽 오픈 신청',
  '방화벽 포트 오픈을 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'Shield',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'firewall_open'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'firewall_open');

-- ============================================
-- 5. IT 장비 신청 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '장비 신청,IT 장비,노트북 신청,PC 신청,모니터 신청,장비 구매',
  'IT 장비 신청이 필요하신가요? IT 장비 신청을 진행하시겠습니까?',
  'equipment_request',
  true,
  6
);

-- IT 장비 신청 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  'IT 장비 신청',
  'IT 장비 신청을 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'FileText',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'equipment_request'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'equipment_request');

-- ============================================
-- 6. 계정 생성 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '계정 생성,계정 만들기,새 계정,사용자 계정 생성,계정 신청',
  '새로운 계정이 필요하신가요? 계정 생성 요청을 진행하시겠습니까?',
  'account_create',
  true,
  5
);

-- 계정 생성 요청 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '계정 생성 요청',
  '새로운 계정 생성을 위한 EAR 요청을 등록합니다',
  'ear_request',
  '{"keyword_id": null, "template_id": null}',
  'User',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'account_create'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'account_create');

-- ============================================
-- 7. 시스템 개선 요청 패턴
-- ============================================

-- 패턴 삽입
INSERT INTO EAR.chat_intent_patterns (
  PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY
) VALUES (
  'keyword',
  '기능이 불편해,프로그램 수정이 필요해,작동이 안돼',
  '프로그램이 일시직으로 오류가 발생되었거나, 시스템 개선이 필요할 수 있습니다',
  'application_improvement',
  true,
  4
);

-- 프로그램 상태요청(ESM 등록요청) 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '프로그램 상태요청(ESM 등록요청)',
  '프로그램 상태 확인을 위한 ESM 요청을 등록합니다',
  'esm_request',
  '{"template_id": null}',
  'AlertCircle',
  1
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'application_improvement'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'application_improvement');

-- 프로그램 개선 요청 선택지 (추천)
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '프로그램 개선 요청',
  '시스템 개선을 위한 요청을 진행합니다',
  'improvement_request',
  '{"type": "application_improvement"}',
  'Settings',
  2
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'application_improvement'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'application_improvement');

-- 프로그램 개선 요청 진행상태 확인 선택지
INSERT INTO EAR.chat_intent_options (
  INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER
)
SELECT 
  ID,
  '프로그램 개선 요청 진행상태 확인',
  '진행 중인 개선 요청의 상태를 확인합니다',
  'improvement_status',
  '{"type": "check_status"}',
  'FileText',
  3
FROM EAR.chat_intent_patterns
WHERE INTENT_CATEGORY = 'application_improvement'
  AND ID = (SELECT MAX(ID) FROM EAR.chat_intent_patterns WHERE INTENT_CATEGORY = 'application_improvement');

-- ============================================
-- 확인 쿼리
-- ============================================
-- 주의: HANA DB는 LOB 타입을 GROUP BY에서 사용할 수 없으므로, ID만으로 그룹화합니다
SELECT 
  P.ID as id,
  P.INTENT_CATEGORY as intent_category,
  CAST(P.PATTERN_VALUE AS NVARCHAR(500)) as pattern_value,
  CAST(P.RESPONSE_MESSAGE AS NVARCHAR(500)) as response_message,
  P.PRIORITY as priority,
  COUNT(O.ID) as option_count
FROM EAR.chat_intent_patterns P
LEFT JOIN EAR.chat_intent_options O ON P.ID = O.INTENT_PATTERN_ID
GROUP BY P.ID, P.INTENT_CATEGORY, P.PRIORITY
ORDER BY P.PRIORITY DESC;
