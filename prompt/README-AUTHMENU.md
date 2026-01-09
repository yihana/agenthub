## 사용자가 로그인 할때 사용자에게 할당된 권한별 접근가능 메뉴 매핑하는 기능 추가해줘

추가메뉴명은 "사용자그룹별 메뉴매핑" 으로 생성하되 "시스템 관리" 메뉴 하위에 표시되어야해
권한 기준은 XSUAA 토큰값중 samlGroup 을 참조해야해

samlGroups 명은 아래 3가지만 참조할 것이고 나머지 항목은 무시하면 돼
EAR-ADMIN 
EAR-USER
EAR-5TIER 

## 참고 : 로그인시 XSUAA 토큰값 관련 로그
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT XSUAA 토큰 정보 (JWT 직접 파싱): {
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT userid: '123@email.com',
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT email: '123@email.com',
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT scopes: [ 'openid' ],
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT samlGroups: [ 'EAR-ADMIN', 'EAR-5TIER-ETC', 'EAR-USER', 'EAR-5TIER' ],
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT hasAdminScope: true,
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT hasUserScope: false,
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT isAdmin: true
   2025-12-09T14:05:57.17+0900 [APP/PROC/WEB/0] OUT }

아래 그룹리스트별 접근가능메뉴 설정하는 기능 만들어줘
EAR-ADMIN 
EAR-USER
EAR-5TIER 


