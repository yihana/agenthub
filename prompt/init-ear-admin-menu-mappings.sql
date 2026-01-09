-- ============================================
-- EAR-ADMIN 그룹에 모든 메뉴 매핑 초기 데이터
-- ============================================

-- HANA DB용 쿼리
-- ============================================
INSERT INTO EAR.group_menu_mappings (GROUP_NAME, MENU_ID, IS_ACTIVE, CREATED_BY)
SELECT 
    'EAR-ADMIN' AS GROUP_NAME,
    ID AS MENU_ID,
    true AS IS_ACTIVE,
    'system' AS CREATED_BY
FROM EAR.menus
WHERE IS_ACTIVE = true
  AND NOT EXISTS (
    SELECT 1 
    FROM EAR.group_menu_mappings 
    WHERE GROUP_NAME = 'EAR-ADMIN' 
      AND MENU_ID = EAR.menus.ID
  );

-- ============================================
-- PostgreSQL용 쿼리
-- ============================================
INSERT INTO group_menu_mappings (group_name, menu_id, is_active, created_by)
SELECT 
    'EAR-ADMIN' AS group_name,
    id AS menu_id,
    true AS is_active,
    'system' AS created_by
FROM menus
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM group_menu_mappings 
    WHERE group_name = 'EAR-ADMIN' 
      AND menu_id = menus.id
  );

-- ============================================
-- 실행 전 확인 쿼리 (선택사항)
-- ============================================
-- HANA: SELECT COUNT(*) FROM EAR.menus WHERE IS_ACTIVE = true;
-- PostgreSQL: SELECT COUNT(*) FROM menus WHERE is_active = true;

-- ============================================
-- 실행 후 확인 쿼리
-- ============================================
-- HANA: SELECT COUNT(*) FROM EAR.group_menu_mappings WHERE GROUP_NAME = 'EAR-ADMIN';
-- PostgreSQL: SELECT COUNT(*) FROM group_menu_mappings WHERE group_name = 'EAR-ADMIN';

