const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'your_password', // 실제 비밀번호로 변경하세요
  database: 'ragdb',
});

async function fixDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('데이터베이스 수정 시작...');
    
    // 기존 테이블 삭제
    console.log('기존 EAR 테이블 삭제 중...');
    await client.query('DROP TABLE IF EXISTS ear_requests CASCADE;');
    await client.query('DROP TABLE IF EXISTS ear_request_templates CASCADE;');
    await client.query('DROP TABLE IF EXISTS ear_keywords CASCADE;');
    
    // 테이블 재생성
    console.log('테이블 재생성 중...');
    await client.query(`
      CREATE TABLE ear_keywords (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE ear_request_templates (
        id SERIAL PRIMARY KEY,
        keyword_id INTEGER REFERENCES ear_keywords(id) ON DELETE CASCADE,
        template_name VARCHAR(200) NOT NULL,
        template_description TEXT,
        required_fields JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(keyword_id, template_name)
      );
    `);
    
    await client.query(`
      CREATE TABLE ear_requests (
        id SERIAL PRIMARY KEY,
        request_title VARCHAR(500) NOT NULL,
        request_content TEXT NOT NULL,
        template_id INTEGER REFERENCES ear_request_templates(id),
        form_data JSONB,
        attachments JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 인덱스 생성
    console.log('인덱스 생성 중...');
    await client.query('CREATE INDEX idx_ear_keywords_keyword ON ear_keywords(keyword);');
    await client.query('CREATE INDEX idx_ear_keywords_category ON ear_keywords(category);');
    await client.query('CREATE INDEX idx_ear_request_templates_keyword_id ON ear_request_templates(keyword_id);');
    await client.query('CREATE INDEX idx_ear_requests_status ON ear_requests(status);');
    await client.query('CREATE INDEX idx_ear_requests_created_at ON ear_requests(created_at);');
    
    // 초기 키워드 데이터 삽입
    console.log('초기 키워드 데이터 삽입 중...');
    const keywords = [
      ['방화', '방화벽 오픈 신청', '보안'],
      ['방화벽', '방화벽 오픈 신청', '보안'],
      ['firewall', 'Firewall Access Request', '보안'],
      ['fw', 'Firewall Access Request', '보안'],
      ['시스템', '시스템 접근 신청', '인프라'],
      ['서버', '서버 접근 신청', '인프라'],
      ['server', 'Server Access Request', '인프라'],
      ['접근', '시스템 접근 신청', '인프라'],
      ['계정', '계정 생성/변경 신청', '계정관리'],
      ['사용자', '사용자 계정 신청', '계정관리'],
      ['user', 'User Account Request', '계정관리'],
      ['권한', '권한 변경 신청', '계정관리'],
      ['네트워크', '네트워크 설정 신청', '네트워크'],
      ['포트', '포트 오픈 신청', '네트워크'],
      ['vpn', 'VPN 접근 신청', '네트워크'],
      ['vlan', 'VLAN 설정 신청', '네트워크'],
      ['소프트웨어', '소프트웨어 설치 신청', '소프트웨어'],
      ['프로그램', '프로그램 설치 신청', '소프트웨어'],
      ['license', '라이선스 신청', '소프트웨어'],
      ['장비', 'IT 장비 신청', '장비'],
      ['노트북', '노트북 신청', '장비'],
      ['pc', 'PC 신청', '장비'],
      ['모니터', '모니터 신청', '장비']
    ];
    
    for (const [keyword, display_name, category] of keywords) {
      await client.query(
        'INSERT INTO ear_keywords (keyword, display_name, category) VALUES ($1, $2, $3)',
        [keyword, display_name, category]
      );
    }
    
    // 템플릿 데이터 삽입
    console.log('템플릿 데이터 삽입 중...');
    
    // 방화벽 오픈 신청 템플릿 (한글)
    const firewallResult = await client.query('SELECT id FROM ear_keywords WHERE keyword = $1', ['방화']);
    if (firewallResult.rows.length > 0) {
      const keywordId = firewallResult.rows[0].id;
      const requiredFields = [
        { name: 'source_ip', label: '출발지 IP', type: 'text', required: true, placeholder: '예: 192.168.1.100' },
        { name: 'dest_ip', label: '도착지 IP', type: 'text', required: true, placeholder: '예: 10.0.0.50' },
        { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '예: 443' },
        { name: 'protocol', label: 'Protocol', type: 'select', required: true, options: ['TCP', 'UDP', 'ICMP'] },
        { name: 'start_date', label: '오픈일', type: 'date', required: true },
        { name: 'end_date', label: '종료일', type: 'date', required: true },
        { name: 'target_system', label: '대상시스템', type: 'text', required: true, placeholder: '예: 웹서버' },
        { name: 'reason', label: '오픈사유', type: 'text', required: true, placeholder: '방화벽 오픈 사유를 입력하세요' },
        { name: 'service_name', label: '서비스명', type: 'text', required: true, placeholder: '예: HTTPS 서비스' }
      ];
      
      await client.query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [
        keywordId,
        '방화벽 오픈 신청',
        '네트워크 보안을 위한 방화벽 포트 오픈을 신청합니다. 모든 필수 정보를 정확히 입력해주세요.',
        JSON.stringify(requiredFields)
      ]);
    }
    
    // Firewall Access Request 템플릿 (영문)
    const firewallEnResult = await client.query('SELECT id FROM ear_keywords WHERE keyword = $1', ['firewall']);
    if (firewallEnResult.rows.length > 0) {
      const keywordId = firewallEnResult.rows[0].id;
      const requiredFields = [
        { name: 'source_ip', label: 'Source IP', type: 'text', required: true, placeholder: 'e.g. 192.168.1.100' },
        { name: 'dest_ip', label: 'Destination IP', type: 'text', required: true, placeholder: 'e.g. 10.0.0.50' },
        { name: 'port', label: 'Port', type: 'number', required: true, placeholder: 'e.g. 443' },
        { name: 'protocol', label: 'Protocol', type: 'select', required: true, options: ['TCP', 'UDP', 'ICMP'] },
        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
        { name: 'end_date', label: 'End Date', type: 'date', required: true },
        { name: 'target_system', label: 'Target System', type: 'text', required: true, placeholder: 'e.g. Web Server' },
        { name: 'reason', label: 'Reason for Access', type: 'text', required: true, placeholder: 'Please provide reason for firewall access' },
        { name: 'service_name', label: 'Service Name', type: 'text', required: true, placeholder: 'e.g. HTTPS Service' }
      ];
      
      await client.query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [
        keywordId,
        'Firewall Access Request',
        'Request for firewall port opening for network security. Please provide all required information accurately.',
        JSON.stringify(requiredFields)
      ]);
    }
    
    // 시스템 접근 신청 템플릿
    const systemResult = await client.query('SELECT id FROM ear_keywords WHERE keyword = $1', ['시스템']);
    if (systemResult.rows.length > 0) {
      const keywordId = systemResult.rows[0].id;
      const requiredFields = [
        { name: 'target_system', label: '대상 시스템', type: 'text', required: true, placeholder: '예: 개발서버, 운영서버' },
        { name: 'access_type', label: '접근 유형', type: 'select', required: true, options: ['SSH', 'RDP', 'VPN', '웹콘솔'] },
        { name: 'access_period', label: '접근 기간', type: 'select', required: true, options: ['1일', '1주일', '1개월', '영구'] },
        { name: 'access_reason', label: '접근 사유', type: 'text', required: true, placeholder: '시스템 접근이 필요한 업무 사유' },
        { name: 'requested_by', label: '신청자', type: 'text', required: true, placeholder: '신청자 이름' },
        { name: 'department', label: '부서', type: 'text', required: true, placeholder: '예: IT팀, 개발팀' }
      ];
      
      await client.query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [
        keywordId,
        '시스템 접근 신청',
        '시스템에 대한 접근 권한을 신청합니다. 보안을 위해 필요한 최소한의 권한만 요청해주세요.',
        JSON.stringify(requiredFields)
      ]);
    }
    
    // 계정 생성/변경 신청 템플릿
    const accountResult = await client.query('SELECT id FROM ear_keywords WHERE keyword = $1', ['계정']);
    if (accountResult.rows.length > 0) {
      const keywordId = accountResult.rows[0].id;
      const requiredFields = [
        { name: 'request_type', label: '신청 유형', type: 'select', required: true, options: ['계정 생성', '계정 변경', '권한 추가', '계정 삭제'] },
        { name: 'user_name', label: '사용자명', type: 'text', required: true, placeholder: '예: john.doe' },
        { name: 'full_name', label: '성명', type: 'text', required: true, placeholder: '예: 홍길동' },
        { name: 'email', label: '이메일', type: 'email', required: true, placeholder: '예: john.doe@company.com' },
        { name: 'department', label: '부서', type: 'text', required: true, placeholder: '예: IT팀' },
        { name: 'roles', label: '권한', type: 'select', required: true, options: ['일반사용자', '관리자', '개발자', '운영자'] },
        { name: 'request_reason', label: '신청 사유', type: 'text', required: true, placeholder: '계정 신청 사유' }
      ];
      
      await client.query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [
        keywordId,
        '계정 생성/변경 신청',
        '사용자 계정 생성 또는 변경을 신청합니다. 사용자의 업무 역할에 맞는 적절한 권한을 설정해주세요.',
        JSON.stringify(requiredFields)
      ]);
    }
    
    // IT 장비 신청 템플릿
    const equipmentResult = await client.query('SELECT id FROM ear_keywords WHERE keyword = $1', ['장비']);
    if (equipmentResult.rows.length > 0) {
      const keywordId = equipmentResult.rows[0].id;
      const requiredFields = [
        { name: 'equipment_type', label: '장비 유형', type: 'select', required: true, options: ['노트북', '데스크톱', '모니터', '키보드', '마우스', '프린터'] },
        { name: 'quantity', label: '수량', type: 'number', required: true, placeholder: '예: 1' },
        { name: 'specification', label: '사양 요구사항', type: 'text', required: false, placeholder: '특별한 사양 요구사항이 있다면 입력' },
        { name: 'business_justification', label: '업무적 필요성', type: 'text', required: true, placeholder: '장비가 필요한 업무적 사유' },
        { name: 'requested_by', label: '신청자', type: 'text', required: true, placeholder: '신청자 이름' },
        { name: 'department', label: '부서', type: 'text', required: true, placeholder: '예: IT팀' },
        { name: 'budget_approval', label: '예산 승인', type: 'select', required: true, options: ['승인됨', '승인 대기', '미승인'] }
      ];
      
      await client.query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [
        keywordId,
        'IT 장비 신청',
        'IT 장비 구매 및 배치를 신청합니다. 예산 승인을 받은 후 장비를 주문하고 배치합니다.',
        JSON.stringify(requiredFields)
      ]);
    }
    
    console.log('✅ 데이터베이스 수정 완료!');
    console.log(`✅ 키워드 ${keywords.length}개 삽입 완료`);
    console.log('✅ 템플릿 5개 삽입 완료');
    
  } catch (error) {
    console.error('❌ 데이터베이스 수정 오류:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixDatabase();
