/**
 * 채팅 의도 패턴 초기 데이터 설정 스크립트
 * 
 * 사용법:
 * node server/init-chat-intent-data.js
 * 
 * 환경 변수:
 * - DB_TYPE: 'postgres' 또는 'hana' (기본값: 'postgres')
 */

const dotenv = require('dotenv');
dotenv.config();

const DB_TYPE = process.env.DB_TYPE || 'postgres';

let queryFn;
let pool;

// 데이터베이스 연결 설정
async function setupDatabase() {
  if (DB_TYPE === 'postgres') {
    const { Pool } = require('pg');
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_DATABASE || process.env.DB_NAME || 'ragdb',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
    
    queryFn = async (text, params) => {
      const result = await pool.query(text, params);
      return result;
    };
  } else if (DB_TYPE === 'hana') {
    // HANA는 db.ts를 통해 연결
    const { query } = require('./db');
    queryFn = query;
  } else {
    throw new Error(`지원하지 않는 데이터베이스 타입: ${DB_TYPE}`);
  }
}

async function initChatIntentData() {
  await setupDatabase();
  
  try {
    console.log(`채팅 의도 패턴 초기 데이터 설정 시작... (DB: ${DB_TYPE})`);

    // 패턴 삽입 헬퍼 함수
    async function insertPattern(patternData) {
      let insertQuery;
      let selectQuery;
      
      if (DB_TYPE === 'postgres') {
        insertQuery = `
          INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
          RETURNING id
        `;
        selectQuery = `
          SELECT id FROM chat_intent_patterns 
          WHERE intent_category = $1 
          LIMIT 1
        `;
      } else {
        insertQuery = `
          INSERT INTO EAR.chat_intent_patterns (PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        selectQuery = `
          SELECT TOP 1 ID as id FROM EAR.chat_intent_patterns 
          WHERE INTENT_CATEGORY = ?
        `;
      }
      
      const params = [
        patternData.pattern_type,
        patternData.pattern_value,
        patternData.response_message,
        patternData.intent_category,
        patternData.is_active,
        patternData.priority
      ];
      
      let result;
      if (DB_TYPE === 'postgres') {
        result = await queryFn(insertQuery, params);
        if (result.rows.length > 0) {
          return result.rows[0].id;
        }
      } else {
        await queryFn(insertQuery, params);
      }
      
      // 기존 패턴 조회
      const existing = await queryFn(selectQuery, [patternData.intent_category]);
      return (existing.rows || existing)[0]?.id;
    }

    // 선택지 삽입 헬퍼 함수
    async function insertOption(patternId, optionData) {
      let insertQuery;
      
      if (DB_TYPE === 'postgres') {
        insertQuery = `
          INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
          ON CONFLICT DO NOTHING
        `;
      } else {
        insertQuery = `
          INSERT INTO EAR.chat_intent_options (INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
      }
      
      const actionDataJson = typeof optionData.action_data === 'string' 
        ? optionData.action_data 
        : JSON.stringify(optionData.action_data);
      
      const params = [
        patternId,
        optionData.option_title,
        optionData.option_description || null,
        optionData.action_type,
        actionDataJson,
        optionData.icon_name || null,
        optionData.display_order
      ];
      
      await queryFn(insertQuery, params);
    }

    // 1. SAP 로그인 문제 패턴
    const sapLoginPatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: 'SAP 로그인,로그인 안돼,로그인 실패,계정 잠금,계정 잠김,로그인 안됨,로그인이 안돼,접속 안됨',
      response_message: '계정이 잠겼을 수 있습니다. 계정 잠금 해제 요청을 진행하시겠습니까?',
      intent_category: 'account_lock',
      is_active: true,
      priority: 10
    });

    if (sapLoginPatternId) {
      await insertOption(sapLoginPatternId, {
        option_title: '계정 잠금 해제 요청',
        option_description: 'SAP 계정 잠금 해제를 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'Lock',
        display_order: 1
      });

      await insertOption(sapLoginPatternId, {
        option_title: '계정 정보 확인',
        option_description: '계정 상태를 확인합니다',
        action_type: 'navigate',
        action_data: { route: '/user-management' },
        icon_name: 'User',
        display_order: 2
      });
    }

    // 2. 비밀번호 변경 패턴
    const passwordChangePatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: '비밀번호 변경,패스워드 변경,비밀번호 바꾸기,비밀번호 재설정,비밀번호 초기화,패스워드 재설정',
      response_message: '비밀번호 변경이 필요하신가요? 비밀번호 변경 요청을 진행하시겠습니까?',
      intent_category: 'password_change',
      is_active: true,
      priority: 9
    });

    if (passwordChangePatternId) {
      await insertOption(passwordChangePatternId, {
        option_title: '비밀번호 변경 요청',
        option_description: '비밀번호 변경을 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'Lock',
        display_order: 1
      });
    }

    // 3. 시스템 접근 패턴
    const systemAccessPatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: '시스템 접근,시스템 권한,접근 권한,시스템 사용,시스템 사용권한,시스템 접속,시스템 로그인',
      response_message: '시스템 접근 권한이 필요하신가요? 시스템 접근 신청을 진행하시겠습니까?',
      intent_category: 'system_access',
      is_active: true,
      priority: 8
    });

    if (systemAccessPatternId) {
      await insertOption(systemAccessPatternId, {
        option_title: '시스템 접근 신청',
        option_description: '시스템 접근 권한을 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'Shield',
        display_order: 1
      });
    }

    // 4. 방화벽 오픈 패턴
    const firewallPatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: '방화벽 오픈,방화벽 신청,포트 오픈,포트 개방,방화벽 허용,네트워크 접근',
      response_message: '방화벽 오픈가 필요하신가요? 방화벽 오픈 신청을 진행하시겠습니까?',
      intent_category: 'firewall_open',
      is_active: true,
      priority: 7
    });

    if (firewallPatternId) {
      await insertOption(firewallPatternId, {
        option_title: '방화벽 오픈 신청',
        option_description: '방화벽 포트 오픈을 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'Shield',
        display_order: 1
      });
    }

    // 5. IT 장비 신청 패턴
    const equipmentPatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: '장비 신청,IT 장비,노트북 신청,PC 신청,모니터 신청,장비 구매',
      response_message: 'IT 장비 신청이 필요하신가요? IT 장비 신청을 진행하시겠습니까?',
      intent_category: 'equipment_request',
      is_active: true,
      priority: 6
    });

    if (equipmentPatternId) {
      await insertOption(equipmentPatternId, {
        option_title: 'IT 장비 신청',
        option_description: 'IT 장비 신청을 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'FileText',
        display_order: 1
      });
    }

    // 6. 계정 생성 패턴
    const accountCreatePatternId = await insertPattern({
      pattern_type: 'keyword',
      pattern_value: '계정 생성,계정 만들기,새 계정,사용자 계정 생성,계정 신청',
      response_message: '새로운 계정이 필요하신가요? 계정 생성 요청을 진행하시겠습니까?',
      intent_category: 'account_create',
      is_active: true,
      priority: 5
    });

    if (accountCreatePatternId) {
      await insertOption(accountCreatePatternId, {
        option_title: '계정 생성 요청',
        option_description: '새로운 계정 생성을 위한 EAR 요청을 등록합니다',
        action_type: 'ear_request',
        action_data: { keyword_id: null, template_id: null },
        icon_name: 'User',
        display_order: 1
      });
    }

    console.log('✅ 채팅 의도 패턴 초기 데이터 설정 완료!');
    console.log('\n📋 설정된 패턴:');
    console.log('1. SAP 로그인 문제 (account_lock) - 우선순위: 10');
    console.log('2. 비밀번호 변경 (password_change) - 우선순위: 9');
    console.log('3. 시스템 접근 (system_access) - 우선순위: 8');
    console.log('4. 방화벽 오픈 (firewall_open) - 우선순위: 7');
    console.log('5. IT 장비 신청 (equipment_request) - 우선순위: 6');
    console.log('6. 계정 생성 (account_create) - 우선순위: 5');
    console.log('\n💡 테스트 방법:');
    console.log('   채팅창에서 다음 문구를 입력해보세요:');
    console.log('   - "SAP 로그인이 안돼"');
    console.log('   - "비밀번호 변경하고 싶어요"');
    console.log('   - "시스템 접근 권한이 필요해요"');
    console.log('   - "방화벽 오픈 신청하고 싶어요"');
    console.log('   - "IT 장비 신청하려고 해요"');
    console.log('   - "계정 생성하고 싶어요"');
    console.log('\n🔧 관리자 페이지: /chat-intent-management');

  } catch (error) {
    console.error('❌ 초기 데이터 설정 오류:', error);
    throw error;
  } finally {
    if (DB_TYPE === 'postgres' && pool) {
      await pool.end();
    }
  }
}

// 스크립트 실행
initChatIntentData()
  .then(() => {
    console.log('\n초기화 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('초기화 실패:', error);
    process.exit(1);
  });

