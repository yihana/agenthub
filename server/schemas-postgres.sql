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
    agent_id INTEGER REFERENCES agents(id),
    business_type VARCHAR(100),
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
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    role_type VARCHAR(50) DEFAULT 'user',
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

-- 포털 사용자 관리 테이블
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

CREATE TABLE IF NOT EXISTS portal_user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES portal_users(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_name)
);

CREATE TABLE IF NOT EXISTS portal_role_matrix (
    id SERIAL PRIMARY KEY,
    company_code VARCHAR(10) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_code, role_name)
);

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

-- 사용자 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_userid ON users(userid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role_type ON users(role_type);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

-- 로그인 이력 테이블 인덱스
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
    business_type VARCHAR(100),
    owner_user_id VARCHAR(100),
    version VARCHAR(50),
    model_name VARCHAR(100),
    language VARCHAR(50),
    supported_modes VARCHAR(100),
    endpoint_url VARCHAR(255),
    exec_mode VARCHAR(50),
    suite VARCHAR(30),
    risk VARCHAR(30),
    capability TEXT,
    runtime_state VARCHAR(30),
    runtime_errors INTEGER DEFAULT 0,
    customer_count INTEGER DEFAULT 0,
    calls_30d INTEGER DEFAULT 0,
    business_level2_id INTEGER,
    status VARCHAR(50) DEFAULT 'inactive',
    env_config JSONB,
    max_concurrency INTEGER DEFAULT 1,
    tags JSONB,
    last_heartbeat TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_system_mappings (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    system_cd VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, system_cd)
);

CREATE TABLE IF NOT EXISTS agent_erp_auth (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    system_cd VARCHAR(50) NOT NULL,
    sys_auth_cd VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, system_cd, sys_auth_cd)
);

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

CREATE TABLE IF NOT EXISTS user_job_role (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_name)
);

CREATE TABLE IF NOT EXISTS user_business_domain (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    business_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, business_type)
);

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

CREATE TABLE IF NOT EXISTS adoption_funnel_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    stage VARCHAR(50) NOT NULL,
    business_type VARCHAR(100),
    agent_type VARCHAR(100),
    metadata JSONB,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_period ON human_ai_collaboration_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_agent_type ON human_ai_collaboration_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_human_ai_collaboration_business_type ON human_ai_collaboration_metrics(business_type);
CREATE INDEX IF NOT EXISTS idx_risk_management_created_at ON risk_management(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_management_agent_type ON risk_management(agent_type);
CREATE INDEX IF NOT EXISTS idx_risk_management_business_type ON risk_management(business_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_assigned_agent_id ON job_queue(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 에이전트 샘플 데이터 (로컬/개발용)
INSERT INTO companies (name, description)
SELECT 'Hana Tech', 'HANA 기반 운영 본부'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Hana Tech');

INSERT INTO companies (name, description)
SELECT 'Nova Systems', '운영 자동화 센터'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Nova Systems');

INSERT INTO companies (name, description)
SELECT 'Zen Finance', '금융 서비스 운영팀'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Zen Finance');

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
INSERT INTO users (userid, password_hash, full_name, company_id, role_type, is_admin, is_active)
VALUES (
  'admin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '시스템 관리자',
  (SELECT id FROM companies WHERE name = 'Hana Tech'),
  'system_admin',
  true,
  true
)
ON CONFLICT (userid) 
DO UPDATE SET 
  password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  is_admin = true,
  is_active = true,
  company_id = (SELECT id FROM companies WHERE name = 'Hana Tech'),
  role_type = 'system_admin';

INSERT INTO users (userid, password_hash, full_name, company_id, role_type, is_admin, is_active)
SELECT
  'operator_admin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '운영 관리자',
  (SELECT id FROM companies WHERE name = 'Nova Systems'),
  'operator_admin',
  false,
  true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE userid = 'operator_admin');

INSERT INTO users (userid, password_hash, full_name, company_id, role_type, is_admin, is_active)
SELECT
  'operator',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '운영자',
  (SELECT id FROM companies WHERE name = 'Nova Systems'),
  'operator',
  false,
  true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE userid = 'operator');

INSERT INTO users (userid, password_hash, full_name, company_id, role_type, is_admin, is_active)
SELECT
  'user',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  '일반 사용자',
  (SELECT id FROM companies WHERE name = 'Zen Finance'),
  'user',
  false,
  true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE userid = 'user');

INSERT INTO portal_metric_inputs (metric_key, value, unit, description, business_type, agent_type)
SELECT 'baseline_minutes_per_request', 12, 'minute', '요청 1건당 기준 처리 시간 (분)', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM portal_metric_inputs
  WHERE metric_key = 'baseline_minutes_per_request' AND business_type IS NULL AND agent_type IS NULL
);

INSERT INTO portal_metric_inputs (metric_key, value, unit, description, business_type, agent_type)
SELECT 'cost_per_hour', 45000, 'KRW', '시간당 인건비 단가', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM portal_metric_inputs
  WHERE metric_key = 'cost_per_hour' AND business_type IS NULL AND agent_type IS NULL
);

INSERT INTO portal_metric_inputs (metric_key, value, unit, description, business_type, agent_type)
SELECT 'sla_latency_ms', 2000, 'ms', 'SLA 기준 응답 시간 (ms)', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM portal_metric_inputs
  WHERE metric_key = 'sla_latency_ms' AND business_type IS NULL AND agent_type IS NULL
);

INSERT INTO business_task_baseline (task_code, domain, before_time_min, before_cost, description)
SELECT 'FIN-REPORT', 'Finance', 18, 120000, '재무 보고서 자동화 기준'
WHERE NOT EXISTS (SELECT 1 FROM business_task_baseline WHERE task_code = 'FIN-REPORT' AND domain = 'Finance');

INSERT INTO business_task_baseline (task_code, domain, before_time_min, before_cost, description)
SELECT 'HR-ONBOARD', 'HR', 25, 150000, '온보딩 업무 기준'
WHERE NOT EXISTS (SELECT 1 FROM business_task_baseline WHERE task_code = 'HR-ONBOARD' AND domain = 'HR');

INSERT INTO labor_cost (role, hourly_cost, currency, business_type)
SELECT '재무 분석가', 52000, 'KRW', 'Finance'
WHERE NOT EXISTS (SELECT 1 FROM labor_cost WHERE role = '재무 분석가' AND business_type = 'Finance');

INSERT INTO labor_cost (role, hourly_cost, currency, business_type)
SELECT 'HR 매니저', 48000, 'KRW', 'HR'
WHERE NOT EXISTS (SELECT 1 FROM labor_cost WHERE role = 'HR 매니저' AND business_type = 'HR');

INSERT INTO ear_requests (request_title, request_content, template_id, form_data, attachments, agent_id, business_type, status, created_by, created_at, updated_at)
SELECT
  '예산 리포트 생성',
  '주간 예산 분석 요청',
  NULL,
  NULL,
  NULL,
  a.id,
  'Finance',
  'completed',
  'operator_admin',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM agents a
WHERE a.name = 'Agent Alpha'
  AND NOT EXISTS (SELECT 1 FROM ear_requests WHERE request_title = '예산 리포트 생성');

INSERT INTO ear_requests (request_title, request_content, template_id, form_data, attachments, agent_id, business_type, status, created_by, created_at, updated_at)
SELECT
  '인사 정책 FAQ',
  '신규 정책 Q&A 요청',
  NULL,
  NULL,
  NULL,
  a.id,
  'HR',
  'pending',
  'operator',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
FROM agents a
WHERE a.name = 'Agent Beta'
  AND NOT EXISTS (SELECT 1 FROM ear_requests WHERE request_title = '인사 정책 FAQ');

INSERT INTO ear_requests (request_title, request_content, template_id, form_data, attachments, agent_id, business_type, status, created_by, created_at, updated_at)
SELECT
  '고객 응대 요약',
  '이번 주 고객 이슈 요약 요청',
  NULL,
  NULL,
  NULL,
  a.id,
  'Customer',
  'in_progress',
  'operator',
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours'
FROM agents a
WHERE a.name = 'Agent Beta'
  AND NOT EXISTS (SELECT 1 FROM ear_requests WHERE request_title = '고객 응대 요약');

INSERT INTO agent_tasks (agent_id, job_id, status, received_at, started_at, finished_at, result)
SELECT a.id, 'job-1003', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', NOW() - INTERVAL '22 hours', '{"note":"done"}'::jsonb
FROM agents a
WHERE a.name = 'Agent Beta'
  AND NOT EXISTS (SELECT 1 FROM agent_tasks WHERE job_id = 'job-1003');

INSERT INTO agent_tasks (agent_id, job_id, status, received_at, started_at, finished_at, result)
SELECT a.id, 'job-1004', 'failed', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '6 hours', '{"error":"timeout"}'::jsonb
FROM agents a
WHERE a.name = 'Agent Gamma'
  AND NOT EXISTS (SELECT 1 FROM agent_tasks WHERE job_id = 'job-1004');

INSERT INTO adoption_funnel_events (user_id, stage, business_type, agent_type, metadata, event_time)
SELECT 'operator_admin', 'visit', 'Finance', 'LLM', '{"channel":"portal"}'::jsonb, NOW() - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT 1 FROM adoption_funnel_events WHERE user_id = 'operator_admin' AND stage = 'visit');

INSERT INTO adoption_funnel_events (user_id, stage, business_type, agent_type, metadata, event_time)
SELECT 'operator_admin', 'activate', 'Finance', 'LLM', '{"channel":"portal"}'::jsonb, NOW() - INTERVAL '4 days'
WHERE NOT EXISTS (SELECT 1 FROM adoption_funnel_events WHERE user_id = 'operator_admin' AND stage = 'activate');

INSERT INTO adoption_funnel_events (user_id, stage, business_type, agent_type, metadata, event_time)
SELECT 'operator', 'trial', 'HR', 'Automation', '{"channel":"portal"}'::jsonb, NOW() - INTERVAL '3 days'
WHERE NOT EXISTS (SELECT 1 FROM adoption_funnel_events WHERE user_id = 'operator' AND stage = 'trial');

INSERT INTO adoption_funnel_events (user_id, stage, business_type, agent_type, metadata, event_time)
SELECT 'user', 'retain', 'Customer', 'Automation', '{"channel":"portal"}'::jsonb, NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM adoption_funnel_events WHERE user_id = 'user' AND stage = 'retain');

INSERT INTO user_business_domain (user_id, business_type)
SELECT 'operator_admin', 'Finance'
WHERE NOT EXISTS (SELECT 1 FROM user_business_domain WHERE user_id = 'operator_admin' AND business_type = 'Finance');

INSERT INTO user_business_domain (user_id, business_type)
SELECT 'operator', 'HR'
WHERE NOT EXISTS (SELECT 1 FROM user_business_domain WHERE user_id = 'operator' AND business_type = 'HR');

INSERT INTO user_business_domain (user_id, business_type)
SELECT 'user', 'Customer'
WHERE NOT EXISTS (SELECT 1 FROM user_business_domain WHERE user_id = 'user' AND business_type = 'Customer');
--   is_active = true;

-- -- 포털 기본 계정 생성 (비밀번호: admin123)
-- INSERT INTO portal_users (userid, password_hash, full_name, is_admin, is_active, company_code)
-- VALUES
--   ('portal-admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '포털 관리자', true, true, 'SKN'),
--   ('portal-user', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '포털 사용자', false, true, 'SKN')
-- ON CONFLICT (userid)
-- DO UPDATE SET
--   password_hash = EXCLUDED.password_hash,
--   is_active = true;

-- INSERT INTO portal_user_roles (user_id, role_name)
-- SELECT id, 'admin' FROM portal_users WHERE userid = 'portal-admin'
-- ON CONFLICT (user_id, role_name) DO NOTHING;

-- INSERT INTO portal_user_roles (user_id, role_name)
-- SELECT id, 'user' FROM portal_users WHERE userid = 'portal-user'
-- ON CONFLICT (user_id, role_name) DO NOTHING;

-- INSERT INTO portal_role_matrix (company_code, role_name, permissions)
-- VALUES
--   ('SKN', 'admin', '["portal:read","portal:write","metrics:write","roadmap:edit","settings:edit"]'::jsonb),
--   ('SKN', 'user', '["portal:read"]'::jsonb)
-- ON CONFLICT (company_code, role_name)
-- DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = CURRENT_TIMESTAMP;
