import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const LOCAL_ONLY = process.env.LOCAL_ONLY === 'true';

// PostgreSQL 연결 풀
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || 'fhzjfdlwl88!#',
  database: process.env.DB_DATABASE || 'ragdb',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// 데이터베이스 초기화
export async function initializeDatabase() {
  try {
    console.log('PostgreSQL 데이터베이스 연결 테스트 중...');
    
    const client = await pool.connect();
    console.log('✅ PostgreSQL 연결 성공!');
    
    // pgvector 확장 활성화
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('pgvector 확장 활성화 완료');
    
    // 테이블 생성
    await createTables(client);
    
    // 인덱스 생성
    if (process.env.LOCAL_ONLY === 'true') {
      console.log('LOCAL_ONLY=true: 인덱스 생성 생략');
    } else {
      await createIndexes(client);
    }
    
    // 벡터 인덱스 생성
    await createVectorIndexes(client);
    
    // EAR 초기 데이터
    await initializeEARData(client);
    
    // 기본 관리자 계정
    await createDefaultAdmin(client);
    
    // IP 화이트리스트 초기화
    await initializeIpWhitelist(client);
    
    // 메뉴 초기화
    await initializeMenus(client);

    // 에이전트 샘플 데이터 초기화 (로컬 전용)
    if (LOCAL_ONLY) {
      await seedAgentData(client);
    }
    
    // 입력보안 설정 초기화
    await initializeInputSecurity(client);
    
    // 출력보안 설정 초기화
    await initializeOutputSecurity(client);
    
    client.release();
    console.log('데이터베이스 초기화 완료!');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error);
    throw error;
  }
}

// 테이블 생성
async function createTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000),
      file_type VARCHAR(100),
      file_size BIGINT,
      text_content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES rag_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding vector(3072),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) NOT NULL,
      user_id VARCHAR(100),
      user_message TEXT NOT NULL,
      assistant_response TEXT NOT NULL,
      sources JSONB,
      intent_options JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'inactive',
      env_config JSONB,
      max_concurrency INTEGER DEFAULT 1,
      tags JSONB,
      last_heartbeat TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_roles (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      role_name VARCHAR(100) NOT NULL,
      UNIQUE(agent_id, role_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_metrics (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cpu_usage NUMERIC(5,2),
      memory_usage NUMERIC(5,2),
      requests_processed INTEGER DEFAULT 0,
      avg_latency NUMERIC(10,2),
      error_rate NUMERIC(5,2),
      queue_time NUMERIC(10,2)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      job_id VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      result JSONB
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS job_queue (
      job_id VARCHAR(100) PRIMARY KEY,
      payload JSONB,
      priority INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'queued',
      assigned_agent_id INTEGER REFERENCES agents(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      scheduled_at TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100),
      event_type VARCHAR(100),
      target_id VARCHAR(100),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      details JSONB
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS ear_keywords (
      id SERIAL PRIMARY KEY,
      keyword VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(200) NOT NULL,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS ear_request_templates (
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
    CREATE TABLE IF NOT EXISTS ear_requests (
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
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_intent_patterns (
      id SERIAL PRIMARY KEY,
      pattern_type VARCHAR(20) NOT NULL,
      pattern_value TEXT NOT NULL,
      response_message TEXT NOT NULL,
      intent_category VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 0,
      display_type VARCHAR(20) DEFAULT 'inline',
      company_code VARCHAR(10) DEFAULT 'SKN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_intent_options (
      id SERIAL PRIMARY KEY,
      intent_pattern_id INTEGER REFERENCES chat_intent_patterns(id) ON DELETE CASCADE,
      option_title TEXT NOT NULL,
      option_description TEXT,
      action_type VARCHAR(20) NOT NULL,
      action_data JSONB,
      icon_name VARCHAR(50),
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS improvement_requests (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) NOT NULL,
      chat_history_id INTEGER REFERENCES chat_history(id) ON DELETE CASCADE,
      selected_text TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS improvement_responses (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES improvement_requests(id) ON DELETE CASCADE,
      response_text TEXT NOT NULL,
      responded_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      userid VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      full_name VARCHAR(200),
      department VARCHAR(100),
      position VARCHAR(100),
      phone VARCHAR(50),
      employee_id VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      is_admin BOOLEAN DEFAULT false,
      company_code VARCHAR(10) DEFAULT 'SKN',
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP NULL,
      last_login TIMESTAMP NULL,
      password_reset_token VARCHAR(255) NULL,
      password_reset_expires TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      userid VARCHAR(100) NOT NULL,
      login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45),
      user_agent TEXT,
      login_status VARCHAR(20) NOT NULL,
      failure_reason VARCHAR(100) NULL
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS esm_requests (
      id SERIAL PRIMARY KEY,
      request_title VARCHAR(500) NOT NULL,
      request_content TEXT NOT NULL,
      template_id INTEGER REFERENCES ear_request_templates(id),
      form_data JSONB,
      attachments JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      created_by VARCHAR(100),
      sales_cloud_case_id VARCHAR(100),
      sales_cloud_case_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS ip_whitelist (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      parent_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
      menu_code VARCHAR(100) NOT NULL UNIQUE,
      label VARCHAR(200) NOT NULL,
      path VARCHAR(500),
      icon_name VARCHAR(100),
      description VARCHAR(500),
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      admin_only BOOLEAN DEFAULT false,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_menu_mappings (
      id SERIAL PRIMARY KEY,
      group_name VARCHAR(100) NOT NULL,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_name, menu_id)
    );
  `);
  
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_group_name ON group_menu_mappings(group_name);
  `);
  
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_menu_id ON group_menu_mappings(menu_id);
  `);
  
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_is_active ON group_menu_mappings(is_active);
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS input_security_settings (
      id SERIAL PRIMARY KEY,
      setting_type VARCHAR(50) NOT NULL,
      setting_key VARCHAR(100) NOT NULL,
      setting_name VARCHAR(200) NOT NULL,
      is_enabled BOOLEAN DEFAULT true,
      pattern TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(setting_type, setting_key)
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS profanity_patterns (
      id SERIAL PRIMARY KEY,
      pattern VARCHAR(500) NOT NULL,
      description VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS output_security_patterns (
      id SERIAL PRIMARY KEY,
      pattern VARCHAR(500) NOT NULL,
      description VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS output_security_settings (
      id SERIAL PRIMARY KEY,
      setting_type VARCHAR(50) NOT NULL DEFAULT 'output_security',
      setting_key VARCHAR(100) NOT NULL DEFAULT 'output_security',
      setting_name VARCHAR(200) NOT NULL DEFAULT '출력보안',
      is_enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(setting_type, setting_key)
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_intents (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      tcode VARCHAR(50) NOT NULL,
      contents TEXT NOT NULL,
      hash VARCHAR(200) NOT NULL,
      is_greeted BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS privacy_policies (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      html_content TEXT NOT NULL,
      is_current BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(100)
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS prompt_management (
      id SERIAL PRIMARY KEY,
      prompt_type VARCHAR(100) NOT NULL,
      company_code VARCHAR(10) NOT NULL,
      reference_content TEXT,
      prompt TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 인덱스 생성
async function createIndexes(client: any) {
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_rag_documents_name ON rag_documents(name);
    CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chat_session_id ON chat_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_ear_keywords_keyword ON ear_keywords(keyword);
    CREATE INDEX IF NOT EXISTS idx_ear_keywords_category ON ear_keywords(category);
    CREATE INDEX IF NOT EXISTS idx_ear_request_templates_keyword_id ON ear_request_templates(keyword_id);
    CREATE INDEX IF NOT EXISTS idx_ear_requests_status ON ear_requests(status);
    CREATE INDEX IF NOT EXISTS idx_ear_requests_created_at ON ear_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_improvement_requests_session_id ON improvement_requests(session_id);
    CREATE INDEX IF NOT EXISTS idx_improvement_requests_chat_history_id ON improvement_requests(chat_history_id);
    CREATE INDEX IF NOT EXISTS idx_improvement_requests_category ON improvement_requests(category);
    CREATE INDEX IF NOT EXISTS idx_improvement_requests_status ON improvement_requests(status);
    CREATE INDEX IF NOT EXISTS idx_improvement_requests_created_at ON improvement_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_improvement_responses_request_id ON improvement_responses(request_id);
    CREATE INDEX IF NOT EXISTS idx_chat_intent_patterns_active ON chat_intent_patterns(is_active);
    CREATE INDEX IF NOT EXISTS idx_chat_intent_patterns_priority ON chat_intent_patterns(priority);
    CREATE INDEX IF NOT EXISTS idx_chat_intent_options_pattern_id ON chat_intent_options(intent_pattern_id);
    CREATE INDEX IF NOT EXISTS idx_chat_intent_options_display_order ON chat_intent_options(display_order);
    CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
    CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
    CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_history_userid ON login_history(userid);
    CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
    CREATE INDEX IF NOT EXISTS idx_login_history_login_status ON login_history(login_status);
    CREATE INDEX IF NOT EXISTS idx_esm_requests_status ON esm_requests(status);
    CREATE INDEX IF NOT EXISTS idx_esm_requests_created_at ON esm_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_esm_requests_sales_cloud_case_id ON esm_requests(sales_cloud_case_id);
    CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip_address ON ip_whitelist(ip_address);
    CREATE INDEX IF NOT EXISTS idx_ip_whitelist_is_active ON ip_whitelist(is_active);
    CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON menus(parent_id);
    CREATE INDEX IF NOT EXISTS idx_menus_menu_code ON menus(menu_code);
    CREATE INDEX IF NOT EXISTS idx_menus_is_active ON menus(is_active);
    CREATE INDEX IF NOT EXISTS idx_menus_display_order ON menus(display_order);
    CREATE INDEX IF NOT EXISTS idx_input_security_settings_type ON input_security_settings(setting_type);
    CREATE INDEX IF NOT EXISTS idx_input_security_settings_key ON input_security_settings(setting_key);
    CREATE INDEX IF NOT EXISTS idx_input_security_settings_enabled ON input_security_settings(is_enabled);
    CREATE INDEX IF NOT EXISTS idx_profanity_patterns_active ON profanity_patterns(is_active);
    CREATE INDEX IF NOT EXISTS idx_output_security_patterns_active ON output_security_patterns(is_active);
    CREATE INDEX IF NOT EXISTS idx_output_security_settings_enabled ON output_security_settings(is_enabled);
    CREATE INDEX IF NOT EXISTS idx_prompt_management_type ON prompt_management(prompt_type);
    CREATE INDEX IF NOT EXISTS idx_prompt_management_company_code ON prompt_management(company_code);
    CREATE INDEX IF NOT EXISTS idx_prompt_management_active ON prompt_management(is_active);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
    CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);
    CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat);
    CREATE INDEX IF NOT EXISTS idx_agent_roles_agent_id ON agent_roles(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_roles_role_name ON agent_roles(role_name);
    CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
    CREATE INDEX IF NOT EXISTS idx_job_queue_assigned_agent_id ON job_queue(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `);
}

// 벡터 인덱스 생성
async function createVectorIndexes(client: any) {
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_vector ON rag_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
    `);
    console.log('벡터 인덱스 생성 완료 (HNSW)');
  } catch (vectorIndexError: any) {
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_vector ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
      console.log('벡터 인덱스 생성 완료 (IVFFlat)');
    } catch (ivfflatError: any) {
      console.log('벡터 인덱스 생성 실패, 인덱스 없이 진행');
    }
  }
}

// EAR 초기 데이터
async function initializeEARData(client: any) {
  const keywordsData = [
    { keyword: '방화', display_name: '방화벽 오픈 신청', category: '보안' },
    { keyword: '방화벽', display_name: '방화벽 오픈 신청', category: '보안' },
    { keyword: 'firewall', display_name: 'Firewall Access Request', category: '보안' },
    { keyword: '시스템', display_name: '시스템 접근 신청', category: '인프라' },
    { keyword: '서버', display_name: '서버 접근 신청', category: '인프라' },
    { keyword: '계정', display_name: '계정 생성/변경 신청', category: '계정관리' },
    { keyword: '장비', display_name: 'IT 장비 신청', category: '장비' },
  ];

  for (const keywordData of keywordsData) {
    try {
      await client.query(
        'INSERT INTO ear_keywords (keyword, display_name, category) VALUES ($1, $2, $3) ON CONFLICT (keyword) DO NOTHING',
        [keywordData.keyword, keywordData.display_name, keywordData.category]
      );
    } catch (error: any) {
      // 무시
    }
  }
}

// 기본 관리자 계정
async function createDefaultAdmin(client: any) {
  await client.query(`
    INSERT INTO users (userid, password_hash, full_name, is_admin, is_active) 
    VALUES ('admin', '$2b$10$3SBkj8urJRAiVRxl9cDk3OlMgCBwpolz8MpoAn6bQkoAzccHgzqy.', '시스템 관리자', true, true)
    ON CONFLICT (userid) 
    DO UPDATE SET 
      password_hash = '$2b$10$3SBkj8urJRAiVRxl9cDk3OlMgCBwpolz8MpoAn6bQkoAzccHgzqy.',
      is_admin = true,
      is_active = true;
  `);
  console.log('기본 관리자 계정 설정 완료');
}

// IP 화이트리스트 초기화
async function initializeIpWhitelist(client: any) {
  const defaultIps = [
    { ip: '211.45.61.18/32', description: '기본 허용 IP 1' },
    { ip: '211.45.61.20/32', description: '기본 허용 IP 2' },
    { ip: '211.45.62.70/32', description: '기본 허용 IP 3' },
    { ip: 'localhost', description: '로컬호스트' },
    { ip: '127.0.0.1', description: 'IPv4 로컬호스트' },
    { ip: '::1', description: 'IPv6 로컬호스트' },
    { ip: '10.0.0.0/8', description: '사설 IP 대역 10.x.x.x' },
    { ip: '172.16.0.0/12', description: '사설 IP 대역 172.16-31.x.x' },
    { ip: '192.168.0.0/16', description: '사설 IP 대역 192.168.x.x' },
    { ip: '10.140.0.0/16', description: 'Cloud Foundry 내부 네트워크' },
    { ip: '10.141.0.0/16', description: 'Cloud Foundry 내부 네트워크' },
    { ip: '10.142.0.0/16', description: 'Cloud Foundry 내부 네트워크' },
    { ip: '10.143.0.0/16', description: 'Cloud Foundry 내부 네트워크' },
    { ip: '211.45.60.5', description: '임시 허용 IP' }
  ];
  
  for (const ipData of defaultIps) {
    await client.query(`
      INSERT INTO ip_whitelist (ip_address, description, is_active, created_by)
      VALUES ($1, $2, true, 'system')
      ON CONFLICT (ip_address) DO NOTHING
    `, [ipData.ip, ipData.description]);
  }
  
  console.log('IP 화이트리스트 초기화 완료');
}

// 메뉴 초기화
async function initializeMenus(client: any) {
  // 1차 메뉴
  const primaryMenus = [
    { code: 'request', label: '요청관리', order: 1 },
    { code: 'rag', label: 'RAG 관리', order: 2 },
    { code: 'system', label: '시스템 관리', order: 3 },
    { code: 'process', label: '프로세스 관리', order: 4 },
    { code: 'agent', label: '에이전트 관리', order: 5 }
  ];
  
  const menuItems = [
    // 요청관리 하위 메뉴
    { parent: 'request', code: 'ear-registration', label: 'EAR 요청등록', path: '/ear-request-registration', icon: 'FileText', order: 1 },
    { parent: 'request', code: 'esm-registration', label: 'ESM 요청등록', path: '/esm-request-registration', icon: 'FileText', order: 2 },
    { parent: 'request', code: 'ear-list', label: 'EAR 요청목록', path: '/ear-request-list', icon: 'List', order: 3 },
    { parent: 'request', code: 'system-improvement-new', label: '시스템 개선요청', path: '/system-improvement-new', icon: 'AlertTriangle', order: 4 },
    { parent: 'request', code: 'system-improvement-list', label: '내 시스템 개선요청', path: '/system-improvement-list', icon: 'ClipboardList', order: 5 },
    { parent: 'request', code: 'system-improvement-admin', label: '시스템 개선요청 관리', path: '/system-improvement-admin', icon: 'Settings', order: 6, adminOnly: true },
    
    // RAG 관리 하위 메뉴
    { parent: 'rag', code: 'rag-document', label: 'RAG 문서관리', path: '/rag-document-management', icon: 'Database', order: 1 },
    { parent: 'rag', code: 'rag-improvement-registration', label: '답변품질 개선요청', path: '/improvement-request-registration', icon: 'MessageSquare', order: 2 },
    { parent: 'rag', code: 'rag-improvement-list', label: '답변품질 개선요청 목록', path: '/rag-quality-improvement-list', icon: 'MessageSquare', order: 3 },
    { parent: 'rag', code: 'rag-improvement-admin', label: '답변품질 개선요청 관리', path: '/improvement-request-admin', icon: 'Settings', order: 4, adminOnly: true },
    
    // 시스템 관리 하위 메뉴
    { parent: 'system', code: 'login-history', label: '로그인 이력', path: '/login-history', icon: 'History', order: 1, adminOnly: true },
    { parent: 'system', code: 'user-management', label: '사용자 관리', path: '/user-management', icon: 'Users', order: 2, adminOnly: true },
    { parent: 'system', code: 'chat-intent-management', label: '채팅 의도 패턴 관리', path: '/chat-intent-management', icon: 'MessageSquare', order: 3, adminOnly: true },
    { parent: 'system', code: 'chat-history', label: '채팅 히스토리 조회', path: '/chat-history', icon: 'MessageSquare', order: 4, adminOnly: true },
    { parent: 'system', code: 'input-security-management', label: '입력보안 Layer 관리', path: '/input-security-management', icon: 'Shield', order: 5, adminOnly: true },
    { parent: 'system', code: 'output-security-management', label: '출력보안 Layer 관리', path: '/output-security-management', icon: 'Shield', order: 6, adminOnly: true },
    { parent: 'system', code: 'interface-automation', label: '인터페이스 연동 자동화', path: '/interface-automation', icon: 'Zap', order: 7, adminOnly: true },
    { parent: 'system', code: 'menu-management', label: '메뉴 관리', path: '/menu-management', icon: 'Menu', order: 8, adminOnly: true },
    { parent: 'system', code: 'group-menu-mapping', label: '사용자그룹별 메뉴매핑', path: '/group-menu-mapping', icon: 'Users', order: 9, adminOnly: true },
    { parent: 'system', code: 'privacy-policy-management', label: '개인정보 처리방침 관리', path: '/privacy-policy-management', icon: 'FileText', order: 10, adminOnly: true },
    { parent: 'system', code: 'prompt-management', label: '프롬프트 관리', path: '/prompt-management', icon: 'MessageSquare', order: 11, adminOnly: true },
    { parent: 'system', code: 'rag-agent-management', label: 'RAG Agent 관리', path: '/rag-agent-management', icon: 'Bot', order: 12, adminOnly: true },
    { parent: 'system', code: 'destination-test', label: '연동테스트', path: '/destination-test', icon: 'Zap', order: 13, adminOnly: true },
    
      // 프로세스 관리 하위 메뉴
      { parent: 'process', code: 'process-visualization', label: '프로세스 시각화', path: '/process-visualization', icon: 'GitBranch', order: 1 },
      { parent: 'process', code: 'main-prototype1', label: 'Main Prototype1', path: '/main-prototype1', icon: 'Layout', order: 2 },
      { parent: 'process', code: 'main-prototype2', label: 'Main Prototype2', path: '/main-prototype2', icon: 'Layout', order: 3 },
      { parent: 'process', code: 'main-prototype3', label: 'Main Prototype3', path: '/main-prototype3', icon: 'Layout', order: 4 },
      { parent: 'process', code: 'main-prototype4', label: 'Main Prototype4', path: '/main-prototype4', icon: 'Layout', order: 5 },
      { parent: 'process', code: 'main-prototype5', label: 'Main Prototype5', path: '/main-prototype5', icon: 'Layout', order: 6 },
      { parent: 'process', code: 'main-prototype6', label: 'Main Prototype6', path: '/main-prototype6', icon: 'Layout', order: 7 },

      // 에이전트 관리 하위 메뉴
      { parent: 'agent', code: 'agent-dashboard', label: '에이전트 대시보드', path: '/agent-dashboard', icon: 'Activity', order: 1 },
      { parent: 'agent', code: 'agent-management', label: '에이전트 목록', path: '/agent-management', icon: 'Bot', order: 2 },
      { parent: 'agent', code: 'agent-monitoring', label: '업무량/모니터링', path: '/agent-monitoring', icon: 'BarChart3', order: 3 }
    ];
  
  // 1차 메뉴 삽입 (없으면 추가)
  const parentMenuMap = new Map<string, number>();
  for (const menu of primaryMenus) {
    const existingResult = await client.query(
      'SELECT id FROM menus WHERE menu_code = $1',
      [menu.code]
    );
    
    let menuId: number;
    if (existingResult.rows.length > 0) {
      menuId = existingResult.rows[0].id;
    } else {
      const result = await client.query(
        'INSERT INTO menus (menu_code, label, display_order, is_active, created_by) VALUES ($1, $2, $3, true, $4) RETURNING id',
        [menu.code, menu.label, menu.order, 'system']
      );
      menuId = result.rows[0].id;
    }
    parentMenuMap.set(menu.code, menuId);
  }
  
  // 2차 메뉴 삽입 (없으면 추가)
  for (const item of menuItems) {
    const parentId = parentMenuMap.get(item.parent);
    if (!parentId) continue;
    
    const existingResult = await client.query(
      'SELECT id FROM menus WHERE menu_code = $1',
      [item.code]
    );
    
    if (existingResult.rows.length === 0) {
      // 메뉴가 없으면 추가
      await client.query(
        'INSERT INTO menus (parent_id, menu_code, label, path, icon_name, description, display_order, is_active, admin_only, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)',
        [parentId, item.code, item.label, item.path, item.icon, item.label, item.order, item.adminOnly || false, 'system']
      );
    }
  }
  
  // EAR-ADMIN 그룹에 모든 메뉴 매핑 (초기 데이터)
  try {
    // 모든 활성 메뉴 조회
    const allMenusResult = await client.query(
      'SELECT id FROM menus WHERE is_active = true'
    );
    
    if (allMenusResult.rows && allMenusResult.rows.length > 0) {
      const menuIds = allMenusResult.rows.map((row: any) => row.id);
      
      // EAR-ADMIN 그룹에 모든 메뉴 매핑 (중복 체크)
      for (const menuId of menuIds) {
        // 기존 매핑 확인
        const existingMapping = await client.query(
          'SELECT id FROM group_menu_mappings WHERE group_name = $1 AND menu_id = $2',
          ['EAR-ADMIN', menuId]
        );
        
        if (existingMapping.rows.length === 0) {
          // 매핑이 없으면 추가
          await client.query(
            'INSERT INTO group_menu_mappings (group_name, menu_id, is_active, created_by) VALUES ($1, $2, true, $3)',
            ['EAR-ADMIN', menuId, 'system']
          );
        }
      }
      
      console.log(`✅ EAR-ADMIN 그룹에 ${menuIds.length}개 메뉴 매핑 완료`);
    }
  } catch (mappingError: any) {
    console.warn('그룹별 메뉴 매핑 초기화 실패 (계속 진행):', mappingError.message);
  }
  
  console.log('메뉴 초기화 완료');
}

// 에이전트 샘플 데이터 초기화 (로컬 개발용)
async function seedAgentData(client: any) {
  const existing = await client.query('SELECT COUNT(*)::int as count FROM agents');
  if ((existing.rows?.[0]?.count || 0) > 0) {
    return;
  }

  const agents = [
    {
      name: 'Agent Alpha',
      description: '검색 기반 응답 에이전트',
      type: 'LLM',
      status: 'active',
      env_config: { model: 'gpt-4o-mini', region: 'local' },
      max_concurrency: 4,
      tags: ['search', 'rag']
    },
    {
      name: 'Agent Beta',
      description: '백오피스 자동화 에이전트',
      type: 'Automation',
      status: 'running',
      env_config: { runtime: 'node', retries: 2 },
      max_concurrency: 2,
      tags: ['automation']
    },
    {
      name: 'Agent Gamma',
      description: '오류 감지 테스트 에이전트',
      type: 'Monitor',
      status: 'error',
      env_config: { threshold: 0.2 },
      max_concurrency: 1,
      tags: ['monitoring', 'ops']
    }
  ];

  const agentIds: number[] = [];
  for (const agent of agents) {
    const result = await client.query(
      `INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      [
        agent.name,
        agent.description,
        agent.type,
        agent.status,
        JSON.stringify(agent.env_config),
        agent.max_concurrency,
        JSON.stringify(agent.tags)
      ]
    );
    agentIds.push(result.rows[0].id);
  }

  const roleMap = [
    { agentId: agentIds[0], roles: ['retrieval', 'answering'] },
    { agentId: agentIds[1], roles: ['workflow', 'scheduler'] },
    { agentId: agentIds[2], roles: ['monitoring'] }
  ];

  for (const entry of roleMap) {
    for (const role of entry.roles) {
      await client.query(
        'INSERT INTO agent_roles (agent_id, role_name) VALUES ($1, $2)',
        [entry.agentId, role]
      );
    }
  }

  const now = new Date();
  for (const agentId of agentIds) {
    await client.query(
      `INSERT INTO agent_metrics
       (agent_id, timestamp, cpu_usage, memory_usage, requests_processed, avg_latency, error_rate, queue_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        agentId,
        new Date(now.getTime() - 15 * 60 * 1000),
        42.5,
        61.2,
        120,
        210.4,
        1.2,
        12.5
      ]
    );
    await client.query(
      `INSERT INTO agent_metrics
       (agent_id, timestamp, cpu_usage, memory_usage, requests_processed, avg_latency, error_rate, queue_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        agentId,
        new Date(now.getTime() - 5 * 60 * 1000),
        55.1,
        68.7,
        140,
        185.7,
        0.8,
        9.4
      ]
    );
  }

  const jobIds = [
    { jobId: 'job-1001', status: 'queued', priority: 1, assignedAgentId: agentIds[1] },
    { jobId: 'job-1002', status: 'running', priority: 2, assignedAgentId: agentIds[0] },
    { jobId: 'job-1003', status: 'queued', priority: 0, assignedAgentId: null }
  ];

  for (const job of jobIds) {
    await client.query(
      `INSERT INTO job_queue (job_id, payload, priority, status, assigned_agent_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        job.jobId,
        JSON.stringify({ task: 'sample', jobId: job.jobId }),
        job.priority,
        job.status,
        job.assignedAgentId
      ]
    );
  }

  await client.query(
    `INSERT INTO agent_tasks (agent_id, job_id, status, received_at, started_at, finished_at, result)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      agentIds[0],
      'job-1002',
      'running',
      new Date(now.getTime() - 30 * 60 * 1000),
      new Date(now.getTime() - 10 * 60 * 1000),
      null,
      JSON.stringify({ note: 'processing' })
    ]
  );

  console.log('✅ 에이전트 샘플 데이터 초기화 완료');
}

// 입력보안 설정 초기화
async function initializeInputSecurity(client: any) {
  try {
    // 주민등록번호 차단 설정 (기본값: 비활성화)
    await client.query(`
      INSERT INTO input_security_settings (setting_type, setting_key, setting_name, is_enabled, pattern)
      VALUES ('personal_info', 'ssn', '주민등록번호', false, '\\d{6}-[1-4]\\d{6}')
      ON CONFLICT (setting_type, setting_key)
      DO UPDATE SET setting_name = EXCLUDED.setting_name, pattern = EXCLUDED.pattern
    `);
    
    // 욕설 차단 설정 (기본값: 비활성화)
    await client.query(`
      INSERT INTO input_security_settings (setting_type, setting_key, setting_name, is_enabled, pattern)
      VALUES ('profanity', 'profanity', '욕설', false, NULL)
      ON CONFLICT (setting_type, setting_key)
      DO UPDATE SET setting_name = EXCLUDED.setting_name
    `);
    
    console.log('입력보안 설정 초기화 완료');
  } catch (error: any) {
    console.error('입력보안 설정 초기화 실패:', error.message);
  }
}

// 출력보안 설정 초기화
async function initializeOutputSecurity(client: any) {
  try {
    // 출력보안 차단 설정 (기본값: 비활성화)
    await client.query(`
      INSERT INTO output_security_settings (setting_type, setting_key, setting_name, is_enabled)
      VALUES ('output_security', 'output_security', '출력보안', false)
      ON CONFLICT (setting_type, setting_key)
      DO UPDATE SET setting_name = EXCLUDED.setting_name
    `);
    
    console.log('출력보안 설정 초기화 완료');
  } catch (error: any) {
    console.error('출력보안 설정 초기화 실패:', error.message);
  }
}

// 쿼리 헬퍼
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export { pool };
