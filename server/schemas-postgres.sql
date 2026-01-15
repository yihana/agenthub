-- ============================================
-- PostgreSQL 전용 스키마 파일
-- ============================================
-- 주의: 이 파일은 PostgreSQL용입니다.
-- HANA DB를 사용하는 경우, 테이블은 자동으로 생성됩니다 (db-hana.ts 참조).
-- ============================================

-- PostgreSQL + pgvector 스키마
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;


-- 채팅 히스토리 테이블
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at);


-- RAG 문서관리 테이블
CREATE TABLE IF NOT EXISTS rag_documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_type VARCHAR(100),
    file_size BIGINT,
    text_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES rag_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(3072), -- text-embedding-3-large 차원
    page_number INTEGER, -- PDF 페이지 번호 (PDF가 아닌 경우 NULL)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RAG 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_documents_name ON rag_documents(name);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_vector ON rag_chunks USING ivfflat (embedding vector_cosine_ops);

-- EAR 요청등록 관련 테이블
CREATE TABLE IF NOT EXISTS ear_keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ear_request_templates (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER REFERENCES ear_keywords(id) ON DELETE CASCADE,
    template_name VARCHAR(200) NOT NULL,
    template_description TEXT,
    required_fields JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(keyword_id, template_name)
);

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

-- EAR 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_ear_keywords_keyword ON ear_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_ear_keywords_category ON ear_keywords(category);
CREATE INDEX IF NOT EXISTS idx_ear_request_templates_keyword_id ON ear_request_templates(keyword_id);
CREATE INDEX IF NOT EXISTS idx_ear_requests_status ON ear_requests(status);
CREATE INDEX IF NOT EXISTS idx_ear_requests_created_at ON ear_requests(created_at);

-- 개선요청 관련 테이블
CREATE TABLE IF NOT EXISTS improvement_requests (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    chat_history_id INTEGER REFERENCES chat_history(id) ON DELETE CASCADE,
    selected_text TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- '응답품질', '말도안되는 답변', '오류 개선'
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'rejected'
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS improvement_responses (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES improvement_requests(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    responded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 개선요청 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_improvement_requests_session_id ON improvement_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_improvement_requests_chat_history_id ON improvement_requests(chat_history_id);
CREATE INDEX IF NOT EXISTS idx_improvement_requests_category ON improvement_requests(category);
CREATE INDEX IF NOT EXISTS idx_improvement_requests_status ON improvement_requests(status);
CREATE INDEX IF NOT EXISTS idx_improvement_requests_created_at ON improvement_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_improvement_responses_request_id ON improvement_responses(request_id);

-- 사용자 관리 테이블
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
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 로그인 이력 테이블
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    userid VARCHAR(100) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    login_status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'locked'
    failure_reason VARCHAR(100) NULL
);

-- 사용자 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

-- 로그인 이력 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_userid ON login_history(userid);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);
CREATE INDEX IF NOT EXISTS idx_login_history_login_status ON login_history(login_status);

-- 인터페이스 자동화 관련 테이블
CREATE TABLE IF NOT EXISTS company_interfaces (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    api_url TEXT NOT NULL,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none', -- 'none', 'bearer', 'basic', 'oauth2'
    auth_config JSONB,
    api_fields JSONB,
    field_mappings JSONB,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'error'
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interface_history (
    id SERIAL PRIMARY KEY,
    interface_id INTEGER REFERENCES company_interfaces(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    changes JSONB,
    previous_state JSONB,
    changed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standard_batch_services (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    service_config JSONB,
    generated_code TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인터페이스 자동화 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_company_interfaces_company_name ON company_interfaces(company_name);
CREATE INDEX IF NOT EXISTS idx_company_interfaces_status ON company_interfaces(status);
CREATE INDEX IF NOT EXISTS idx_company_interfaces_created_at ON company_interfaces(created_at);
CREATE INDEX IF NOT EXISTS idx_interface_history_interface_id ON interface_history(interface_id);
CREATE INDEX IF NOT EXISTS idx_interface_history_change_type ON interface_history(change_type);
CREATE INDEX IF NOT EXISTS idx_interface_history_created_at ON interface_history(created_at);
CREATE INDEX IF NOT EXISTS idx_standard_batch_services_company_name ON standard_batch_services(company_name);
CREATE INDEX IF NOT EXISTS idx_standard_batch_services_status ON standard_batch_services(status);

-- 시스템 개선요청 테이블 (독립적인 개선요청, 채팅 무관)
CREATE TABLE IF NOT EXISTS system_improvement_requests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    attachments JSONB, -- 첨부파일 정보 [{originalName, filename, path, size, mimetype}, ...]
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'rejected'
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_improvement_responses (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES system_improvement_requests(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    responded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 개선요청 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_system_improvement_requests_status ON system_improvement_requests(status);
CREATE INDEX IF NOT EXISTS idx_system_improvement_requests_created_by ON system_improvement_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_system_improvement_requests_created_at ON system_improvement_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_system_improvement_responses_request_id ON system_improvement_responses(request_id);

-- IP 화이트리스트 테이블
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP 화이트리스트 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip_address ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_is_active ON ip_whitelist(is_active);

-- 메뉴 테이블
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

-- 메뉴 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_menus_parent_id ON menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_menus_menu_code ON menus(menu_code);
CREATE INDEX IF NOT EXISTS idx_menus_is_active ON menus(is_active);
CREATE INDEX IF NOT EXISTS idx_menus_display_order ON menus(display_order);

-- 사용자 그룹별 메뉴 매핑 테이블
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

-- 사용자 그룹별 메뉴 매핑 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_group_name ON group_menu_mappings(group_name);
CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_menu_id ON group_menu_mappings(menu_id);
CREATE INDEX IF NOT EXISTS idx_group_menu_mappings_is_active ON group_menu_mappings(is_active);

-- 입력보안 설정 테이블
CREATE TABLE IF NOT EXISTS input_security_settings (
    id SERIAL PRIMARY KEY,
    setting_type VARCHAR(50) NOT NULL, -- 'personal_info', 'profanity'
    setting_key VARCHAR(100) NOT NULL, -- 'ssn', 'phone', 'email', 'profanity'
    setting_name VARCHAR(200) NOT NULL, -- '주민등록번호', '전화번호', '이메일', '욕설'
    is_enabled BOOLEAN DEFAULT true,
    pattern TEXT, -- 정규식 패턴 (개인정보용)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(setting_type, setting_key)
);

-- 욕설 패턴 테이블
CREATE TABLE IF NOT EXISTS profanity_patterns (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(500) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 입력보안 설정 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_input_security_settings_type ON input_security_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_input_security_settings_key ON input_security_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_input_security_settings_enabled ON input_security_settings(is_enabled);
CREATE INDEX IF NOT EXISTS idx_profanity_patterns_active ON profanity_patterns(is_active);

-- 출력보안 패턴 테이블
CREATE TABLE IF NOT EXISTS output_security_patterns (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(500) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 출력보안 설정 테이블
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

-- 출력보안 설정 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_output_security_patterns_active ON output_security_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_output_security_settings_enabled ON output_security_settings(is_enabled);

-- RAG Agent 관리 테이블
CREATE TABLE IF NOT EXISTS rag_agents_info (
    id SERIAL PRIMARY KEY,
    company_code VARCHAR(50) NOT NULL,
    agent_description VARCHAR(500),
    agent_url VARCHAR(500) NOT NULL,
    agent_token VARCHAR(500) NOT NULL,
    is_active VARCHAR(1) DEFAULT 'N' CHECK (is_active IN ('Y', 'N')),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RAG Agent 관리 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_rag_agents_info_company_code ON rag_agents_info(company_code);
CREATE INDEX IF NOT EXISTS idx_rag_agents_info_is_active ON rag_agents_info(is_active);
CREATE INDEX IF NOT EXISTS idx_rag_agents_info_company_active ON rag_agents_info(company_code, is_active);

-- 에이전트 라이프사이클 관리 테이블
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

CREATE TABLE IF NOT EXISTS agent_roles (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    UNIQUE(agent_id, role_name)
);

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

CREATE TABLE IF NOT EXISTS job_queue (
    job_id VARCHAR(100) PRIMARY KEY,
    payload JSONB,
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'queued',
    assigned_agent_id INTEGER REFERENCES agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    event_type VARCHAR(100),
    target_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

-- 에이전트 라이프사이클 관리 테이블 인덱스
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

-- 에이전트 샘플 데이터 (로컬/개발용)
INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags, is_active)
SELECT 'Agent Alpha', '검색 기반 응답 에이전트', 'LLM', 'active', '{"model":"gpt-4o-mini","region":"local"}', 4, '["search","rag"]', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Agent Alpha');

INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags, is_active)
SELECT 'Agent Beta', '백오피스 자동화 에이전트', 'Automation', 'running', '{"runtime":"node","retries":2}', 2, '["automation"]', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Agent Beta');

INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags, is_active)
SELECT 'Agent Gamma', '오류 감지 테스트 에이전트', 'Monitor', 'error', '{"threshold":0.2}', 1, '["monitoring","ops"]', true
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE name = 'Agent Gamma');

INSERT INTO agent_roles (agent_id, role_name)
SELECT a.id, r.role_name
FROM agents a
JOIN (VALUES
  ('Agent Alpha', 'retrieval'),
  ('Agent Alpha', 'answering'),
  ('Agent Beta', 'workflow'),
  ('Agent Beta', 'scheduler'),
  ('Agent Gamma', 'monitoring')
) AS r(agent_name, role_name)
  ON a.name = r.agent_name
WHERE NOT EXISTS (
  SELECT 1 FROM agent_roles ar WHERE ar.agent_id = a.id AND ar.role_name = r.role_name
);

INSERT INTO agent_metrics (agent_id, timestamp, cpu_usage, memory_usage, requests_processed, avg_latency, error_rate, queue_time)
SELECT a.id, NOW() - INTERVAL '15 minutes', 42.5, 61.2, 120, 210.4, 1.2, 12.5
FROM agents a
WHERE a.name = 'Agent Alpha'
  AND NOT EXISTS (
    SELECT 1 FROM agent_metrics m WHERE m.agent_id = a.id AND m.timestamp >= NOW() - INTERVAL '16 minutes'
  );

INSERT INTO agent_metrics (agent_id, timestamp, cpu_usage, memory_usage, requests_processed, avg_latency, error_rate, queue_time)
SELECT a.id, NOW() - INTERVAL '5 minutes', 55.1, 68.7, 140, 185.7, 0.8, 9.4
FROM agents a
WHERE a.name = 'Agent Beta'
  AND NOT EXISTS (
    SELECT 1 FROM agent_metrics m WHERE m.agent_id = a.id AND m.timestamp >= NOW() - INTERVAL '6 minutes'
  );

INSERT INTO job_queue (job_id, payload, priority, status, assigned_agent_id)
SELECT 'job-1001', '{"task":"sample","jobId":"job-1001"}'::jsonb, 1, 'queued', a.id
FROM agents a
WHERE a.name = 'Agent Beta'
  AND NOT EXISTS (SELECT 1 FROM job_queue WHERE job_id = 'job-1001');

INSERT INTO job_queue (job_id, payload, priority, status, assigned_agent_id)
SELECT 'job-1002', '{"task":"sample","jobId":"job-1002"}'::jsonb, 2, 'running', a.id
FROM agents a
WHERE a.name = 'Agent Alpha'
  AND NOT EXISTS (SELECT 1 FROM job_queue WHERE job_id = 'job-1002');

INSERT INTO agent_tasks (agent_id, job_id, status, received_at, started_at, result)
SELECT a.id, 'job-1002', 'running', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '10 minutes', '{"note":"processing"}'::jsonb
FROM agents a
WHERE a.name = 'Agent Alpha'
  AND NOT EXISTS (SELECT 1 FROM agent_tasks WHERE job_id = 'job-1002');

-- 기본 관리자 계정 생성 (비밀번호: admin123)
-- 기존 관리자 계정이 있으면 비밀번호만 업데이트
INSERT INTO users (userid, password_hash, full_name, is_admin, is_active) 
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '시스템 관리자', true, true)
ON CONFLICT (userid) 
DO UPDATE SET 
  password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  is_admin = true,
  is_active = true;
