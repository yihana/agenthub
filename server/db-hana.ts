import dotenv from 'dotenv';

dotenv.config();
const SEED_AGENT_DATA = process.env.SEED_AGENT_DATA === 'true' || process.env.LOCAL_ONLY === 'true';

let hanaClient: any = null;
let hanaConnection: any = null;
let xsenv: any = null;

// HANA DB 클라이언트 로드
try {
  hanaClient = require('@sap/hana-client');
} catch (error) {
  console.error('❌ HANA DB 클라이언트 로드 실패. @sap/hana-client 패키지를 설치해주세요.');
  throw error;
}

// @sap/xsenv 로드 (BTP Cloud Foundry 환경에서 사용)
try {
  xsenv = require('@sap/xsenv');
  console.log('✅ @sap/xsenv 로드 완료');
} catch (error) {
  console.warn('⚠️  @sap/xsenv 로드 실패. BTP 환경에서는 필수입니다.');
}

// VCAP_SERVICES에서 HANA 연결 정보 추출 (BTP Cloud Foundry용)
function getHANACredentials() {
  // 1. @sap/xsenv 사용 (BTP 권장 방식)
  if (xsenv && process.env.VCAP_SERVICES) {
    try {
      console.log('🔍 @sap/xsenv를 사용하여 HANA 서비스 검색 중...');
      
      // VCAP_SERVICES 로드
      xsenv.loadEnv();
      
      // HANA 서비스 찾기 - 다양한 서비스 타입 지원
      const serviceNames = ['hana', 'hanatrial', 'hana-cloud'];
      let hanaCredentials = null;
      
      for (const serviceName of serviceNames) {
        try {
          const services = xsenv.filterServices({ label: serviceName });
          if (services && services.length > 0) {
            hanaCredentials = services[0].credentials;
            console.log(`✅ ${serviceName} 서비스 찾음`);
            break;
          }
        } catch (e) {
          // 서비스가 없으면 계속 시도
          continue;
        }
      }
      
      // 서비스 이름으로 직접 찾기 (manifest.yml의 services 섹션 이름)
      if (!hanaCredentials) {
        try {
          const services = xsenv.getServices({
            hana: { tag: 'hana' }
          });
          if (services.hana) {
            hanaCredentials = services.hana;
            console.log('✅ 태그로 HANA 서비스 찾음');
          }
        } catch (e) {
          console.warn('⚠️  태그로 서비스 검색 실패:', e);
        }
      }
      
      if (hanaCredentials) {
        const creds = hanaCredentials;
        
        // Credentials 구조 확인용 로그 (민감한 정보 제외)
        const credInfo = {
          hasHost: !!creds.host,
          hasPort: !!creds.port,
          hasUser: !!creds.user || !!creds.username,
          hasPassword: !!creds.password,
          hasCertificate: !!creds.certificate,
          hasKey: !!creds.key,
          hasCa: !!creds.ca,
          hasSchema: !!creds.schema,
          hasDriver: !!creds.driver,
          hasUrl: !!creds.url,
          hasUaa: !!creds.uaa,
          allKeys: Object.keys(creds).join(', ')
        };
        console.log('📋 Credentials 구조:', JSON.stringify(credInfo));
        
        // 연결 옵션 구성
        const connOptions: any = {
          serverNode: `${creds.host}:${creds.port}`,
          encrypt: true,
          sslValidateCertificate: false,
          sslCryptoProvider: 'openssl'
        };
        
        // 인증 방식 결정
        let authMethodFound = false;
        
        // 1) X.509 인증서 기반 (가장 권장)
        if (creds.certificate && creds.key) {
          console.log('🔐 X.509 인증서 방식 사용');
          connOptions.sslCert = creds.certificate;
          connOptions.sslKey = creds.key;
          if (creds.ca) {
            connOptions.sslCa = creds.ca;
          }
          authMethodFound = true;
        }
        // 2) User/Password 방식
        else if (creds.user || creds.username) {
          console.log('🔑 User/Password 방식 사용');
          connOptions.uid = creds.user || creds.username;
          connOptions.pwd = creds.password;
          authMethodFound = true;
        }
        // 3) JWT 토큰 기반 인증 (UAA 사용 시)
        else if (creds.uaa) {
          console.log('🎫 UAA JWT 토큰 방식 사용 (아직 미구현 - 서비스 키 재생성 필요)');
          console.warn('⚠️  현재 credential에 user/password 또는 certificate가 없습니다.');
          console.warn('⚠️  SAP BTP Cockpit에서 서비스 키를 재생성하거나 binding을 다시 해주세요.');
          console.warn('⚠️  서비스 키 생성 시 "certificate" 또는 "password" 옵션을 명시적으로 선택해야 합니다.');
        }
        
        if (!authMethodFound) {
          throw new Error('인증 정보를 찾을 수 없습니다. user/password 또는 certificate/key가 필요합니다.');
        }
        
        // 스키마 설정
        if (creds.schema) {
          connOptions.currentSchema = creds.schema;
        } else {
          connOptions.currentSchema = 'EAR'; // 기본 스키마
        }
        
        const connInfo = {
          serverNode: connOptions.serverNode,
          encrypt: connOptions.encrypt,
          sslValidateCertificate: connOptions.sslValidateCertificate,
          sslCryptoProvider: connOptions.sslCryptoProvider,
          hasSslCert: !!connOptions.sslCert,
          hasSslKey: !!connOptions.sslKey,
          hasSslCa: !!connOptions.sslCa,
          hasUid: !!connOptions.uid,
          schema: connOptions.currentSchema
        };
        console.log('🔌 HANA 연결 옵션:', JSON.stringify(connInfo));
        
        return connOptions;
      }
    } catch (error) {
      console.warn('⚠️  @sap/xsenv 사용 중 오류:', error);
    }
  }
  
  // 2. 직접 VCAP_SERVICES 파싱 (fallback)
  if (process.env.VCAP_SERVICES) {
    try {
      console.log('🔍 직접 VCAP_SERVICES 파싱 시도...');
      const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      
      // HANA 서비스 찾기
      let hanaService = null;
      const serviceTypes = ['hana', 'hana-cloud', 'hanatrial'];
      
      for (const serviceType of serviceTypes) {
        if (vcapServices[serviceType] && vcapServices[serviceType].length > 0) {
          hanaService = vcapServices[serviceType][0];
          console.log(`✅ ${serviceType} 서비스 찾음`);
          break;
        }
      }
      
      if (hanaService && hanaService.credentials) {
        const creds = hanaService.credentials;
        
        const connOptions: any = {
          serverNode: `${creds.host}:${creds.port}`,
          encrypt: true,
          sslValidateCertificate: false,
          sslCryptoProvider: 'openssl'
        };
        
        // 인증 방식
        if (creds.certificate && creds.key) {
          connOptions.sslCert = creds.certificate;
          connOptions.sslKey = creds.key;
          if (creds.ca) connOptions.sslCa = creds.ca;
        } else if (creds.user || creds.username) {
          connOptions.uid = creds.user || creds.username;
          connOptions.pwd = creds.password;
        } else {
          throw new Error('인증 정보 없음');
        }
        
        connOptions.currentSchema = creds.schema || 'EAR';
        
        return connOptions;
      }
    } catch (error) {
      console.warn('⚠️  VCAP_SERVICES 파싱 오류:', error);
    }
  }
  
  // 3. 환경 변수에서 직접 가져오기 (로컬 개발 환경)
  if (process.env.HANA_HOST) {
    console.log('✅ 환경 변수에서 HANA 연결 정보를 사용합니다.');
    return {
      serverNode: `${process.env.HANA_HOST}:${process.env.HANA_PORT || '443'}`,
      uid: process.env.HANA_USER,
      pwd: process.env.HANA_PASSWORD,
      encrypt: process.env.HANA_ENCRYPT === 'true',
      sslValidateCertificate: process.env.HANA_SSL_VALIDATE_CERTIFICATE === 'true',
      currentSchema: process.env.HANA_SCHEMA || 'EAR'
    };
  }
  
  throw new Error('HANA 연결 정보를 찾을 수 없습니다. VCAP_SERVICES 또는 HANA_HOST 환경 변수를 설정해주세요.');
}

// HANA DB 연결
async function connectHANA() {
  if (!hanaClient) {
    throw new Error('HANA DB 클라이언트가 초기화되지 않았습니다.');
  }

  return new Promise((resolve, reject) => {
    const conn = hanaClient.createConnection();
    
    try {
      const connOptions = getHANACredentials();
      
      console.log(`🔌 HANA DB 연결 시도: ${connOptions.serverNode}`);
      if (connOptions.schema) {
        console.log(`   스키마: ${connOptions.schema}`);
      }

      conn.connect(connOptions, (err: any) => {
        if (err) {
          console.error('❌ HANA DB 연결 오류:', err);
          reject(err);
        } else {
          console.log('✅ HANA DB 연결 성공!');
          resolve(conn);
        }
      });
    } catch (error) {
      console.error('❌ HANA 연결 설정 오류:', error);
      reject(error);
    }
  });
}

// 쿼리 실행
export async function query(text: string, params?: any[]): Promise<any> {
  if (!hanaConnection) {
    hanaConnection = await connectHANA();
  }

  return new Promise((resolve, reject) => {
    hanaConnection.exec(text, params || [], (err: any, result: any) => {
      if (err) {
        // "already indexed" 오류는 경고로만 표시 (인덱스 중복 생성 시도는 정상적인 경우)
        if (err.message && err.message.includes('already indexed')) {
          console.log('ℹ️  인덱스가 이미 존재합니다:', text.substring(0, 100));
        } else {
          console.error('❌ HANA 쿼리 실행 오류:', err.message);
          console.error('쿼리:', text);
          console.error('파라미터:', params);
        }
        reject(err);
      } else {
        // 결과를 배열로 변환
        let resultArray = [];
        if (Array.isArray(result)) {
          resultArray = result;
        } else if (result) {
          resultArray = [result];
        }
        
        // 대문자 키를 소문자로 변환
        const normalizedRows = resultArray.map((row: any) => {
          const normalizedRow: any = {};
          for (const key in row) {
            normalizedRow[key.toLowerCase()] = row[key];
          }
          return normalizedRow;
        });
        
        resolve({
          rows: normalizedRows,
          rowCount: normalizedRows.length
        });
      }
    });
  });
}

// 데이터베이스 초기화
export async function initializeDatabase() {
  try {
    console.log('HANA DB 연결 테스트 중...');
    
    if (!hanaConnection) {
      hanaConnection = await connectHANA();
    }
    
    // 주의: 테이블 삭제 로직 제거 (데이터 보존)
    // 최초 1회만 수동으로 dropExistingTables() 호출 필요
    
    // 테이블 생성 (이미 존재하면 스킵)
    await createTables();
    await applyPortalDashboardMigrations();
    
    

// 인덱스 생성 (이미 존재하면 스킵)
    await createIndexes();
    
    // EAR 초기 데이터 (이미 존재하면 스킵)
    await initializeEARData();
    
    // 기본 관리자 계정 (이미 존재하면 업데이트)
    await createDefaultAdmin();

    // 포털 기본 계정/권한 매트릭스
    await createDefaultPortalUsers();
    
    // IP 화이트리스트 초기화
    await initializeIpWhitelist();
    
    // 메뉴 초기화
    await initializeMenus();

    // 에이전트 샘플 데이터 초기화 (옵션)
    if (SEED_AGENT_DATA) {
      await seedAgentData();
    }

    await seedPortalBaselines();
    await seedBusinessDomainHierarchy();
    
    // 입력보안 설정 초기화
    await initializeInputSecurity();
    
    // 출력보안 설정 초기화
    await initializeOutputSecurity();
    
    console.log('데이터베이스 초기화 완료!');
  } catch (error) {
    console.error('HANA DB 초기화 오류:', error);
    throw error;
  }
}

// 테이블 초기화 (수동 호출용 - 개발 시에만 사용)
export async function resetDatabase() {
  console.warn('⚠️  모든 데이터가 삭제됩니다!');
  await dropExistingTables();
  await createTables();
  await createIndexes();
  await initializeEARData();
  await createDefaultAdmin();
  await createDefaultPortalUsers();
  await initializeIpWhitelist();
  await initializeMenus();
  if (SEED_AGENT_DATA) {
    await seedAgentData();
  }
  console.log('✅ 데이터베이스 리셋 완료');
}

// 기존 테이블 삭제
async function dropExistingTables() {
  const tables = [
    'system_improvement_responses',
    'system_improvement_requests',
    'login_history',
    'portal_login_history',
    'portal_user_roles',
    'portal_role_matrix',
    'portal_users',
    'improvement_responses',
    'improvement_requests',
    'ear_requests',
    'ear_request_templates',
    'ear_keywords',
    'chat_history',
    'rag_chunks',
    'rag_documents',
    'users'
  ];

  let droppedCount = 0;
  
  for (const tableName of tables) {
    try {
      await query(`DROP TABLE EAR.${tableName}`);
      droppedCount++;
    } catch (error: any) {
      // 테이블이 없으면 무시
    }
  }
  
  if (droppedCount > 0) {
    console.log(`🗑️  ${droppedCount}개 기존 테이블 삭제 완료`);
  }
}

// 테이블 존재 여부 확인
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as CNT FROM SYS.TABLES WHERE SCHEMA_NAME = 'EAR' AND TABLE_NAME = ?`,
      [tableName.toUpperCase()]
    );
    // HANA는 CNT로 반환하므로 대소문자 모두 확인
    const row = result.rows?.[0] || result[0] || {};
    return (row.cnt > 0 || row.CNT > 0);
  } catch (error) {
    return false;
  }
}

// 테이블 생성
async function createTables() {
  const tables = [
    { name: 'rag_documents', sql: `CREATE TABLE EAR.rag_documents (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      NAME NVARCHAR(500) NOT NULL,
      FILE_PATH NVARCHAR(1000),
      FILE_TYPE NVARCHAR(100),
      FILE_SIZE BIGINT,
      TEXT_CONTENT NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'rag_chunks', sql: `CREATE TABLE EAR.rag_chunks (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      DOCUMENT_ID INTEGER,
      CHUNK_INDEX INTEGER NOT NULL,
      CONTENT NCLOB NOT NULL,
      EMBEDDING NCLOB,
      PAGE_NUMBER INTEGER,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (DOCUMENT_ID) REFERENCES EAR.rag_documents(ID) ON DELETE CASCADE
    )` },
    
    { name: 'chat_history', sql: `CREATE TABLE EAR.chat_history (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      SESSION_ID NVARCHAR(100) NOT NULL,
      USER_ID NVARCHAR(100),
      USER_MESSAGE NCLOB NOT NULL,
      ASSISTANT_RESPONSE NCLOB NOT NULL,
      SOURCES NCLOB,
      INTENT_OPTIONS NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'agents', sql: `CREATE TABLE EAR.agents (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      NAME NVARCHAR(200) NOT NULL,
      DESCRIPTION NCLOB,
      TYPE NVARCHAR(100) NOT NULL,
      BUSINESS_TYPE NVARCHAR(100),
      OWNER_USER_ID NVARCHAR(100),
      VERSION NVARCHAR(50),
      MODEL_NAME NVARCHAR(100),
      LANGUAGE NVARCHAR(50),
      SUPPORTED_MODES NVARCHAR(100),
      ENDPOINT_URL NVARCHAR(255),
      EXEC_MODE NVARCHAR(50),
      STATUS NVARCHAR(50) DEFAULT 'inactive',
      ENV_CONFIG NCLOB,
      MAX_CONCURRENCY INTEGER DEFAULT 1,
      TAGS NCLOB,
      LAST_HEARTBEAT TIMESTAMP,
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'agent_roles', sql: `CREATE TABLE EAR.agent_roles (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      ROLE_NAME NVARCHAR(100) NOT NULL,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'agent_metrics', sql: `CREATE TABLE EAR.agent_metrics (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      TIMESTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CPU_USAGE DECIMAL(5,2),
      MEMORY_USAGE DECIMAL(5,2),
      REQUESTS_PROCESSED INTEGER DEFAULT 0,
      AVG_LATENCY DECIMAL(10,2),
      ERROR_RATE DECIMAL(5,2),
      QUEUE_TIME DECIMAL(10,2),
      AI_ASSISTED_DECISIONS INTEGER DEFAULT 0,
      AI_ASSISTED_DECISIONS_VALIDATED INTEGER DEFAULT 0,
      AI_RECOMMENDATIONS INTEGER DEFAULT 0,
      DECISIONS_OVERRIDDEN INTEGER DEFAULT 0,
      COGNITIVE_LOAD_BEFORE_SCORE DECIMAL(6,2),
      COGNITIVE_LOAD_AFTER_SCORE DECIMAL(6,2),
      HANDOFF_TIME_SECONDS DECIMAL(10,2),
      TEAM_SATISFACTION_SCORE DECIMAL(6,2),
      INNOVATION_COUNT INTEGER DEFAULT 0,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'agent_tasks', sql: `CREATE TABLE EAR.agent_tasks (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      JOB_ID NVARCHAR(100),
      STATUS NVARCHAR(50) DEFAULT 'pending',
      RECEIVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      STARTED_AT TIMESTAMP,
      FINISHED_AT TIMESTAMP,
      RESULT NCLOB,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'job_queue', sql: `CREATE TABLE EAR.job_queue (
      JOB_ID NVARCHAR(100) PRIMARY KEY,
      PAYLOAD NCLOB,
      PRIORITY INTEGER DEFAULT 0,
      STATUS NVARCHAR(50) DEFAULT 'queued',
      ASSIGNED_AGENT_ID INTEGER,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      SCHEDULED_AT TIMESTAMP,
      FOREIGN KEY (ASSIGNED_AGENT_ID) REFERENCES EAR.agents(ID)
    )` },

    { name: 'audit_logs', sql: `CREATE TABLE EAR.audit_logs (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID NVARCHAR(100),
      EVENT_TYPE NVARCHAR(100),
      TARGET_ID NVARCHAR(100),
      TIMESTAMP TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      DETAILS NCLOB
    )` },

    { name: 'agent_system_mappings', sql: `CREATE TABLE EAR.agent_system_mappings (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      SYSTEM_CD NVARCHAR(50) NOT NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'agent_erp_auth', sql: `CREATE TABLE EAR.agent_erp_auth (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      SYSTEM_CD NVARCHAR(50) NOT NULL,
      SYS_AUTH_CD NVARCHAR(100) NOT NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'portal_metric_inputs', sql: `CREATE TABLE EAR.portal_metric_inputs (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      METRIC_KEY NVARCHAR(120) NOT NULL,
      VALUE DECIMAL(14,2) NOT NULL,
      UNIT NVARCHAR(50),
      DESCRIPTION NCLOB,
      BUSINESS_TYPE NVARCHAR(100),
      AGENT_TYPE NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'user_job_role', sql: `CREATE TABLE EAR.user_job_role (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID NVARCHAR(100) NOT NULL,
      ROLE_NAME NVARCHAR(100) NOT NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'user_business_domain', sql: `CREATE TABLE EAR.user_business_domain (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID NVARCHAR(100) NOT NULL,
      BUSINESS_TYPE NVARCHAR(100) NOT NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'business_task_baseline', sql: `CREATE TABLE EAR.business_task_baseline (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      TASK_CODE NVARCHAR(100) NOT NULL,
      DOMAIN NVARCHAR(100),
      BEFORE_TIME_MIN DECIMAL(10,2) NOT NULL,
      BEFORE_COST DECIMAL(14,2),
      DESCRIPTION NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'labor_cost', sql: `CREATE TABLE EAR.labor_cost (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      ROLE NVARCHAR(100) NOT NULL,
      HOURLY_COST DECIMAL(14,2) NOT NULL,
      CURRENCY NVARCHAR(50) DEFAULT 'KRW',
      BUSINESS_TYPE NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'roi_metrics', sql: `CREATE TABLE EAR.roi_metrics (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PERIOD_START DATE NOT NULL,
      PERIOD_END DATE NOT NULL,
      BUSINESS_TYPE NVARCHAR(100),
      AGENT_TYPE NVARCHAR(100),
      SAVED_HOURS DECIMAL(12,2) DEFAULT 0,
      SAVED_COST DECIMAL(14,2) DEFAULT 0,
      ROI_RATIO_PCT DECIMAL(8,2) DEFAULT 0,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'human_ai_collaboration_metrics', sql: `CREATE TABLE EAR.human_ai_collaboration_metrics (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      PERIOD_START DATE NOT NULL,
      PERIOD_END DATE NOT NULL,
      BUSINESS_TYPE NVARCHAR(100),
      AGENT_TYPE NVARCHAR(100),
      DECISION_ACCURACY_PCT DECIMAL(6,2),
      OVERRIDE_RATE_PCT DECIMAL(6,2),
      COGNITIVE_LOAD_REDUCTION_PCT DECIMAL(6,2),
      HANDOFF_TIME_SECONDS DECIMAL(10,2),
      TEAM_SATISFACTION_SCORE DECIMAL(6,2),
      INNOVATION_COUNT INTEGER DEFAULT 0,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'risk_management', sql: `CREATE TABLE EAR.risk_management (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      AGENT_ID INTEGER,
      USE_CASE NVARCHAR(200),
      BUSINESS_TYPE NVARCHAR(100),
      AGENT_TYPE NVARCHAR(100),
      RISK_ETHICS_SCORE INTEGER,
      RISK_REPUTATION_SCORE INTEGER,
      RISK_OPERATIONAL_SCORE INTEGER,
      RISK_LEGAL_SCORE INTEGER,
      AUDIT_REQUIRED BOOLEAN DEFAULT FALSE,
      AUDIT_COMPLETED BOOLEAN DEFAULT FALSE,
      HUMAN_REVIEWED BOOLEAN DEFAULT FALSE,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (AGENT_ID) REFERENCES EAR.agents(ID) ON DELETE CASCADE
    )` },

    { name: 'adoption_funnel_events', sql: `CREATE TABLE EAR.adoption_funnel_events (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID NVARCHAR(100) NOT NULL,
      STAGE NVARCHAR(50) NOT NULL,
      BUSINESS_TYPE NVARCHAR(100),
      AGENT_TYPE NVARCHAR(100),
      METADATA NCLOB,
      EVENT_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'ear_keywords', sql: `CREATE TABLE EAR.ear_keywords (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      KEYWORD NVARCHAR(100) NOT NULL UNIQUE,
      DISPLAY_NAME NVARCHAR(200) NOT NULL,
      CATEGORY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'ear_request_templates', sql: `CREATE TABLE EAR.ear_request_templates (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      KEYWORD_ID INTEGER,
      TEMPLATE_NAME NVARCHAR(200) NOT NULL,
      TEMPLATE_DESCRIPTION NCLOB,
      REQUIRED_FIELDS NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (KEYWORD_ID) REFERENCES EAR.ear_keywords(ID) ON DELETE CASCADE,
      UNIQUE(KEYWORD_ID, TEMPLATE_NAME)
    )` },
    
    { name: 'ear_requests', sql: `CREATE TABLE EAR.ear_requests (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      REQUEST_TITLE NVARCHAR(500) NOT NULL,
      REQUEST_CONTENT NCLOB NOT NULL,
      TEMPLATE_ID INTEGER,
      FORM_DATA NCLOB,
      ATTACHMENTS NCLOB,
      AGENT_ID INTEGER,
      BUSINESS_TYPE NVARCHAR(100),
      STATUS NVARCHAR(50) DEFAULT 'pending',
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (TEMPLATE_ID) REFERENCES EAR.ear_request_templates(ID)
    )` },
    
    { name: 'chat_intent_patterns', sql: `CREATE TABLE EAR.chat_intent_patterns (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PATTERN_TYPE NVARCHAR(20) NOT NULL,
      PATTERN_VALUE NCLOB NOT NULL,
      RESPONSE_MESSAGE NCLOB NOT NULL,
      INTENT_CATEGORY NVARCHAR(50),
      IS_ACTIVE BOOLEAN DEFAULT true,
      PRIORITY INTEGER DEFAULT 0,
      DISPLAY_TYPE NVARCHAR(20) DEFAULT 'inline',
      COMPANY_CODE NVARCHAR(10) DEFAULT 'SKN',
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'chat_intent_options', sql: `CREATE TABLE EAR.chat_intent_options (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      INTENT_PATTERN_ID INTEGER,
      OPTION_TITLE NCLOB NOT NULL,
      OPTION_DESCRIPTION NCLOB,
      ACTION_TYPE NVARCHAR(20) NOT NULL,
      ACTION_DATA NCLOB,
      ICON_NAME NVARCHAR(50),
      DISPLAY_ORDER INTEGER DEFAULT 0,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (INTENT_PATTERN_ID) REFERENCES EAR.chat_intent_patterns(ID) ON DELETE CASCADE
    )` },
    
    { name: 'improvement_requests', sql: `CREATE TABLE EAR.improvement_requests (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      SESSION_ID NVARCHAR(100) NOT NULL,
      CHAT_HISTORY_ID INTEGER,
      SELECTED_TEXT NCLOB NOT NULL,
      CATEGORY NVARCHAR(50) NOT NULL,
      DESCRIPTION NCLOB NOT NULL,
      STATUS NVARCHAR(50) DEFAULT 'pending',
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (CHAT_HISTORY_ID) REFERENCES EAR.chat_history(ID) ON DELETE CASCADE
    )` },
    
    { name: 'improvement_responses', sql: `CREATE TABLE EAR.improvement_responses (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      REQUEST_ID INTEGER,
      RESPONSE_TEXT NCLOB NOT NULL,
      RESPONDED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (REQUEST_ID) REFERENCES EAR.improvement_requests(ID) ON DELETE CASCADE
    )` },
    
    { name: 'users', sql: `CREATE TABLE EAR.users (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USERID NVARCHAR(100) NOT NULL UNIQUE,
      PASSWORD_HASH NVARCHAR(255) NOT NULL,
      EMAIL NVARCHAR(255),
      FULL_NAME NVARCHAR(200),
      DEPARTMENT NVARCHAR(100),
      POSITION NVARCHAR(100),
      PHONE NVARCHAR(50),
      EMPLOYEE_ID NVARCHAR(50),
      IS_ACTIVE BOOLEAN DEFAULT true,
      IS_ADMIN BOOLEAN DEFAULT false,
      COMPANY_CODE NVARCHAR(10) DEFAULT 'SKN',
      FAILED_LOGIN_ATTEMPTS INTEGER DEFAULT 0,
      LOCKED_UNTIL TIMESTAMP NULL,
      LAST_LOGIN TIMESTAMP NULL,
      PASSWORD_RESET_TOKEN NVARCHAR(255) NULL,
      PASSWORD_RESET_EXPIRES TIMESTAMP NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'login_history', sql: `CREATE TABLE EAR.login_history (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID INTEGER,
      USERID NVARCHAR(100) NOT NULL,
      LOGIN_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      IP_ADDRESS NVARCHAR(45),
      USER_AGENT NCLOB,
      LOGIN_STATUS NVARCHAR(20) NOT NULL,
      FAILURE_REASON NVARCHAR(100) NULL,
      FOREIGN KEY (USER_ID) REFERENCES EAR.users(ID) ON DELETE CASCADE
    )` },

    { name: 'portal_users', sql: `CREATE TABLE EAR.portal_users (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USERID NVARCHAR(100) NOT NULL UNIQUE,
      PASSWORD_HASH NVARCHAR(255) NOT NULL,
      EMAIL NVARCHAR(255),
      FULL_NAME NVARCHAR(200),
      DEPARTMENT NVARCHAR(100),
      POSITION NVARCHAR(100),
      PHONE NVARCHAR(50),
      EMPLOYEE_ID NVARCHAR(50),
      IS_ACTIVE BOOLEAN DEFAULT true,
      IS_ADMIN BOOLEAN DEFAULT false,
      COMPANY_CODE NVARCHAR(10) DEFAULT 'SKN',
      FAILED_LOGIN_ATTEMPTS INTEGER DEFAULT 0,
      LOCKED_UNTIL TIMESTAMP NULL,
      LAST_LOGIN TIMESTAMP NULL,
      PASSWORD_RESET_TOKEN NVARCHAR(255) NULL,
      PASSWORD_RESET_EXPIRES TIMESTAMP NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'portal_user_roles', sql: `CREATE TABLE EAR.portal_user_roles (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID INTEGER,
      ROLE_NAME NVARCHAR(100) NOT NULL,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (USER_ID) REFERENCES EAR.portal_users(ID) ON DELETE CASCADE
    )` },

    { name: 'portal_role_matrix', sql: `CREATE TABLE EAR.portal_role_matrix (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      COMPANY_CODE NVARCHAR(10) NOT NULL,
      ROLE_NAME NVARCHAR(100) NOT NULL,
      PERMISSIONS NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'portal_login_history', sql: `CREATE TABLE EAR.portal_login_history (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID INTEGER,
      USERID NVARCHAR(100) NOT NULL,
      LOGIN_TIME TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      IP_ADDRESS NVARCHAR(45),
      USER_AGENT NCLOB,
      LOGIN_STATUS NVARCHAR(20) NOT NULL,
      FAILURE_REASON NVARCHAR(100) NULL,
      FOREIGN KEY (USER_ID) REFERENCES EAR.portal_users(ID) ON DELETE CASCADE
    )` },
    
    { name: 'system_improvement_requests', sql: `CREATE TABLE EAR.system_improvement_requests (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      TITLE NVARCHAR(500) NOT NULL,
      CONTENT NCLOB NOT NULL,
      ATTACHMENTS NCLOB,
      STATUS NVARCHAR(50) DEFAULT 'pending',
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'system_improvement_responses', sql: `CREATE TABLE EAR.system_improvement_responses (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      REQUEST_ID INTEGER,
      RESPONSE_TEXT NCLOB NOT NULL,
      RESPONDED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (REQUEST_ID) REFERENCES EAR.system_improvement_requests(ID) ON DELETE CASCADE
    )` },
    
    { name: 'esm_requests', sql: `CREATE TABLE EAR.esm_requests (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      REQUEST_TITLE NVARCHAR(500) NOT NULL,
      REQUEST_CONTENT NCLOB NOT NULL,
      TEMPLATE_ID INTEGER,
      FORM_DATA NCLOB,
      ATTACHMENTS NCLOB,
      STATUS NVARCHAR(50) DEFAULT 'pending',
      CREATED_BY NVARCHAR(100),
      SALES_CLOUD_CASE_ID NVARCHAR(100),
      SALES_CLOUD_CASE_URL NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (TEMPLATE_ID) REFERENCES EAR.ear_request_templates(ID)
    )` },
    
    { name: 'ip_whitelist', sql: `CREATE TABLE EAR.ip_whitelist (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      IP_ADDRESS NVARCHAR(50) NOT NULL UNIQUE,
      DESCRIPTION NVARCHAR(500),
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'menus', sql: `CREATE TABLE EAR.menus (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PARENT_ID INTEGER,
      MENU_CODE NVARCHAR(100) NOT NULL UNIQUE,
      LABEL NVARCHAR(200) NOT NULL,
      PATH NVARCHAR(500),
      ICON_NAME NVARCHAR(100),
      DESCRIPTION NVARCHAR(500),
      DISPLAY_ORDER INTEGER DEFAULT 0,
      IS_ACTIVE BOOLEAN DEFAULT true,
      ADMIN_ONLY BOOLEAN DEFAULT false,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (PARENT_ID) REFERENCES EAR.menus(ID) ON DELETE CASCADE
    )` },
    
    { name: 'group_menu_mappings', sql: `CREATE TABLE EAR.group_menu_mappings (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      GROUP_NAME NVARCHAR(100) NOT NULL,
      MENU_ID INTEGER NOT NULL,
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (MENU_ID) REFERENCES EAR.menus(ID) ON DELETE CASCADE,
      UNIQUE(GROUP_NAME, MENU_ID)
    )` },

    { name: 'business_domains', sql: `CREATE TABLE EAR.business_domains (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      DOMAIN_CODE NVARCHAR(50) NOT NULL UNIQUE,
      DOMAIN_NAME NVARCHAR(200) NOT NULL,
      DESCRIPTION NVARCHAR(500),
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },

    { name: 'business_level1', sql: `CREATE TABLE EAR.business_level1 (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      DOMAIN_ID INTEGER NOT NULL,
      LEVEL1_CODE NVARCHAR(50) NOT NULL,
      LEVEL1_NAME NVARCHAR(200) NOT NULL,
      MENU_CODE NVARCHAR(100),
      DISPLAY_ORDER INTEGER DEFAULT 0,
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (DOMAIN_ID) REFERENCES EAR.business_domains(ID) ON DELETE CASCADE,
      UNIQUE(DOMAIN_ID, LEVEL1_CODE)
    )` },

    { name: 'business_level2', sql: `CREATE TABLE EAR.business_level2 (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      LEVEL1_ID INTEGER NOT NULL,
      LEVEL2_CODE NVARCHAR(50) NOT NULL,
      LEVEL2_NAME NVARCHAR(200) NOT NULL,
      DISPLAY_ORDER INTEGER DEFAULT 0,
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (LEVEL1_ID) REFERENCES EAR.business_level1(ID) ON DELETE CASCADE,
      UNIQUE(LEVEL1_ID, LEVEL2_CODE)
    )` },
    
    { name: 'input_security_settings', sql: `CREATE TABLE EAR.input_security_settings (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      SETTING_TYPE NVARCHAR(50) NOT NULL,
      SETTING_KEY NVARCHAR(100) NOT NULL,
      SETTING_NAME NVARCHAR(200) NOT NULL,
      IS_ENABLED BOOLEAN DEFAULT true,
      PATTERN NCLOB,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(SETTING_TYPE, SETTING_KEY)
    )` },
    
    { name: 'profanity_patterns', sql: `CREATE TABLE EAR.profanity_patterns (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PATTERN NVARCHAR(500) NOT NULL,
      DESCRIPTION NVARCHAR(500),
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'output_security_patterns', sql: `CREATE TABLE EAR.output_security_patterns (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PATTERN NVARCHAR(500) NOT NULL,
      DESCRIPTION NVARCHAR(500),
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'output_security_settings', sql: `CREATE TABLE EAR.output_security_settings (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      SETTING_TYPE NVARCHAR(50) NOT NULL DEFAULT 'output_security',
      SETTING_KEY NVARCHAR(100) NOT NULL DEFAULT 'output_security',
      SETTING_NAME NVARCHAR(200) NOT NULL DEFAULT '출력보안',
      IS_ENABLED BOOLEAN DEFAULT false,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(SETTING_TYPE, SETTING_KEY)
    )` },
    
    { name: 'agent_intents', sql: `CREATE TABLE EAR.agent_intents (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      USER_ID NVARCHAR(100) NOT NULL,
      TCODE NVARCHAR(50) NOT NULL,
      CONTENTS NCLOB NOT NULL,
      HASH NVARCHAR(200) NOT NULL,
      IS_GREETED BOOLEAN DEFAULT false,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'privacy_policies', sql: `CREATE TABLE EAR.privacy_policies (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      VERSION NVARCHAR(50) NOT NULL,
      FILE_NAME NVARCHAR(500) NOT NULL,
      HTML_CONTENT NCLOB NOT NULL,
      IS_CURRENT BOOLEAN DEFAULT false,
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CREATED_BY NVARCHAR(100)
    )` },
    
    { name: 'prompt_management', sql: `CREATE TABLE EAR.prompt_management (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      PROMPT_TYPE NVARCHAR(100) NOT NULL,
      COMPANY_CODE NVARCHAR(10) NOT NULL,
      REFERENCE_CONTENT NCLOB,
      PROMPT NCLOB NOT NULL,
      IS_ACTIVE BOOLEAN DEFAULT true,
      CREATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    
    { name: 'rag_agents_info', sql: `CREATE TABLE EAR.RAG_AGENTS_INFO (
      ID INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
      COMPANY_CODE NVARCHAR(50) NOT NULL,
      AGENT_DESCRIPTION NVARCHAR(500),
      AGENT_URL NVARCHAR(500) NOT NULL,
      AGENT_TOKEN NVARCHAR(500) NOT NULL,
      IS_ACTIVE NVARCHAR(1) DEFAULT 'N',
      CREATED_BY NVARCHAR(100),
      UPDATED_BY NVARCHAR(100),
      CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` }
  ];

  let createdCount = 0;
  
  for (const table of tables) {
    try {
      // 테이블 존재 여부 확인
      const exists = await tableExists(table.name);
      
      if (!exists) {
        console.log(`테이블 생성 시도: ${table.name}`);
        await query(table.sql);
        createdCount++;
        console.log(`✅ 테이블 생성 완료: ${table.name}`);
      } else {
        console.log(`테이블 이미 존재: ${table.name}`);
      }
    } catch (error: any) {
      console.error(`테이블 생성 실패 (${table.name}):`, error.message);
      console.error(`SQL: ${table.sql.substring(0, 200)}...`);
    }
  }
  
  if (createdCount > 0) {
    console.log(`✅ ${createdCount}개 테이블 생성 완료`);
  }
}

async function applyPortalDashboardMigrations() {
  const queries = [
    `ALTER TABLE EAR.agents ADD (BUSINESS_TYPE NVARCHAR(100))`,
    `ALTER TABLE EAR.agents ADD (OWNER_USER_ID NVARCHAR(100))`,
    `ALTER TABLE EAR.agents ADD (VERSION NVARCHAR(50))`,
    `ALTER TABLE EAR.agents ADD (MODEL_NAME NVARCHAR(100))`,
    `ALTER TABLE EAR.agents ADD (LANGUAGE NVARCHAR(50))`,
    `ALTER TABLE EAR.agents ADD (SUPPORTED_MODES NVARCHAR(100))`,
    `ALTER TABLE EAR.agents ADD (ENDPOINT_URL NVARCHAR(255))`,
    `ALTER TABLE EAR.agents ADD (EXEC_MODE NVARCHAR(50))`,
    `ALTER TABLE EAR.ear_requests ADD (AGENT_ID INTEGER)`,
    `ALTER TABLE EAR.ear_requests ADD (BUSINESS_TYPE NVARCHAR(100))`,
    `ALTER TABLE EAR.agent_metrics ADD (AI_ASSISTED_DECISIONS INTEGER DEFAULT 0)`,
    `ALTER TABLE EAR.agent_metrics ADD (AI_ASSISTED_DECISIONS_VALIDATED INTEGER DEFAULT 0)`,
    `ALTER TABLE EAR.agent_metrics ADD (AI_RECOMMENDATIONS INTEGER DEFAULT 0)`,
    `ALTER TABLE EAR.agent_metrics ADD (DECISIONS_OVERRIDDEN INTEGER DEFAULT 0)`,
    `ALTER TABLE EAR.agent_metrics ADD (COGNITIVE_LOAD_BEFORE_SCORE DECIMAL(6,2))`,
    `ALTER TABLE EAR.agent_metrics ADD (COGNITIVE_LOAD_AFTER_SCORE DECIMAL(6,2))`,
    `ALTER TABLE EAR.agent_metrics ADD (HANDOFF_TIME_SECONDS DECIMAL(10,2))`,
    `ALTER TABLE EAR.agent_metrics ADD (TEAM_SATISFACTION_SCORE DECIMAL(6,2))`,
    `ALTER TABLE EAR.agent_metrics ADD (INNOVATION_COUNT INTEGER DEFAULT 0)`,
    `ALTER TABLE EAR.agents ADD (BUSINESS_LEVEL2_ID INTEGER)`
  ];

  for (const sql of queries) {
    try {
      await query(sql);
    } catch (error) {
      // 컬럼이 이미 존재하면 무시
    }
  }
}

async function seedPortalBaselines() {
  const statements = [
    {
      metric_key: 'baseline_minutes_per_request',
      value: 12,
      unit: 'minute',
      description: '요청 1건당 기준 처리 시간 (분)'
    },
    {
      metric_key: 'cost_per_hour',
      value: 45000,
      unit: 'KRW',
      description: '시간당 인건비 단가'
    },
    {
      metric_key: 'sla_latency_ms',
      value: 2000,
      unit: 'ms',
      description: 'SLA 기준 응답 시간 (ms)'
    },
    {
      metric_key: 'investment_cost',
      value: 0,
      unit: 'KRW',
      description: '에이전트 개발/운영 투자 비용'
    },
    {
      metric_key: 'total_roles',
      value: 0,
      unit: 'count',
      description: '전체 역할 수'
    },
    {
      metric_key: 'roles_redefined',
      value: 0,
      unit: 'count',
      description: 'AI 협업으로 재설계된 역할 수'
    },
    {
      metric_key: 'customer_nps_delta',
      value: 0,
      unit: 'point',
      description: 'AI 도입 이후 고객 만족도/NPS 변화'
    },
    {
      metric_key: 'error_reduction_pct',
      value: 0,
      unit: 'pct',
      description: '오류율 감소율'
    },
    {
      metric_key: 'decision_speed_improvement_pct',
      value: 0,
      unit: 'pct',
      description: '의사결정 속도 개선율'
    }
  ];

  for (const item of statements) {
    await query(
      `MERGE INTO EAR.PORTAL_METRIC_INPUTS AS target
       USING (SELECT ? AS METRIC_KEY FROM DUMMY) AS source
       ON (target.METRIC_KEY = source.METRIC_KEY AND target.BUSINESS_TYPE IS NULL AND target.AGENT_TYPE IS NULL)
       WHEN NOT MATCHED THEN
         INSERT (METRIC_KEY, VALUE, UNIT, DESCRIPTION, CREATED_AT, UPDATED_AT)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [item.metric_key, item.metric_key, item.value, item.unit, item.description]
    );
  }
}

async function seedBusinessDomainHierarchy() {
  try {
    await query(`INSERT INTO EAR.business_domains (DOMAIN_CODE, DOMAIN_NAME, DESCRIPTION)
      SELECT 'SAP', 'SAP Domain', 'SAP 업무 모듈 체계' FROM DUMMY
      WHERE NOT EXISTS (SELECT 1 FROM EAR.business_domains WHERE DOMAIN_CODE = 'SAP')`);

    const modules = [
      { code: 'COMMON', name: '통합', order: 5 },
      { code: 'MM', name: 'MM', order: 10 },
      { code: 'PP', name: 'PP', order: 20 },
      { code: 'HR', name: 'HR', order: 30 },
      { code: 'SD', name: 'SD', order: 40 },
      { code: 'FI', name: 'FI', order: 50 },
      { code: 'CO', name: 'CO', order: 60 },
      { code: 'BC', name: 'BC', order: 70 }
    ];

    for (const module of modules) {
      await query(`INSERT INTO EAR.business_level1 (DOMAIN_ID, LEVEL1_CODE, LEVEL1_NAME, MENU_CODE, DISPLAY_ORDER)
        SELECT d.ID, ?, ?, 'agent-management', ?
        FROM EAR.business_domains d
        WHERE d.DOMAIN_CODE = 'SAP'
          AND NOT EXISTS (
            SELECT 1 FROM EAR.business_level1 l1 WHERE l1.DOMAIN_ID = d.ID AND l1.LEVEL1_CODE = ?
          )`, [module.code, module.name, module.order, module.code]);
    }

    const level2Rows = [
      ['COMMON', 'CM.1.1', '공통 운영 모니터링', 10],
      ['COMMON', 'CM.1.2', '공통 정책/권한 관리', 20],
      ['MM', 'MM.1.2', 'BP 티켓 자동접수·KYC 체크', 10],
      ['MM', 'MM.1.3', '구매처 평가 근거 자동첨부', 20],
      ['MM', 'MM.2.2', '선정 근거 문장 자동작성', 30],
      ['MM', 'MM.3.4', '계획 변경·승인요청 자동생성', 40],
      ['MM', 'MM.5.3', '3-way match 예외 분류·라우팅', 50],
      ['PP', 'PP.2.1', '수요 이상치 탐지·보정 제안', 10],
      ['PP', 'PP.3.1', 'MRP 예외 트리아지', 20],
      ['PP', 'PP.3.2', '오더 사전검증(릴리즈 전)', 30],
      ['PP', 'PP.4.2', '공정확인 편차 알림', 40],
      ['PP', 'PP.5.3', '정산 차이 자동분해', 50],
      ['HR', 'HR.2.2', '지원자 요약·매칭 스코어', 10],
      ['HR', 'HR.2.4', '온보딩 티켓 자동생성', 20],
      ['HR', 'HR.3.4', '근태 예외 자동라우팅', 30],
      ['HR', 'HR.4.1', '급여 데이터 검증', 40],
      ['HR', 'HR.5.1', '평가 코멘트 초안+편향체크', 50],
      ['SD', 'SD.1.3', '신용 승인 근거+리스크 점수', 10],
      ['SD', 'SD.2.3', 'ATP 대체안 추천', 20],
      ['SD', 'SD.3.5', '클레임 자동분류·서류 안내', 30],
      ['SD', 'SD.4.3', '청구 차이 자동설명', 40],
      ['SD', 'SD.5.3', '독촉 우선순위+문구 생성', 50],
      ['FI', 'FI.2.3', '전표 규칙 위반 탐지', 10],
      ['FI', 'FI.3.1', '송장 캡처·전표 초안', 20],
      ['FI', 'FI.3.2', '3-way match 예외 분류', 30],
      ['FI', 'FI.4.2', '대사 후보 자동매칭', 40],
      ['FI', 'FI.5.1', '결산 체크리스트 모니터', 50],
      ['CO', 'CO.2.3', '계획 시나리오 비교', 10],
      ['CO', 'CO.3.1', '실적전표 오류 탐지', 20],
      ['CO', 'CO.4.1', '배부 실행 모니터', 30],
      ['CO', 'CO.4.2', '정산 차이 자동설명', 40],
      ['CO', 'CO.5.1', '수익성 내러티브 생성', 50],
      ['BC', 'BC.2.2', '티켓 분류+필수정보 수집', 10],
      ['BC', 'BC.1.3', 'SoD 리스크 스코어링', 20],
      ['BC', 'BC.3.3', '로그 원인 후보·가이드', 30],
      ['BC', 'BC.4.2', '릴리즈 영향도 요약', 40],
      ['BC', 'BC.5.2', '취약점 조치안 플래닝', 50]
    ];

    for (const [level1Code, level2Code, level2Name, order] of level2Rows) {
      await query(`INSERT INTO EAR.business_level2 (LEVEL1_ID, LEVEL2_CODE, LEVEL2_NAME, DISPLAY_ORDER)
        SELECT l1.ID, ?, ?, ?
        FROM EAR.business_level1 l1
        WHERE l1.LEVEL1_CODE = ?
          AND NOT EXISTS (
            SELECT 1 FROM EAR.business_level2 l2 WHERE l2.LEVEL1_ID = l1.ID AND l2.LEVEL2_CODE = ?
          )`, [level2Code, level2Name, order, level1Code, level2Code]);
    }
  } catch (error: any) {
    console.warn('business domain hierarchy seed skipped:', error?.message);
  }
}


// 인덱스 존재 여부 확인
async function indexExists(indexName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as CNT FROM SYS.INDEXES WHERE SCHEMA_NAME = 'EAR' AND INDEX_NAME = ?`,
      [indexName.toUpperCase()]
    );
    // query 함수는 배열을 반환하므로 result[0] 또는 result.rows[0] 확인
    const row = Array.isArray(result) ? result[0] : (result.rows?.[0] || result);
    return row && (row.cnt > 0 || row.CNT > 0);
  } catch (error) {
    // 에러 발생 시 false 반환 (인덱스가 없다고 간주)
    return false;
  }
}

// 인덱스 생성
async function createIndexes() {
  const indexes = [
    { name: 'idx_rag_documents_name', sql: 'CREATE INDEX idx_rag_documents_name ON EAR.rag_documents(NAME)' },
    { name: 'idx_rag_documents_created_at', sql: 'CREATE INDEX idx_rag_documents_created_at ON EAR.rag_documents(CREATED_AT)' },
    { name: 'idx_rag_chunks_document_id', sql: 'CREATE INDEX idx_rag_chunks_document_id ON EAR.rag_chunks(DOCUMENT_ID)' },
    { name: 'idx_chat_session_id', sql: 'CREATE INDEX idx_chat_session_id ON EAR.chat_history(SESSION_ID)' },
    { name: 'idx_chat_user_id', sql: 'CREATE INDEX idx_chat_user_id ON EAR.chat_history(USER_ID)' },
    { name: 'idx_chat_created_at', sql: 'CREATE INDEX idx_chat_created_at ON EAR.chat_history(CREATED_AT)' },
    { name: 'idx_ear_keywords_category', sql: 'CREATE INDEX idx_ear_keywords_category ON EAR.ear_keywords(CATEGORY)' },
    { name: 'idx_ear_request_templates_keyword_id', sql: 'CREATE INDEX idx_ear_request_templates_keyword_id ON EAR.ear_request_templates(KEYWORD_ID)' },
    { name: 'idx_ear_requests_status', sql: 'CREATE INDEX idx_ear_requests_status ON EAR.ear_requests(STATUS)' },
    { name: 'idx_ear_requests_created_at', sql: 'CREATE INDEX idx_ear_requests_created_at ON EAR.ear_requests(CREATED_AT)' },
    { name: 'idx_improvement_requests_session_id', sql: 'CREATE INDEX idx_improvement_requests_session_id ON EAR.improvement_requests(SESSION_ID)' },
    { name: 'idx_improvement_requests_chat_history_id', sql: 'CREATE INDEX idx_improvement_requests_chat_history_id ON EAR.improvement_requests(CHAT_HISTORY_ID)' },
    { name: 'idx_improvement_requests_category', sql: 'CREATE INDEX idx_improvement_requests_category ON EAR.improvement_requests(CATEGORY)' },
    { name: 'idx_improvement_requests_status', sql: 'CREATE INDEX idx_improvement_requests_status ON EAR.improvement_requests(STATUS)' },
    { name: 'idx_improvement_requests_created_at', sql: 'CREATE INDEX idx_improvement_requests_created_at ON EAR.improvement_requests(CREATED_AT)' },
    { name: 'idx_improvement_responses_request_id', sql: 'CREATE INDEX idx_improvement_responses_request_id ON EAR.improvement_responses(REQUEST_ID)' },
    { name: 'idx_chat_intent_patterns_active', sql: 'CREATE INDEX idx_chat_intent_patterns_active ON EAR.chat_intent_patterns(IS_ACTIVE)' },
    { name: 'idx_chat_intent_patterns_priority', sql: 'CREATE INDEX idx_chat_intent_patterns_priority ON EAR.chat_intent_patterns(PRIORITY)' },
    { name: 'idx_chat_intent_options_pattern_id', sql: 'CREATE INDEX idx_chat_intent_options_pattern_id ON EAR.chat_intent_options(INTENT_PATTERN_ID)' },
    { name: 'idx_chat_intent_options_display_order', sql: 'CREATE INDEX idx_chat_intent_options_display_order ON EAR.chat_intent_options(DISPLAY_ORDER)' },
    { name: 'idx_users_email', sql: 'CREATE INDEX idx_users_email ON EAR.users(EMAIL)' },
    { name: 'idx_users_employee_id', sql: 'CREATE INDEX idx_users_employee_id ON EAR.users(EMPLOYEE_ID)' },
    { name: 'idx_users_is_active', sql: 'CREATE INDEX idx_users_is_active ON EAR.users(IS_ACTIVE)' },
    { name: 'idx_users_is_admin', sql: 'CREATE INDEX idx_users_is_admin ON EAR.users(IS_ADMIN)' },
    { name: 'idx_users_locked_until', sql: 'CREATE INDEX idx_users_locked_until ON EAR.users(LOCKED_UNTIL)' },
    { name: 'idx_login_history_user_id', sql: 'CREATE INDEX idx_login_history_user_id ON EAR.login_history(USER_ID)' },
    { name: 'idx_login_history_userid', sql: 'CREATE INDEX idx_login_history_userid ON EAR.login_history(USERID)' },
    { name: 'idx_login_history_login_time', sql: 'CREATE INDEX idx_login_history_login_time ON EAR.login_history(LOGIN_TIME)' },
    { name: 'idx_login_history_login_status', sql: 'CREATE INDEX idx_login_history_login_status ON EAR.login_history(LOGIN_STATUS)' },
    { name: 'idx_portal_users_userid', sql: 'CREATE INDEX idx_portal_users_userid ON EAR.portal_users(USERID)' },
    { name: 'idx_portal_login_history_user_id', sql: 'CREATE INDEX idx_portal_login_history_user_id ON EAR.portal_login_history(USER_ID)' },
    { name: 'idx_portal_login_history_userid', sql: 'CREATE INDEX idx_portal_login_history_userid ON EAR.portal_login_history(USERID)' },
    { name: 'idx_portal_login_history_login_time', sql: 'CREATE INDEX idx_portal_login_history_login_time ON EAR.portal_login_history(LOGIN_TIME)' },
    { name: 'idx_portal_login_history_login_status', sql: 'CREATE INDEX idx_portal_login_history_login_status ON EAR.portal_login_history(LOGIN_STATUS)' },
    { name: 'idx_portal_user_roles_user_id', sql: 'CREATE INDEX idx_portal_user_roles_user_id ON EAR.portal_user_roles(USER_ID)' },
    { name: 'idx_portal_role_matrix_company_role', sql: 'CREATE INDEX idx_portal_role_matrix_company_role ON EAR.portal_role_matrix(COMPANY_CODE, ROLE_NAME)' },
    { name: 'idx_system_improvement_requests_status', sql: 'CREATE INDEX idx_system_improvement_requests_status ON EAR.system_improvement_requests(STATUS)' },
    { name: 'idx_system_improvement_requests_created_by', sql: 'CREATE INDEX idx_system_improvement_requests_created_by ON EAR.system_improvement_requests(CREATED_BY)' },
    { name: 'idx_system_improvement_requests_created_at', sql: 'CREATE INDEX idx_system_improvement_requests_created_at ON EAR.system_improvement_requests(CREATED_AT)' },
    { name: 'idx_system_improvement_responses_request_id', sql: 'CREATE INDEX idx_system_improvement_responses_request_id ON EAR.system_improvement_responses(REQUEST_ID)' },
    { name: 'idx_esm_requests_status', sql: 'CREATE INDEX idx_esm_requests_status ON EAR.esm_requests(STATUS)' },
    { name: 'idx_esm_requests_created_at', sql: 'CREATE INDEX idx_esm_requests_created_at ON EAR.esm_requests(CREATED_AT)' },
    { name: 'idx_esm_requests_sales_cloud_case_id', sql: 'CREATE INDEX idx_esm_requests_sales_cloud_case_id ON EAR.esm_requests(SALES_CLOUD_CASE_ID)' },
    { name: 'idx_ip_whitelist_ip_address', sql: 'CREATE INDEX idx_ip_whitelist_ip_address ON EAR.ip_whitelist(IP_ADDRESS)' },
    { name: 'idx_ip_whitelist_is_active', sql: 'CREATE INDEX idx_ip_whitelist_is_active ON EAR.ip_whitelist(IS_ACTIVE)' },
    { name: 'idx_menus_parent_id', sql: 'CREATE INDEX idx_menus_parent_id ON EAR.menus(PARENT_ID)' },
    { name: 'idx_menus_menu_code', sql: 'CREATE INDEX idx_menus_menu_code ON EAR.menus(MENU_CODE)' },
    { name: 'idx_menus_is_active', sql: 'CREATE INDEX idx_menus_is_active ON EAR.menus(IS_ACTIVE)' },
    { name: 'idx_menus_display_order', sql: 'CREATE INDEX idx_menus_display_order ON EAR.menus(DISPLAY_ORDER)' },
    { name: 'idx_group_menu_mappings_group_name', sql: 'CREATE INDEX idx_group_menu_mappings_group_name ON EAR.group_menu_mappings(GROUP_NAME)' },
    { name: 'idx_group_menu_mappings_menu_id', sql: 'CREATE INDEX idx_group_menu_mappings_menu_id ON EAR.group_menu_mappings(MENU_ID)' },
    { name: 'idx_group_menu_mappings_is_active', sql: 'CREATE INDEX idx_group_menu_mappings_is_active ON EAR.group_menu_mappings(IS_ACTIVE)' },
    { name: 'idx_input_security_settings_type', sql: 'CREATE INDEX idx_input_security_settings_type ON EAR.input_security_settings(SETTING_TYPE)' },
    { name: 'idx_input_security_settings_key', sql: 'CREATE INDEX idx_input_security_settings_key ON EAR.input_security_settings(SETTING_KEY)' },
    { name: 'idx_input_security_settings_enabled', sql: 'CREATE INDEX idx_input_security_settings_enabled ON EAR.input_security_settings(IS_ENABLED)' },
    { name: 'idx_profanity_patterns_active', sql: 'CREATE INDEX idx_profanity_patterns_active ON EAR.profanity_patterns(IS_ACTIVE)' },
    { name: 'idx_output_security_patterns_active', sql: 'CREATE INDEX idx_output_security_patterns_active ON EAR.output_security_patterns(IS_ACTIVE)' },
    { name: 'idx_output_security_settings_enabled', sql: 'CREATE INDEX idx_output_security_settings_enabled ON EAR.output_security_settings(IS_ENABLED)' },
    { name: 'idx_prompt_management_type', sql: 'CREATE INDEX idx_prompt_management_type ON EAR.prompt_management(PROMPT_TYPE)' },
    { name: 'idx_prompt_management_company_code', sql: 'CREATE INDEX idx_prompt_management_company_code ON EAR.prompt_management(COMPANY_CODE)' },
    { name: 'idx_prompt_management_active', sql: 'CREATE INDEX idx_prompt_management_active ON EAR.prompt_management(IS_ACTIVE)' },
    { name: 'idx_rag_agents_info_company_code', sql: 'CREATE INDEX idx_rag_agents_info_company_code ON EAR.RAG_AGENTS_INFO(COMPANY_CODE)' },
    { name: 'idx_rag_agents_info_is_active', sql: 'CREATE INDEX idx_rag_agents_info_is_active ON EAR.RAG_AGENTS_INFO(IS_ACTIVE)' },
    { name: 'idx_rag_agents_info_company_active', sql: 'CREATE INDEX idx_rag_agents_info_company_active ON EAR.RAG_AGENTS_INFO(COMPANY_CODE, IS_ACTIVE)' },
    { name: 'idx_agents_status', sql: 'CREATE INDEX idx_agents_status ON EAR.agents(STATUS)' },
    { name: 'idx_agents_type', sql: 'CREATE INDEX idx_agents_type ON EAR.agents(TYPE)' },
    { name: 'idx_agents_is_active', sql: 'CREATE INDEX idx_agents_is_active ON EAR.agents(IS_ACTIVE)' },
    { name: 'idx_agents_last_heartbeat', sql: 'CREATE INDEX idx_agents_last_heartbeat ON EAR.agents(LAST_HEARTBEAT)' },
    { name: 'idx_agent_roles_agent_id', sql: 'CREATE INDEX idx_agent_roles_agent_id ON EAR.agent_roles(AGENT_ID)' },
    { name: 'idx_agent_roles_role_name', sql: 'CREATE INDEX idx_agent_roles_role_name ON EAR.agent_roles(ROLE_NAME)' },
    { name: 'idx_agent_metrics_agent_id', sql: 'CREATE INDEX idx_agent_metrics_agent_id ON EAR.agent_metrics(AGENT_ID)' },
    { name: 'idx_agent_metrics_timestamp', sql: 'CREATE INDEX idx_agent_metrics_timestamp ON EAR.agent_metrics(TIMESTAMP)' },
    { name: 'idx_agent_tasks_agent_id', sql: 'CREATE INDEX idx_agent_tasks_agent_id ON EAR.agent_tasks(AGENT_ID)' },
    { name: 'idx_agent_tasks_status', sql: 'CREATE INDEX idx_agent_tasks_status ON EAR.agent_tasks(STATUS)' },
    { name: 'idx_job_queue_status', sql: 'CREATE INDEX idx_job_queue_status ON EAR.job_queue(STATUS)' },
    { name: 'idx_job_queue_assigned_agent_id', sql: 'CREATE INDEX idx_job_queue_assigned_agent_id ON EAR.job_queue(ASSIGNED_AGENT_ID)' },
    { name: 'idx_audit_logs_user_id', sql: 'CREATE INDEX idx_audit_logs_user_id ON EAR.audit_logs(USER_ID)' },
    { name: 'idx_audit_logs_timestamp', sql: 'CREATE INDEX idx_audit_logs_timestamp ON EAR.audit_logs(TIMESTAMP)' },
    { name: 'idx_human_ai_collaboration_period', sql: 'CREATE INDEX idx_human_ai_collaboration_period ON EAR.human_ai_collaboration_metrics(PERIOD_START, PERIOD_END)' },
    { name: 'idx_human_ai_collaboration_agent_type', sql: 'CREATE INDEX idx_human_ai_collaboration_agent_type ON EAR.human_ai_collaboration_metrics(AGENT_TYPE)' },
    { name: 'idx_human_ai_collaboration_business_type', sql: 'CREATE INDEX idx_human_ai_collaboration_business_type ON EAR.human_ai_collaboration_metrics(BUSINESS_TYPE)' },
    { name: 'idx_risk_management_created_at', sql: 'CREATE INDEX idx_risk_management_created_at ON EAR.risk_management(CREATED_AT)' },
    { name: 'idx_risk_management_agent_type', sql: 'CREATE INDEX idx_risk_management_agent_type ON EAR.risk_management(AGENT_TYPE)' },
    { name: 'idx_risk_management_business_type', sql: 'CREATE INDEX idx_risk_management_business_type ON EAR.risk_management(BUSINESS_TYPE)' }
  ];

  let createdCount = 0;
  
  for (const index of indexes) {
    try {
      // 인덱스 존재 여부 확인
      const exists = await indexExists(index.name);
      
      if (!exists) {
        await query(index.sql);
        createdCount++;
      } else {
        // 인덱스가 이미 존재하는 경우 조용히 건너뜀
      }
    } catch (error: any) {
      // "already indexed" 오류는 정상적인 경우이므로 조용히 무시
      // (같은 컬럼에 다른 이름의 인덱스가 이미 존재할 수 있음)
      if (error.message && error.message.includes('already indexed')) {
        // 조용히 무시
      } else {
        console.error(`인덱스 생성 실패 (${index.name}):`, error.message);
      }
    }
  }
  
  if (createdCount > 0) {
    console.log(`✅ ${createdCount}개 인덱스 생성 완료`);
  }
}

// EAR 초기 데이터
async function initializeEARData() {
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
      const checkResult = await query(
        'SELECT ID FROM EAR.ear_keywords WHERE KEYWORD = ?',
        [keywordData.keyword]
      );

      if (!checkResult.rows || checkResult.rows.length === 0) {
        await query(
          'INSERT INTO EAR.ear_keywords (KEYWORD, DISPLAY_NAME, CATEGORY, CREATED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
          [keywordData.keyword, keywordData.display_name, keywordData.category]
        );
      }
    } catch (error: any) {
      // 조용히 무시
    }
  }
  
  console.log('✅ EAR 초기 데이터 설정 완료');
}

// 기본 관리자 계정
async function createDefaultAdmin() {
  try {
    const checkResult = await query(
      'SELECT ID FROM EAR.users WHERE USERID = ?',
      ['admin']
    );

    if (checkResult.rows && checkResult.rows.length > 0) {
      await query(
        'UPDATE EAR.users SET PASSWORD_HASH = ?, IS_ADMIN = ?, IS_ACTIVE = ? WHERE USERID = ?',
        ['$2b$10$3SBkj8urJRAiVRxl9cDk3OlMgCBwpolz8MpoAn6bQkoAzccHgzqy.', true, true, 'admin']
      );
    } else {
      await query(
        'INSERT INTO EAR.users (USERID, PASSWORD_HASH, FULL_NAME, IS_ADMIN, IS_ACTIVE) VALUES (?, ?, ?, ?, ?)',
        ['admin', '$2b$10$3SBkj8urJRAiVRxl9cDk3OlMgCBwpolz8MpoAn6bQkoAzccHgzqy.', '시스템 관리자', true, true]
      );
    }
    console.log('✅ 기본 관리자 계정 설정 완료');
  } catch (error: any) {
    console.error('기본 관리자 계정 설정 실패:', error.message);
  }
}

async function createDefaultPortalUsers() {
  try {
    const portalUsers = [
      { userid: 'portal-admin', fullName: '포털 관리자', isAdmin: true },
      { userid: 'portal-user', fullName: '포털 사용자', isAdmin: false }
    ];

    for (const portalUser of portalUsers) {
      await query(
        `MERGE INTO EAR.portal_users AS target
         USING (SELECT ? AS USERID, ? AS PASSWORD_HASH, ? AS FULL_NAME, ? AS IS_ADMIN, ? AS IS_ACTIVE, ? AS COMPANY_CODE FROM DUMMY) AS source
         ON (target.USERID = source.USERID)
         WHEN MATCHED THEN
           UPDATE SET PASSWORD_HASH = source.PASSWORD_HASH, IS_ADMIN = source.IS_ADMIN, IS_ACTIVE = source.IS_ACTIVE, COMPANY_CODE = source.COMPANY_CODE
         WHEN NOT MATCHED THEN
           INSERT (USERID, PASSWORD_HASH, FULL_NAME, IS_ADMIN, IS_ACTIVE, COMPANY_CODE, CREATED_AT, UPDATED_AT)
           VALUES (source.USERID, source.PASSWORD_HASH, source.FULL_NAME, source.IS_ADMIN, source.IS_ACTIVE, source.COMPANY_CODE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [
          portalUser.userid,
          '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
          portalUser.fullName,
          portalUser.isAdmin,
          true,
          'SKN'
        ]
      );
    }

    const adminIdResult = await query('SELECT ID FROM EAR.portal_users WHERE USERID = ?', ['portal-admin']);
    const adminId = adminIdResult.rows?.[0]?.ID || adminIdResult[0]?.ID;
    if (adminId) {
      await query(
        `MERGE INTO EAR.portal_user_roles AS target
         USING (SELECT ? AS USER_ID, ? AS ROLE_NAME FROM DUMMY) AS source
         ON (target.USER_ID = source.USER_ID AND target.ROLE_NAME = source.ROLE_NAME)
         WHEN NOT MATCHED THEN
           INSERT (USER_ID, ROLE_NAME, CREATED_AT, UPDATED_AT)
           VALUES (source.USER_ID, source.ROLE_NAME, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [adminId, 'admin']
      );
    }

    const userIdResult = await query('SELECT ID FROM EAR.portal_users WHERE USERID = ?', ['portal-user']);
    const userId = userIdResult.rows?.[0]?.ID || userIdResult[0]?.ID;
    if (userId) {
      await query(
        `MERGE INTO EAR.portal_user_roles AS target
         USING (SELECT ? AS USER_ID, ? AS ROLE_NAME FROM DUMMY) AS source
         ON (target.USER_ID = source.USER_ID AND target.ROLE_NAME = source.ROLE_NAME)
         WHEN NOT MATCHED THEN
           INSERT (USER_ID, ROLE_NAME, CREATED_AT, UPDATED_AT)
           VALUES (source.USER_ID, source.ROLE_NAME, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [userId, 'user']
      );
    }

    const roleMatrix = [
      { role: 'admin', permissions: '["portal:read","portal:write","metrics:write","roadmap:edit","settings:edit"]' },
      { role: 'user', permissions: '["portal:read"]' }
    ];

    for (const entry of roleMatrix) {
      await query(
        `MERGE INTO EAR.portal_role_matrix AS target
         USING (SELECT ? AS COMPANY_CODE, ? AS ROLE_NAME, ? AS PERMISSIONS FROM DUMMY) AS source
         ON (target.COMPANY_CODE = source.COMPANY_CODE AND target.ROLE_NAME = source.ROLE_NAME)
         WHEN MATCHED THEN
           UPDATE SET PERMISSIONS = source.PERMISSIONS, UPDATED_AT = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (COMPANY_CODE, ROLE_NAME, PERMISSIONS, CREATED_AT, UPDATED_AT)
           VALUES (source.COMPANY_CODE, source.ROLE_NAME, source.PERMISSIONS, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        ['SKN', entry.role, entry.permissions]
      );
    }

    console.log('✅ 포털 기본 계정/권한 매트릭스 설정 완료');
  } catch (error: any) {
    console.error('포털 기본 계정 설정 실패:', error.message);
  }
}

// IP 화이트리스트 초기화
async function initializeIpWhitelist() {
  try {
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
      // 기존 IP 확인
      const checkResult = await query(
        'SELECT ID FROM EAR.ip_whitelist WHERE IP_ADDRESS = ?',
        [ipData.ip]
      );
      
      if (!checkResult.rows || checkResult.rows.length === 0) {
        await query(
          'INSERT INTO EAR.ip_whitelist (IP_ADDRESS, DESCRIPTION, IS_ACTIVE, CREATED_BY) VALUES (?, ?, ?, ?)',
          [ipData.ip, ipData.description, true, 'system']
        );
      }
    }
    
    console.log('✅ IP 화이트리스트 초기화 완료');
  } catch (error: any) {
    console.error('IP 화이트리스트 초기화 실패:', error.message);
  }
}

// 메뉴 초기화
async function initializeMenus() {
  try {
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
      { parent: 'request', code: 'esm-registration', label: '요청등록', path: '/esm-request-registration', icon: 'FileText', order: 2 },
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
    
    // 1차 메뉴 삽입 (MERGE 사용하여 없으면 추가)
    const parentMenuMap = new Map<string, number>();
    for (const menu of primaryMenus) {
      // 기존 메뉴 확인
      const existingResult = await query(
        'SELECT ID FROM EAR.menus WHERE MENU_CODE = ?',
        [menu.code]
      );
      
      let menuId: number;
      if (existingResult.rows && existingResult.rows.length > 0) {
        menuId = existingResult.rows[0].ID || existingResult.rows[0].id;
      } else {
        await query(
          'INSERT INTO EAR.menus (MENU_CODE, LABEL, DISPLAY_ORDER, IS_ACTIVE, CREATED_BY) VALUES (?, ?, ?, ?, ?)',
          [menu.code, menu.label, menu.order, true, 'system']
        );
        const idResult = await query(
          'SELECT ID FROM EAR.menus WHERE MENU_CODE = ?',
          [menu.code]
        );
        if (idResult.rows && idResult.rows.length > 0) {
          menuId = idResult.rows[0].ID || idResult.rows[0].id;
        } else {
          continue;
        }
      }
      parentMenuMap.set(menu.code, menuId);
    }
    
    // 2차 메뉴 삽입 (MERGE 사용하여 없으면 추가)
    for (const item of menuItems) {
      const parentId = parentMenuMap.get(item.parent);
      if (!parentId) continue;
      
      // 기존 메뉴 확인
      const existingResult = await query(
        'SELECT ID FROM EAR.menus WHERE MENU_CODE = ?',
        [item.code]
      );
      
      if (!existingResult.rows || existingResult.rows.length === 0) {
        // 메뉴가 없으면 추가
        await query(
          'INSERT INTO EAR.menus (PARENT_ID, MENU_CODE, LABEL, PATH, ICON_NAME, DESCRIPTION, DISPLAY_ORDER, IS_ACTIVE, ADMIN_ONLY, CREATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [parentId, item.code, item.label, item.path, item.icon, item.label, item.order, true, item.adminOnly || false, 'system']
        );
      }
    }
    
    // EAR-ADMIN 그룹에 모든 메뉴 매핑 (초기 데이터)
    try {
      // 모든 활성 메뉴 조회
      const allMenusResult = await query(
        'SELECT ID FROM EAR.menus WHERE IS_ACTIVE = true'
      );
      
      if (allMenusResult.rows && allMenusResult.rows.length > 0) {
        const menuIds = allMenusResult.rows.map((row: any) => row.ID || row.id);
        
        // EAR-ADMIN 그룹에 모든 메뉴 매핑 (중복 체크)
        for (const menuId of menuIds) {
          // 기존 매핑 확인
          const existingMapping = await query(
            'SELECT ID FROM EAR.group_menu_mappings WHERE GROUP_NAME = ? AND MENU_ID = ?',
            ['EAR-ADMIN', menuId]
          );
          
          if (!existingMapping.rows || existingMapping.rows.length === 0) {
            // 매핑이 없으면 추가
            await query(
              'INSERT INTO EAR.group_menu_mappings (GROUP_NAME, MENU_ID, IS_ACTIVE, CREATED_BY) VALUES (?, ?, true, ?)',
              ['EAR-ADMIN', menuId, 'system']
            );
          }
        }
        
        console.log(`✅ EAR-ADMIN 그룹에 ${menuIds.length}개 메뉴 매핑 완료`);
      }
    } catch (mappingError: any) {
      console.warn('그룹별 메뉴 매핑 초기화 실패 (계속 진행):', mappingError.message);
    }
    
    console.log('✅ 메뉴 초기화 완료');
  } catch (error: any) {
    console.error('메뉴 초기화 실패:', error.message);
  }
}

// 에이전트 샘플 데이터 초기화 (옵션)
async function seedAgentData() {
  const existing = await query('SELECT COUNT(*) as count FROM EAR.agents');
  const count = Number(existing.rows?.[0]?.count || existing[0]?.count || 0);
  if (count > 0) {
    return;
  }

  const agents = [
    {
      name: 'Agent Alpha',
      description: '검색 기반 응답 에이전트',
      type: 'LLM',
      status: 'active',
      envConfig: JSON.stringify({ model: 'gpt-4o-mini', region: 'hana' }),
      maxConcurrency: 4,
      tags: JSON.stringify(['search', 'rag'])
    },
    {
      name: 'Agent Beta',
      description: '백오피스 자동화 에이전트',
      type: 'Automation',
      status: 'running',
      envConfig: JSON.stringify({ runtime: 'node', retries: 2 }),
      maxConcurrency: 2,
      tags: JSON.stringify(['automation'])
    },
    {
      name: 'Agent Gamma',
      description: '오류 감지 테스트 에이전트',
      type: 'Monitor',
      status: 'error',
      envConfig: JSON.stringify({ threshold: 0.2 }),
      maxConcurrency: 1,
      tags: JSON.stringify(['monitoring', 'ops'])
    }
  ];

  for (const agent of agents) {
    await query(
      `INSERT INTO EAR.agents (NAME, DESCRIPTION, TYPE, STATUS, ENV_CONFIG, MAX_CONCURRENCY, TAGS, IS_ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?, true)`,
      [
        agent.name,
        agent.description,
        agent.type,
        agent.status,
        agent.envConfig,
        agent.maxConcurrency,
        agent.tags
      ]
    );
  }

  const idResult = await query('SELECT TOP 3 ID FROM EAR.agents ORDER BY ID DESC');
  const ids = (idResult.rows || idResult || []).map((row: any) => row.ID).reverse();

  const roleMap = [
    { agentId: ids[0], roles: ['retrieval', 'answering'] },
    { agentId: ids[1], roles: ['workflow', 'scheduler'] },
    { agentId: ids[2], roles: ['monitoring'] }
  ];

  for (const entry of roleMap) {
    for (const role of entry.roles) {
      await query('INSERT INTO EAR.agent_roles (AGENT_ID, ROLE_NAME) VALUES (?, ?)', [
        entry.agentId,
        role
      ]);
    }
  }

  await query(
    `INSERT INTO EAR.agent_metrics
     (AGENT_ID, TIMESTAMP, CPU_USAGE, MEMORY_USAGE, REQUESTS_PROCESSED, AVG_LATENCY, ERROR_RATE, QUEUE_TIME)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
    [ids[0], 42.5, 61.2, 120, 210.4, 1.2, 12.5]
  );
  await query(
    `INSERT INTO EAR.agent_metrics
     (AGENT_ID, TIMESTAMP, CPU_USAGE, MEMORY_USAGE, REQUESTS_PROCESSED, AVG_LATENCY, ERROR_RATE, QUEUE_TIME)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`,
    [ids[1], 55.1, 68.7, 140, 185.7, 0.8, 9.4]
  );

  await query(
    `INSERT INTO EAR.job_queue (JOB_ID, PAYLOAD, PRIORITY, STATUS, ASSIGNED_AGENT_ID)
     VALUES (?, ?, ?, ?, ?)`,
    ['job-1001', JSON.stringify({ task: 'sample', jobId: 'job-1001' }), 1, 'queued', ids[1]]
  );
  await query(
    `INSERT INTO EAR.job_queue (JOB_ID, PAYLOAD, PRIORITY, STATUS, ASSIGNED_AGENT_ID)
     VALUES (?, ?, ?, ?, ?)`,
    ['job-1002', JSON.stringify({ task: 'sample', jobId: 'job-1002' }), 2, 'running', ids[0]]
  );

  await query(
    `INSERT INTO EAR.agent_tasks (AGENT_ID, JOB_ID, STATUS, RECEIVED_AT, STARTED_AT, RESULT)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
    [ids[0], 'job-1002', 'running', JSON.stringify({ note: 'processing' })]
  );

  console.log('✅ 에이전트 샘플 데이터 초기화 완료');
}

// 입력보안 설정 초기화
async function initializeInputSecurity() {
  try {
    // 주민등록번호 차단 설정 (기본값: 비활성화)
    await query(`
      MERGE INTO EAR.input_security_settings AS target
      USING (
        SELECT 'personal_info' AS SETTING_TYPE,
               'ssn' AS SETTING_KEY,
               '주민등록번호' AS SETTING_NAME,
               false AS IS_ENABLED,
               '\\d{6}-[1-4]\\d{6}' AS PATTERN
        FROM DUMMY
      ) AS source
      ON target.SETTING_TYPE = source.SETTING_TYPE AND target.SETTING_KEY = source.SETTING_KEY
      WHEN MATCHED THEN
        UPDATE SET SETTING_NAME = source.SETTING_NAME,
                     PATTERN = source.PATTERN
      WHEN NOT MATCHED THEN
        INSERT (SETTING_TYPE, SETTING_KEY, SETTING_NAME, IS_ENABLED, PATTERN)
        VALUES (source.SETTING_TYPE, source.SETTING_KEY, source.SETTING_NAME, source.IS_ENABLED, source.PATTERN)
    `);
    
    // 욕설 차단 설정 (기본값: 비활성화)
    await query(`
      MERGE INTO EAR.input_security_settings AS target
      USING (
        SELECT 'profanity' AS SETTING_TYPE,
               'profanity' AS SETTING_KEY,
               '욕설' AS SETTING_NAME,
               false AS IS_ENABLED,
               NULL AS PATTERN
        FROM DUMMY
      ) AS source
      ON target.SETTING_TYPE = source.SETTING_TYPE AND target.SETTING_KEY = source.SETTING_KEY
      WHEN MATCHED THEN
        UPDATE SET SETTING_NAME = source.SETTING_NAME
      WHEN NOT MATCHED THEN
        INSERT (SETTING_TYPE, SETTING_KEY, SETTING_NAME, IS_ENABLED, PATTERN)
        VALUES (source.SETTING_TYPE, source.SETTING_KEY, source.SETTING_NAME, source.IS_ENABLED, source.PATTERN)
    `);
    
    console.log('✅ 입력보안 설정 초기화 완료');
  } catch (error: any) {
    console.error('입력보안 설정 초기화 실패:', error.message);
  }
}

// 출력보안 설정 초기화
async function initializeOutputSecurity() {
  try {
    // 출력보안 차단 설정 (기본값: 비활성화)
    await query(`
      MERGE INTO EAR.output_security_settings AS target
      USING (
        SELECT 'output_security' AS SETTING_TYPE,
               'output_security' AS SETTING_KEY,
               '출력보안' AS SETTING_NAME,
               false AS IS_ENABLED
        FROM DUMMY
      ) AS source
      ON target.SETTING_TYPE = source.SETTING_TYPE AND target.SETTING_KEY = source.SETTING_KEY
      WHEN MATCHED THEN
        UPDATE SET SETTING_NAME = source.SETTING_NAME
      WHEN NOT MATCHED THEN
        INSERT (SETTING_TYPE, SETTING_KEY, SETTING_NAME, IS_ENABLED)
        VALUES (source.SETTING_TYPE, source.SETTING_KEY, source.SETTING_NAME, source.IS_ENABLED)
    `);
    
    console.log('✅ 출력보안 설정 초기화 완료');
  } catch (error: any) {
    console.error('출력보안 설정 초기화 실패:', error.message);
  }
}

export const pool = null; // HANA에서는 pool 개념 없음
