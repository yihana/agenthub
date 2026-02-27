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
    await applyPortalDashboardMigrations(client);
    
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

    // 포털 기본 계정/권한 매트릭스
    await createDefaultPortalUsers(client);
    
    // IP 화이트리스트 초기화
    await initializeIpWhitelist(client);
    
    // 메뉴 초기화
    await initializeMenus(client);

    // 포털 기준값/분류 샘플 데이터
    await seedPortalBaselines(client);
    await seedBusinessDomainHierarchy(client);

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
      business_type VARCHAR(100),
      owner_user_id VARCHAR(100),
      version VARCHAR(50),
      model_name VARCHAR(100),
      language VARCHAR(50),
      supported_modes VARCHAR(100),
      endpoint_url VARCHAR(255),
      exec_mode VARCHAR(50),
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
      queue_time NUMERIC(10,2),
      ai_assisted_decisions INTEGER DEFAULT 0,
      ai_assisted_decisions_validated INTEGER DEFAULT 0,
      ai_recommendations INTEGER DEFAULT 0,
      decisions_overridden INTEGER DEFAULT 0,
      cognitive_load_before_score NUMERIC(6,2),
      cognitive_load_after_score NUMERIC(6,2),
      handoff_time_seconds NUMERIC(10,2),
      team_satisfaction_score NUMERIC(6,2),
      innovation_count INTEGER DEFAULT 0
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
    CREATE TABLE IF NOT EXISTS user_job_role (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_business_domain (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      business_type VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, business_type)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS business_task_baseline (
      id SERIAL PRIMARY KEY,
      task_code VARCHAR(100) NOT NULL,
      domain VARCHAR(100),
      before_time_min NUMERIC(10,2) NOT NULL,
      before_cost NUMERIC(14,2),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_code, domain)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS labor_cost (
      id SERIAL PRIMARY KEY,
      role VARCHAR(100) NOT NULL,
      hourly_cost NUMERIC(14,2) NOT NULL,
      currency VARCHAR(50) DEFAULT 'KRW',
      business_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role, business_type)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS roi_metrics (
      id SERIAL PRIMARY KEY,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      business_type VARCHAR(100),
      agent_type VARCHAR(100),
      saved_hours NUMERIC(12,2) DEFAULT 0,
      saved_cost NUMERIC(14,2) DEFAULT 0,
      roi_ratio_pct NUMERIC(8,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(period_start, period_end, business_type, agent_type)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS human_ai_collaboration_metrics (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      business_type VARCHAR(100),
      agent_type VARCHAR(100),
      decision_accuracy_pct NUMERIC(6,2),
      override_rate_pct NUMERIC(6,2),
      cognitive_load_reduction_pct NUMERIC(6,2),
      handoff_time_seconds NUMERIC(10,2),
      team_satisfaction_score NUMERIC(6,2),
      innovation_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(period_start, period_end, business_type, agent_type)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS risk_management (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      use_case VARCHAR(200),
      business_type VARCHAR(100),
      agent_type VARCHAR(100),
      risk_ethics_score INTEGER,
      risk_reputation_score INTEGER,
      risk_operational_score INTEGER,
      risk_legal_score INTEGER,
      audit_required BOOLEAN DEFAULT false,
      audit_completed BOOLEAN DEFAULT false,
      human_reviewed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

   await client.query(`
    CREATE TABLE IF NOT EXISTS adoption_funnel_events (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      stage VARCHAR(50) NOT NULL,
      business_type VARCHAR(100),
      agent_type VARCHAR(100),
      metadata JSONB,
      event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_system_mappings (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      system_cd VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agent_id, system_cd)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_erp_auth (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
      system_cd VARCHAR(50) NOT NULL,
      sys_auth_cd VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agent_id, system_cd, sys_auth_cd)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS portal_metric_inputs (
      id SERIAL PRIMARY KEY,
      metric_key VARCHAR(120) NOT NULL,
      value NUMERIC(14,2) NOT NULL,
      unit VARCHAR(50),
      description TEXT,
      business_type VARCHAR(100),
      agent_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(metric_key, business_type, agent_type)
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
      agent_id INTEGER REFERENCES agents(id),
      business_type VARCHAR(100),
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
    CREATE TABLE IF NOT EXISTS portal_users (
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
    CREATE TABLE IF NOT EXISTS portal_user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES portal_users(id) ON DELETE CASCADE,
      role_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS portal_role_matrix (
      id SERIAL PRIMARY KEY,
      company_code VARCHAR(10) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      permissions JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_code, role_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS portal_login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES portal_users(id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS business_domains (
      id SERIAL PRIMARY KEY,
      domain_code VARCHAR(50) NOT NULL UNIQUE,
      domain_name VARCHAR(200) NOT NULL,
      description VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS business_level1 (
      id SERIAL PRIMARY KEY,
      domain_id INTEGER NOT NULL REFERENCES business_domains(id) ON DELETE CASCADE,
      level1_code VARCHAR(50) NOT NULL,
      level1_name VARCHAR(200) NOT NULL,
      menu_code VARCHAR(100),
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(domain_id, level1_code)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS business_level2 (
      id SERIAL PRIMARY KEY,
      level1_id INTEGER NOT NULL REFERENCES business_level1(id) ON DELETE CASCADE,
      level2_code VARCHAR(50) NOT NULL,
      level2_name VARCHAR(200) NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(level1_id, level2_code)
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

async function applyPortalDashboardMigrations(client: any) {
  const columns = [
    { table: 'agents', name: 'business_type', type: 'VARCHAR(100)' },
    { table: 'agents', name: 'owner_user_id', type: 'VARCHAR(100)' },
    { table: 'agents', name: 'version', type: 'VARCHAR(50)' },
    { table: 'agents', name: 'model_name', type: 'VARCHAR(100)' },
    { table: 'agents', name: 'language', type: 'VARCHAR(50)' },
    { table: 'agents', name: 'supported_modes', type: 'VARCHAR(100)' },
    { table: 'agents', name: 'endpoint_url', type: 'VARCHAR(255)' },
    { table: 'agents', name: 'exec_mode', type: 'VARCHAR(50)' },
    { table: 'agents', name: 'suite', type: 'VARCHAR(30)' },
    { table: 'agents', name: 'risk', type: 'VARCHAR(30)' },
    { table: 'agents', name: 'capability', type: 'TEXT' },
    { table: 'agents', name: 'runtime_state', type: 'VARCHAR(30)' },
    { table: 'agents', name: 'runtime_errors', type: 'INTEGER DEFAULT 0' },
    { table: 'agents', name: 'customer_count', type: 'INTEGER DEFAULT 0' },
    { table: 'agents', name: 'calls_30d', type: 'INTEGER DEFAULT 0' },
    { table: 'ear_requests', name: 'agent_id', type: 'INTEGER' },
    { table: 'ear_requests', name: 'business_type', type: 'VARCHAR(100)' },
    { table: 'agent_metrics', name: 'ai_assisted_decisions', type: 'INTEGER DEFAULT 0' },
    { table: 'agent_metrics', name: 'ai_assisted_decisions_validated', type: 'INTEGER DEFAULT 0' },
    { table: 'agent_metrics', name: 'ai_recommendations', type: 'INTEGER DEFAULT 0' },
    { table: 'agent_metrics', name: 'decisions_overridden', type: 'INTEGER DEFAULT 0' },
    { table: 'agent_metrics', name: 'cognitive_load_before_score', type: 'NUMERIC(6,2)' },
    { table: 'agent_metrics', name: 'cognitive_load_after_score', type: 'NUMERIC(6,2)' },
    { table: 'agent_metrics', name: 'handoff_time_seconds', type: 'NUMERIC(10,2)' },
    { table: 'agent_metrics', name: 'team_satisfaction_score', type: 'NUMERIC(6,2)' },
    { table: 'agent_metrics', name: 'innovation_count', type: 'INTEGER DEFAULT 0' }
  ];

  for (const column of columns) {
    await client.query(
      `ALTER TABLE ${column.table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};`
    );
  }

  await client.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS business_level2_id INTEGER REFERENCES business_level2(id) ON DELETE SET NULL;');
}

async function seedPortalBaselines(client: any) {
  await client.query(
    `INSERT INTO portal_metric_inputs (metric_key, value, unit, description)
     VALUES
       ('baseline_minutes_per_request', 12, 'minute', '요청 1건당 기준 처리 시간 (분)'),
       ('cost_per_hour', 45000, 'KRW', '시간당 인건비 단가'),
       ('sla_latency_ms', 2000, 'ms', 'SLA 기준 응답 시간 (ms)'),
       ('investment_cost', 0, 'KRW', '에이전트 개발/운영 투자 비용'),
       ('total_roles', 0, 'count', '전체 역할 수'),
       ('roles_redefined', 0, 'count', 'AI 협업으로 재설계된 역할 수'),
       ('customer_nps_delta', 0, 'point', 'AI 도입 이후 고객 만족도/NPS 변화'),
       ('error_reduction_pct', 0, 'pct', '오류율 감소율'),
       ('decision_speed_improvement_pct', 0, 'pct', '의사결정 속도 개선율')
     ON CONFLICT (metric_key, business_type, agent_type) DO NOTHING;`
  );
}

async function seedBusinessDomainHierarchy(client: any) {
  await client.query(
    `INSERT INTO business_domains (domain_code, domain_name, description)
     VALUES ('SAP', 'SAP Domain', 'SAP 업무 모듈 체계')
     ON CONFLICT (domain_code) DO NOTHING;`
  );

  await client.query(
    `WITH sap_domain AS (
      SELECT id FROM business_domains WHERE domain_code = 'SAP'
    )
    INSERT INTO business_level1 (domain_id, level1_code, level1_name, menu_code, display_order)
    SELECT sap_domain.id, level1_code, level1_name, menu_code, display_order
    FROM sap_domain
    CROSS JOIN (
      VALUES
      ('CM.1', '통합', 'agent-management', 5),
      ('MM.1', '구매처/자재마스터', 'agent-management', 10),
      ('MM.2', 'Sourcing/계약관리', 'agent-management', 20),
      ('MM.3', '구매발주관리', 'agent-management', 30),
      ('MM.4', '재고관리', 'agent-management', 40),
      ('MM.5', '인보이스관리', 'agent-management', 50),
      ('PP.1', '제조/자원 마스터', 'agent-management', 60),
      ('PP.2', '수요·공급 계획', 'agent-management', 70),
      ('PP.3', '생산오더 관리', 'agent-management', 80),
      ('PP.4', '생산 실행', 'agent-management', 90),
      ('PP.5', '정산/분석', 'agent-management', 100),
      ('HR.1', '조직/인사마스터', 'agent-management', 110),
      ('HR.2', '채용/온보딩', 'agent-management', 120),
      ('HR.3', '근태/휴가', 'agent-management', 130),
      ('HR.4', '급여/복리', 'agent-management', 140),
      ('HR.5', '성과/육성', 'agent-management', 150),
      ('SD.1', '고객/가격 마스터', 'agent-management', 160),
      ('SD.2', '견적/주문 관리', 'agent-management', 170),
      ('SD.3', '납품/출고/물류', 'agent-management', 180),
      ('SD.4', '청구/정산', 'agent-management', 190),
      ('SD.5', '수금/채권/신용', 'agent-management', 200),
      ('FI.1', '일반회계', 'agent-management', 210),
      ('FI.2', '결산관리', 'agent-management', 220),
      ('FI.3', '채권관리', 'agent-management', 230),
      ('FI.4', '채무관리', 'agent-management', 240),
      ('FI.5', '자산관리', 'agent-management', 250),
      ('FI.6', '세무관리', 'agent-management', 260),
      ('FI.7', '연결결산', 'agent-management', 270),
      ('CO.1', '운영예산(Fund Center)', 'agent-management', 280),
      ('CO.2', 'PS(WBS 투자예산)', 'agent-management', 290),
      ('CO.3', 'CA(Cost Center 비용관리)', 'agent-management', 300),
      ('CO.4', '제조원가/재고수불', 'agent-management', 310),
      ('CO.5', 'PCA(Profit Center 성과관리)', 'agent-management', 320),
      ('CO.6', 'PA(수익성분석)', 'agent-management', 330),
      ('CO.7', '연결PA(수익성분석)', 'agent-management', 340),
      ('BC.1', '계정/권한', 'agent-management', 350),
      ('BC.2', '운영요청(티켓)', 'agent-management', 360),
      ('BC.3', '모니터링/배치', 'agent-management', 370),
      ('BC.4', '릴리즈(Transport)', 'agent-management', 380),
      ('BC.5', '보안/복구', 'agent-management', 390)
    ) AS modules(level1_code, level1_name, menu_code, display_order)
    ON CONFLICT (domain_id, level1_code) DO NOTHING;`
  );

  await client.query(
    `INSERT INTO business_level2 (level1_id, level2_code, level2_name, display_order)
     SELECT l1.id, v.level2_code, v.level2_name, v.display_order
     FROM business_level1 l1
     JOIN (
       VALUES
       ('CM.1', 'CM.1.1', '공통 운영 모니터링', 10),
       ('CM.1', 'CM.1.2', '공통 정책/권한 관리', 20),
       ('MM.1', 'MM.1.1', '자재마스터', 10),
       ('MM.1', 'MM.1.2', '구매처마스터', 20),
       ('MM.1', 'MM.1.3', '구매처 평가', 30),
       ('MM.2', 'MM.2.1', '구매 Sourcing 지정', 40),
       ('MM.2', 'MM.2.2', '계약관리', 50),
       ('MM.3', 'MM.3.1', '구매계획관리', 60),
       ('MM.3', 'MM.3.2', '구매발주', 70),
       ('MM.3', 'MM.3.3', '서비스구매', 80),
       ('MM.3', 'MM.3.4', '구매요청 관리', 90),
       ('MM.3', 'MM.3.5', '구매 분석', 100),
       ('MM.3', 'MM.3.6', '발주 협업', 110),
       ('MM.4', 'MM.4.1', '자재 입고', 120),
       ('MM.4', 'MM.4.2', '자재 출고', 130),
       ('MM.4', 'MM.4.3', '창고 관리', 140),
       ('MM.4', 'MM.4.4', '출하 관리', 150),
       ('MM.5', 'MM.5.1', '인보이스 관리', 160),
       ('MM.5', 'MM.5.2', '매입채무 관리', 170),
       ('MM.5', 'MM.5.3', '3-way match 예외', 180),
       ('MM.5', 'MM.5.4', '인보이스 협업관리', 190),
       ('PP.1', 'PP.1.1', '제품/자재마스터', 200),
       ('PP.1', 'PP.1.2', 'BOM 관리', 210),
       ('PP.1', 'PP.1.3', 'Routing/Workcenter/Production Version', 220),
       ('PP.2', 'PP.2.1', '수요예측/계획', 230),
       ('PP.2', 'PP.2.2', 'S&OP', 240),
       ('PP.2', 'PP.2.3', 'MPS', 250),
       ('PP.3', 'PP.3.1', 'MRP 실행/예외', 260),
       ('PP.3', 'PP.3.2', '오더 생성/릴리즈', 270),
       ('PP.3', 'PP.3.3', '자재가용성/대체', 280),
       ('PP.4', 'PP.4.1', '생산 투입(GI)', 290),
       ('PP.4', 'PP.4.2', '가공비 처리', 300),
       ('PP.4', 'PP.4.3', 'Scrap 처리', 310),
       ('PP.4', 'PP.4.4', 'WIP 관리', 320),
       ('PP.5', 'PP.5.1', '반/완제품 입고', 330),
       ('PP.5', 'PP.5.2', '간접비 배부', 340),
       ('PP.5', 'PP.5.3', '생산 오더 정산', 350),
       ('PP.5', 'PP.5.4', '생산 실적 레포트', 360),
       ('HR.1', 'HR.1.1', '조직/직무', 370),
       ('HR.1', 'HR.1.2', '인사기본', 380),
       ('HR.1', 'HR.1.3', '권한/접근', 390),
       ('HR.2', 'HR.2.1', '채용요청', 400),
       ('HR.2', 'HR.2.2', '지원/면접', 410),
       ('HR.2', 'HR.2.3', '오퍼/계약', 420),
       ('HR.2', 'HR.2.4', '온보딩/계정', 430),
       ('HR.3', 'HR.3.1', '근태관리', 440),
       ('HR.3', 'HR.3.2', '근태마감처리', 450),
       ('HR.3', 'HR.3.3', '스케줄/교대 관리', 460),
       ('HR.3', 'HR.3.4', '예외처리', 470),
       ('HR.4', 'HR.4.1', '급여데이터 관리', 480),
       ('HR.4', 'HR.4.2', '급여계산', 490),
       ('HR.4', 'HR.4.3', '지급/전표', 500),
       ('HR.4', 'HR.4.4', '연말정산', 510),
       ('HR.5', 'HR.5.1', '평가관리', 520),
       ('HR.5', 'HR.5.2', '목표/OKR', 530),
       ('HR.5', 'HR.5.3', '교육/역량', 540),
       ('HR.5', 'HR.5.4', '보상연계', 550),
       ('SD.1', 'SD.1.1', '고객마스터', 560),
       ('SD.1', 'SD.1.2', '가격/할인', 570),
       ('SD.1', 'SD.1.3', '신용한도/위험', 580),
       ('SD.2', 'SD.2.1', '견적/계약', 590),
       ('SD.2', 'SD.2.2', '판매오더', 600),
       ('SD.2', 'SD.2.3', 'ATP/가용성', 610),
       ('SD.2', 'SD.2.4', '변경/승인', 620),
       ('SD.2', 'SD.2.5', '프로모션 적용', 630),
       ('SD.3', 'SD.3.1', '납품생성', 640),
       ('SD.3', 'SD.3.2', '피킹/패킹', 650),
       ('SD.3', 'SD.3.3', '출고(PGI)', 660),
       ('SD.3', 'SD.3.4', '운송/배송추적', 670),
       ('SD.4', 'SD.4.1', '청구문서', 680),
       ('SD.4', 'SD.4.2', '세금/조건', 690),
       ('SD.4', 'SD.4.3', '청구차이/예외', 700),
       ('SD.4', 'SD.4.4', '정산/조정', 710),
       ('SD.4', 'SD.4.5', '반품/클레임', 720),
       ('SD.5', 'SD.5.1', '수금', 730),
       ('SD.5', 'SD.5.2', '대사/미결', 740),
       ('SD.5', 'SD.5.3', '연체/독촉', 750),
       ('SD.5', 'SD.5.4', '채권분석/대손', 760),
       ('FI.1', 'FI.1.1', '기준정보관리', 770),
       ('FI.1', 'FI.1.2', '전표관리', 780),
       ('FI.2', 'FI.2.1', '결산일정 관리', 790),
       ('FI.2', 'FI.2.2', '결산조정 관리', 800),
       ('FI.2', 'FI.2.3', '결산보고', 810),
       ('FI.2', 'FI.2.4', '연말결산(연결사)', 820),
       ('FI.3', 'FI.3.1', '기준정보관리', 830),
       ('FI.3', 'FI.3.2', '채권전표관리', 840),
       ('FI.3', 'FI.3.3', '채권관리', 850),
       ('FI.4', 'FI.4.1', '기준정보관리', 860),
       ('FI.4', 'FI.4.2', '채무전표관리', 870),
       ('FI.4', 'FI.4.3', '선급금/가지급금 관리', 880),
       ('FI.4', 'FI.4.4', '채무지급 및 반제', 890),
       ('FI.4', 'FI.4.5', '법인카드 정산', 900),
       ('FI.5', 'FI.5.1', '자산기준정보관리', 910),
       ('FI.5', 'FI.5.2', '자산취득관리', 920),
       ('FI.5', 'FI.5.3', '자산운용관리', 930),
       ('FI.5', 'FI.5.4', '자산처분관리', 940),
       ('FI.5', 'FI.5.5', '감가상각', 950),
       ('FI.6', 'FI.6.1', '기준정보관리', 960),
       ('FI.6', 'FI.6.2', '부가가치세관리', 970),
       ('FI.6', 'FI.6.3', '원천세 관리', 980),
       ('FI.6', 'FI.6.4', '법인세 관리', 990),
       ('FI.6', 'FI.6.5', '지방세 관리', 1000),
       ('FI.7', 'FI.7.1', '연결 기준정보 관리', 1010),
       ('FI.7', 'FI.7.2', '내부거래 관리', 1020),
       ('FI.7', 'FI.7.3', '연결 결산 조정', 1030),
       ('FI.7', 'FI.7.4', '연결재무 결산 마감', 1040),
       ('CO.1', 'CO.1.1', '운영예산 기준정보', 1050),
       ('CO.1', 'CO.1.2', '운영예산 예산관리', 1060),
       ('CO.1', 'CO.1.3', '운영예산 실적', 1070),
       ('CO.2', 'CO.2.1', '투자예산 기준정보', 1080),
       ('CO.2', 'CO.2.2', '투자예산 예산관리', 1090),
       ('CO.2', 'CO.2.3', '투자예산 실적', 1100),
       ('CO.3', 'CO.3.1', '비용관리 기준정보', 1110),
       ('CO.3', 'CO.3.2', '비용관리 결산/정산', 1120),
       ('CO.3', 'CO.3.3', '비용관리 실적', 1130),
       ('CO.4', 'CO.4.1', '제조원가 기준정보', 1140),
       ('CO.4', 'CO.4.2', '제조원가 결산/정산', 1150),
       ('CO.4', 'CO.4.3', '제조원가 실적', 1160),
       ('CO.5', 'CO.5.1', 'PCA 기준 정보', 1170),
       ('CO.5', 'CO.5.2', 'PCA 결산/정산', 1180),
       ('CO.5', 'CO.5.3', 'PCA 실적', 1190),
       ('CO.6', 'CO.6.1', 'PA 기준정보', 1200),
       ('CO.6', 'CO.6.2', 'PA 결산/정산', 1210),
       ('CO.6', 'CO.6.3', 'PA 실적', 1220),
       ('CO.7', 'CO.7.1', '연결PA 기준정보', 1230),
       ('CO.7', 'CO.7.2', '연결PA 결산/정산', 1240),
       ('CO.7', 'CO.7.3', '연결PA 실적', 1250),
       ('BC.1', 'BC.1.1', '사용자 생성', 1260),
       ('BC.1', 'BC.1.2', '역할/권한 부여', 1270),
       ('BC.1', 'BC.1.3', 'SoD 점검', 1280),
       ('BC.1', 'BC.1.4', '접근로그', 1290),
       ('BC.2', 'BC.2.1', '티켓접수', 1300),
       ('BC.2', 'BC.2.2', '자동분류/우선순위', 1310),
       ('BC.2', 'BC.2.3', '표준응답/가이드', 1320),
       ('BC.2', 'BC.2.4', 'SLA 관리', 1330),
       ('BC.3', 'BC.3.1', '배치잡', 1340),
       ('BC.3', 'BC.3.2', '성능 모니터링', 1350),
       ('BC.3', 'BC.3.3', '에러로그', 1360),
       ('BC.3', 'BC.3.4', '인터페이스 상태', 1370),
       ('BC.4', 'BC.4.1', 'Transport 승인', 1380),
       ('BC.4', 'BC.4.2', '릴리즈 노트/공지', 1390),
       ('BC.4', 'BC.4.3', '롤백계획', 1400),
       ('BC.5', 'BC.5.1', '백업/복구', 1410),
       ('BC.5', 'BC.5.2', '취약점 점검', 1420),
       ('BC.5', 'BC.5.3', '권한감사', 1430),
       ('BC.5', 'BC.5.4', '비상계정', 1440)
     ) AS v(level1_code, level2_code, level2_name, display_order)
       ON v.level1_code = l1.level1_code
     ON CONFLICT (level1_id, level2_code) DO NOTHING;`
  );
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
    CREATE INDEX IF NOT EXISTS idx_portal_users_userid ON portal_users(userid);
    CREATE INDEX IF NOT EXISTS idx_portal_login_history_user_id ON portal_login_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_portal_login_history_userid ON portal_login_history(userid);
    CREATE INDEX IF NOT EXISTS idx_portal_login_history_login_time ON portal_login_history(login_time);
    CREATE INDEX IF NOT EXISTS idx_portal_login_history_login_status ON portal_login_history(login_status);
    CREATE INDEX IF NOT EXISTS idx_portal_user_roles_user_id ON portal_user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_portal_role_matrix_company_role ON portal_role_matrix(company_code, role_name);
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
    CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_period ON human_ai_collaboration_metrics(period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_agent_type ON human_ai_collaboration_metrics(agent_type);
    CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_business_type ON human_ai_collaboration_metrics(business_type);
    CREATE INDEX IF NOT EXISTS idx_risk_management_created_at ON risk_management(created_at);
    CREATE INDEX IF NOT EXISTS idx_risk_management_agent_type ON risk_management(agent_type);
    CREATE INDEX IF NOT EXISTS idx_risk_management_business_type ON risk_management(business_type);
    CREATE INDEX IF NOT EXISTS idx_user_business_domain_user_id ON user_business_domain(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_business_domain_business_type ON user_business_domain(business_type);
    CREATE INDEX IF NOT EXISTS idx_business_task_baseline_domain ON business_task_baseline(domain);
    CREATE INDEX IF NOT EXISTS idx_labor_cost_role ON labor_cost(role);
    CREATE INDEX IF NOT EXISTS idx_roi_metrics_period ON roi_metrics(period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_adoption_funnel_stage ON adoption_funnel_events(stage);
    CREATE INDEX IF NOT EXISTS idx_adoption_funnel_time ON adoption_funnel_events(event_time);
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

async function createDefaultPortalUsers(client: any) {
  await client.query(`
    INSERT INTO portal_users (userid, password_hash, full_name, is_admin, is_active, company_code)
    VALUES
      ('portal-admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '포털 관리자', true, true, 'SKN'),
      ('portal-user', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '포털 사용자', false, true, 'SKN')
    ON CONFLICT (userid)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      is_active = true;
  `);

  await client.query(`
    INSERT INTO portal_user_roles (user_id, role_name)
    SELECT id, 'admin' FROM portal_users WHERE userid = 'portal-admin'
    ON CONFLICT (user_id, role_name) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO portal_user_roles (user_id, role_name)
    SELECT id, 'user' FROM portal_users WHERE userid = 'portal-user'
    ON CONFLICT (user_id, role_name) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO portal_role_matrix (company_code, role_name, permissions)
    VALUES
      ('SKN', 'admin', '["portal:read","portal:write","metrics:write","roadmap:edit","settings:edit"]'::jsonb),
      ('SKN', 'user', '["portal:read"]'::jsonb)
    ON CONFLICT (company_code, role_name)
    DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = CURRENT_TIMESTAMP;
  `);

  console.log('포털 기본 계정/권한 매트릭스 설정 완료');
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
      name: 'OrderBotcommerce',
      description: 'SD 관련 프로세스 에이전트',
      type: 'SD',
      status: 'running',
      env_config: { model: 'gpt-4o-mini', region: 'local' },
      max_concurrency: 4,
      tags: ['sd', 'ops'],
      level2Code: 'SD.1.3'
    },
    {
      name: 'SupportGPTsupport',
      description: 'BC 관련 프로세스 에이전트',
      type: 'BC',
      status: 'running',
      env_config: { runtime: 'node', retries: 2 },
      max_concurrency: 2,
      tags: ['bc', 'support'],
      level2Code: 'BC.1.3'
    },
    {
      name: 'PricingAIanalytics',
      description: '통합 관련 프로세스 에이전트',
      type: 'COMMON',
      status: 'active',
      env_config: { threshold: 0.2 },
      max_concurrency: 1,
      tags: ['common', 'analytics'],
      level2Code: 'CM.1.1'
    }
  ];

  const agentIds: number[] = [];
  for (const agent of agents) {
    const level2Result = await client.query('SELECT id FROM business_level2 WHERE level2_code = $1 LIMIT 1', [agent.level2Code]);
    const businessLevel2Id = level2Result.rows?.[0]?.id || null;

    const result = await client.query(
      `INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags, is_active, business_level2_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING id`,
      [
        agent.name,
        agent.description,
        agent.type,
        agent.status,
        JSON.stringify(agent.env_config),
        agent.max_concurrency,
        JSON.stringify(agent.tags),
        businessLevel2Id
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
