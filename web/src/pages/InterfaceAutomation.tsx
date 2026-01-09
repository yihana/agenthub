import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Save, 
  Eye, 
  History, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import './InterfaceAutomation.css';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface ApiField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

interface StandardField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface FieldMapping {
  standardField: string;
  apiField: string;
  mappingType: 'direct' | 'transform' | 'custom';
  transformRule?: string;
}

interface CompanyInterface {
  id: string;
  companyName: string;
  apiUrl: string;
  authType: 'none' | 'bearer' | 'basic' | 'oauth2';
  authConfig: any;
  apiFields: ApiField[];
  mappings: FieldMapping[];
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface InterfaceHistory {
  id: string;
  interfaceId: string;
  changeType: 'create' | 'update' | 'delete';
  changes: any;
  timestamp: string;
  userId: string;
}

const InterfaceAutomation: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'history'>('create');
  
  // URL 분석 관련 상태
  const [apiUrl, setApiUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic' | 'oauth2'>('none');
  const [authConfig, setAuthConfig] = useState({
    token: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: '',
    scope: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ApiField[] | null>(null);
  
  // 매핑 관련 상태
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isMappingMode, setIsMappingMode] = useState(false);
  
  // 인터페이스 관리 상태
  const [interfaces, setInterfaces] = useState<CompanyInterface[]>([]);
  const [selectedInterface, _setSelectedInterface] = useState<CompanyInterface | null>(null);
  
  // 이력 관리 상태
  const [history, setHistory] = useState<InterfaceHistory[]>([]);
  const [selectedHistory, _setSelectedHistory] = useState<InterfaceHistory | null>(null);

  // 표준 사원정보 필드 정의
  const standardFields: StandardField[] = [
    { name: 'employeeId', type: 'string', description: '사원번호', required: true },
    { name: 'name', type: 'string', description: '성명', required: true },
    { name: 'department', type: 'string', description: '부서', required: true },
    { name: 'position', type: 'string', description: '직급', required: false },
    { name: 'email', type: 'string', description: '이메일', required: false },
    { name: 'phone', type: 'string', description: '전화번호', required: false },
    { name: 'hireDate', type: 'date', description: '입사일', required: false },
    { name: 'status', type: 'string', description: '재직상태', required: true }
  ];

  useEffect(() => {
    loadInterfaces();
    loadHistory();
  }, []);

  const loadInterfaces = async () => {
    try {
      console.log('인터페이스 목록 로드 시작...');
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      // 토큰이 있으면 인증 헤더 추가
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/interface-automation/interfaces', {
        headers
      });
      
      console.log('인터페이스 목록 응답 상태:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('인터페이스 목록 데이터:', data);
        console.log('인터페이스 개수:', data.length);
        setInterfaces(data);
      } else {
        const error = await response.json().catch(() => ({ error: '서버 응답 파싱 실패' }));
        console.error('인터페이스 목록 로드 실패:', error);
      }
    } catch (error: any) {
      console.error('인터페이스 목록 로드 오류:', error);
      alert(`인터페이스 목록을 불러올 수 없습니다: ${error.message || '네트워크 오류'}`);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/interface-automation/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('이력 로드 오류:', error);
    }
  };

  const analyzeApiUrl = async () => {
    if (!apiUrl.trim()) {
      alert('API URL을 입력해주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log('API 분석 요청:', { url: apiUrl, authType, authConfig });
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      // 토큰이 있으면 인증 헤더 추가
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/interface-automation/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: apiUrl,
          authType,
          authConfig
        })
      });

      console.log('API 분석 응답 상태:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('API 분석 결과:', result);
        
        if (result.success) {
          console.log('API 분석 성공, 필드 설정:', result.fields);
          console.log('필드 개수:', result.fields?.length || 0);
          
          setAnalysisResult(result.fields);
          generateAutoMappings(result.fields);
          setIsMappingMode(true);
          
          if (result.warning) {
            alert(`⚠️ ${result.warning}\n\n분석된 필드: ${result.fields?.length || 0}개`);
          } else {
            alert(`✅ ${result.message || 'API 분석이 완료되었습니다.'}\n\n분석된 필드: ${result.fields?.length || 0}개`);
          }
        } else {
          alert(`분석 실패: ${result.error || '알 수 없는 오류'}`);
        }
      } else {
        const error = await response.json().catch(() => ({ error: '서버 응답을 파싱할 수 없습니다.' }));
        console.error('API 분석 오류 응답:', error);
        alert(`분석 실패: ${error.error || error.message || `HTTP ${response.status}`}`);
      }
    } catch (error: any) {
      console.error('API 분석 오류:', error);
      alert(`API 분석 중 오류가 발생했습니다: ${error.message || '네트워크 오류'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAutoMappings = (apiFields: ApiField[]) => {
    console.log('자동 매핑 생성 시작:', apiFields);
    const autoMappings: FieldMapping[] = [];
    
    // 매핑 규칙 정의 (더 유연한 매핑)
    const mappingRules = [
      // employeeId 매핑
      { patterns: ['emp_id', 'employee_id', 'employee_number', 'staff_id', 'id'], standardField: 'employeeId' },
      // name 매핑
      { patterns: ['name', 'full_name', 'employee_name', 'staff_name'], standardField: 'name' },
      // department 매핑
      { patterns: ['department', 'dept', 'dept_name', 'dept_code', 'division'], standardField: 'department' },
      // position 매핑
      { patterns: ['position', 'position_name', 'role', 'title', 'job_title'], standardField: 'position' },
      // email 매핑
      { patterns: ['email', 'email_address', 'mail'], standardField: 'email' },
      // phone 매핑
      { patterns: ['phone', 'mobile_phone', 'phone_number', 'tel'], standardField: 'phone' },
      // hireDate 매핑
      { patterns: ['hire_date', 'start_date', 'join_date', 'employment_date'], standardField: 'hireDate' },
      // status 매핑
      { patterns: ['status', 'work_status', 'employment_status', 'active'], standardField: 'status' }
    ];
    
    apiFields.forEach(apiField => {
      console.log('API 필드 처리:', apiField.name);
      
      // 패턴 매칭으로 표준 필드 찾기
      let matchedStandardField = null;
      
      for (const rule of mappingRules) {
        const isMatch = rule.patterns.some(pattern => {
          const apiFieldLower = apiField.name.toLowerCase();
          const patternLower = pattern.toLowerCase();
          return apiFieldLower.includes(patternLower) || patternLower.includes(apiFieldLower);
        });
        
        if (isMatch) {
          matchedStandardField = rule.standardField;
          break;
        }
      }
      
      // 기존 방식으로도 시도
      if (!matchedStandardField) {
        matchedStandardField = standardFields.find(std => 
          std.name.toLowerCase().includes(apiField.name.toLowerCase()) ||
          apiField.name.toLowerCase().includes(std.name.toLowerCase())
        )?.name;
      }
      
      if (matchedStandardField) {
        autoMappings.push({
          standardField: matchedStandardField,
          apiField: apiField.name,
          mappingType: 'direct'
        });
        console.log(`매핑 생성: ${apiField.name} → ${matchedStandardField}`);
      } else {
        // 매핑되지 않은 필드도 빈 매핑으로 추가
        autoMappings.push({
          standardField: '',
          apiField: apiField.name,
          mappingType: 'direct'
        });
        console.log(`매핑 없음: ${apiField.name}`);
      }
    });
    
    console.log('생성된 매핑:', autoMappings);
    setMappings(autoMappings);
  };

  const updateMapping = (index: number, field: keyof FieldMapping, value: any) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const saveInterface = async () => {
    if (!apiUrl.trim() || !analysisResult) {
      alert('API URL 분석을 먼저 완료해주세요.');
      return;
    }

    const companyName = prompt('회사명을 입력해주세요:');
    if (!companyName) return;

    try {
      const saveData = {
        companyName,
        apiUrl,
        authType,
        authConfig,
        apiFields: analysisResult,
        mappings
      };
      
      console.log('인터페이스 저장 요청:', saveData);
      
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      // 토큰이 있으면 인증 헤더 추가
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/interface-automation/save', {
        method: 'POST',
        headers,
        body: JSON.stringify(saveData)
      });

      console.log('저장 응답 상태:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('저장 성공:', result);
        alert(`✅ ${result.message || '인터페이스가 성공적으로 저장되었습니다.'}`);
        loadInterfaces();
        resetForm();
      } else {
        const error = await response.json().catch(() => ({ error: '서버 응답을 파싱할 수 없습니다.' }));
        console.error('저장 실패 응답:', error);
        alert(`❌ 저장 실패: ${error.error || error.message || `HTTP ${response.status}`}`);
      }
    } catch (error: any) {
      console.error('인터페이스 저장 오류:', error);
      alert(`❌ 저장 중 오류가 발생했습니다: ${error.message || '네트워크 오류'}`);
    }
  };

  const resetForm = () => {
    setApiUrl('');
    setAuthType('none');
    setAuthConfig({
      token: '',
      username: '',
      password: '',
      clientId: '',
      clientSecret: '',
      scope: ''
    });
    setAnalysisResult(null);
    setMappings([]);
    setIsMappingMode(false);
  };

  const handleViewDetails = (interfaceItem: CompanyInterface) => {
    console.log('상세보기:', interfaceItem);
    
    // 상세 정보를 alert로 표시 (임시)
    const details = `
🏢 회사명: ${interfaceItem.companyName}
🔗 API URL: ${interfaceItem.apiUrl}
🔐 인증 방식: ${interfaceItem.authType}
📊 상태: ${interfaceItem.status}
📋 필드 개수: ${interfaceItem.apiFields?.length || 0}개
🔄 매핑 개수: ${interfaceItem.mappings?.length || 0}개
📅 생성일: ${new Date(interfaceItem.createdAt).toLocaleString()}
📅 수정일: ${new Date(interfaceItem.updatedAt).toLocaleString()}

필드 매핑:
${interfaceItem.mappings?.map((m: FieldMapping) => 
  `  • ${m.apiField} → ${m.standardField} (${m.mappingType})`
).join('\n') || '없음'}
    `;
    
    alert(details);
    setSelectedInterface(interfaceItem);
  };

  const handleEditInterface = (interfaceItem: CompanyInterface) => {
    console.log('설정:', interfaceItem);
    
    const action = confirm(`"${interfaceItem.companyName}" 인터페이스를 수정하시겠습니까?\n\n확인: 수정\n취소: 삭제`);
    
    if (action) {
      // 수정 모드로 전환
      setApiUrl(interfaceItem.apiUrl);
      setAuthType(interfaceItem.authType);
      setAuthConfig(interfaceItem.authConfig || {
        token: '',
        username: '',
        password: '',
        clientId: '',
        clientSecret: '',
        scope: ''
      });
      setAnalysisResult(interfaceItem.apiFields || []);
      setMappings(interfaceItem.mappings || []);
      setIsMappingMode(true);
      setActiveTab('create');
      
      alert('✅ 수정 모드로 전환되었습니다.\n"인터페이스 생성" 탭에서 수정 후 저장해주세요.');
    } else {
      // 삭제 확인
      handleDeleteInterface(interfaceItem);
    }
  };

  const handleDeleteInterface = async (interfaceItem: CompanyInterface) => {
    const confirmDelete = confirm(`정말로 "${interfaceItem.companyName}" 인터페이스를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    
    if (!confirmDelete) return;

    try {
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/interface-automation/interfaces/${interfaceItem.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        alert(`✅ "${interfaceItem.companyName}" 인터페이스가 삭제되었습니다.`);
        loadInterfaces();
      } else {
        const error = await response.json().catch(() => ({ error: '서버 응답 파싱 실패' }));
        alert(`❌ 삭제 실패: ${error.error || `HTTP ${response.status}`}`);
      }
    } catch (error: any) {
      console.error('인터페이스 삭제 오류:', error);
      alert(`❌ 삭제 중 오류가 발생했습니다: ${error.message || '네트워크 오류'}`);
    }
  };

  const renderCreateTab = () => (
    <div className="interface-create">
      <div className="create-section">
        <h3>1. API 정보 입력</h3>
        <div className="form-group">
          <label>API URL</label>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com/employees"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="auth-type">인증 방식</label>
          <select
            id="auth-type"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as any)}
            className="form-select"
            aria-label="인증 방식 선택"
          >
            <option value="none">인증 없음</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth2">OAuth2</option>
          </select>
        </div>

        {authType === 'bearer' && (
          <div className="form-group">
            <label>Bearer Token</label>
            <input
              type="password"
              value={authConfig.token}
              onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
              placeholder="Bearer Token 입력"
              className="form-input"
            />
          </div>
        )}

        {authType === 'basic' && (
          <>
            <div className="form-group">
              <label>사용자명</label>
              <input
                type="text"
                value={authConfig.username}
                onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                placeholder="사용자명"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={authConfig.password}
                onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                placeholder="비밀번호"
                className="form-input"
              />
            </div>
          </>
        )}

        {authType === 'oauth2' && (
          <>
            <div className="form-group">
              <label>Client ID</label>
              <input
                type="text"
                value={authConfig.clientId}
                onChange={(e) => setAuthConfig({ ...authConfig, clientId: e.target.value })}
                placeholder="Client ID"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Client Secret</label>
              <input
                type="password"
                value={authConfig.clientSecret}
                onChange={(e) => setAuthConfig({ ...authConfig, clientSecret: e.target.value })}
                placeholder="Client Secret"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Scope</label>
              <input
                type="text"
                value={authConfig.scope}
                onChange={(e) => setAuthConfig({ ...authConfig, scope: e.target.value })}
                placeholder="read:employees"
                className="form-input"
              />
            </div>
          </>
        )}

        <button
          onClick={analyzeApiUrl}
          disabled={isAnalyzing}
          className="btn btn-primary"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="spinning" size={16} />
              분석 중...
            </>
          ) : (
            <>
              <Play size={16} />
              API 분석 및 매핑
            </>
          )}
        </button>
      </div>

      {isMappingMode && analysisResult && (
        <div className="mapping-section">
          <h3>2. 필드 매핑 설정</h3>
          <div className="mapping-table">
            <div className="mapping-header">
              <div className="mapping-cell">표준 필드</div>
              <div className="mapping-cell">API 필드</div>
              <div className="mapping-cell">매핑 방식</div>
              <div className="mapping-cell">변환 규칙</div>
            </div>
            {mappings.length === 0 ? (
              <div className="mapping-row">
                <div className="mapping-cell" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#666' }}>
                  매핑할 필드가 없습니다. API 분석을 먼저 실행해주세요.
                </div>
              </div>
            ) : (
              mappings.map((mapping, index) => (
                <div key={index} className="mapping-row">
                  <div className="mapping-cell">
                    <select
                      value={mapping.standardField}
                      onChange={(e) => updateMapping(index, 'standardField', e.target.value)}
                      className="form-select"
                      aria-label={`표준 필드 ${index + 1}`}
                    >
                      <option value="">선택하세요</option>
                      {standardFields.map(field => (
                        <option key={field.name} value={field.name}>
                          {field.description} ({field.name})
                        </option>
                      ))}
                    </select>
                  </div>
                <div className="mapping-cell">
                  <input
                    type="text"
                    value={mapping.apiField}
                    onChange={(e) => updateMapping(index, 'apiField', e.target.value)}
                    className="form-input"
                    placeholder="API 필드명"
                    aria-label={`API 필드 ${index + 1}`}
                  />
                </div>
                <div className="mapping-cell">
                  <select
                    value={mapping.mappingType}
                    onChange={(e) => updateMapping(index, 'mappingType', e.target.value)}
                    className="form-select"
                    aria-label={`매핑 방식 ${index + 1}`}
                  >
                    <option value="direct">직접 매핑</option>
                    <option value="transform">변환 매핑</option>
                    <option value="custom">커스텀</option>
                  </select>
                </div>
                <div className="mapping-cell">
                  {mapping.mappingType !== 'direct' && (
                    <input
                      type="text"
                      value={mapping.transformRule || ''}
                      onChange={(e) => updateMapping(index, 'transformRule', e.target.value)}
                      placeholder="변환 규칙"
                      className="form-input"
                    />
                  )}
                </div>
              </div>
            ))
            )}
          </div>

          <div className="mapping-actions">
            <button onClick={saveInterface} className="btn btn-success">
              <Save size={16} />
              인터페이스 저장
            </button>
            <button onClick={resetForm} className="btn btn-secondary">
              초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderManageTab = () => (
    <div className="interface-manage">
      <div className="manage-header">
        <h3>등록된 인터페이스 목록</h3>
        <button onClick={loadInterfaces} className="btn btn-secondary">
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      <div className="interface-list">
        {interfaces.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            fontSize: '16px' 
          }}>
            등록된 인터페이스가 없습니다.<br />
            "인터페이스 생성" 탭에서 새로운 인터페이스를 생성해보세요.
          </div>
        ) : (
          interfaces.map((interfaceItem) => (
          <div key={interfaceItem.id} className="interface-card">
            <div className="interface-header">
              <h4>{interfaceItem.companyName}</h4>
              <div className={`status-badge ${interfaceItem.status}`}>
                {interfaceItem.status === 'active' && <CheckCircle size={16} />}
                {interfaceItem.status === 'inactive' && <AlertCircle size={16} />}
                {interfaceItem.status === 'error' && <AlertCircle size={16} />}
                {interfaceItem.status}
              </div>
            </div>
            <div className="interface-details">
              <p><strong>API URL:</strong> {interfaceItem.apiUrl}</p>
              <p><strong>인증 방식:</strong> {interfaceItem.authType}</p>
              <p><strong>생성일:</strong> {new Date(interfaceItem.createdAt).toLocaleDateString()}</p>
              <p><strong>수정일:</strong> {new Date(interfaceItem.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="interface-actions">
              <button 
                onClick={() => handleViewDetails(interfaceItem)}
                className="btn btn-primary"
              >
                <Eye size={16} />
                상세보기
              </button>
              <button 
                onClick={() => handleEditInterface(interfaceItem)}
                className="btn btn-secondary"
              >
                <Settings size={16} />
                설정
              </button>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="interface-history">
      <div className="history-header">
        <h3>변경 이력</h3>
        <button onClick={loadHistory} className="btn btn-secondary">
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      <div className="history-list">
        {history.map((historyItem) => (
          <div key={historyItem.id} className="history-card">
            <div className="history-header-info">
              <div className="history-type">
                <span className={`type-badge ${historyItem.changeType}`}>
                  {historyItem.changeType}
                </span>
              </div>
              <div className="history-time">
                {new Date(historyItem.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="history-details">
              <p><strong>인터페이스 ID:</strong> {historyItem.interfaceId}</p>
              <p><strong>사용자:</strong> {historyItem.userId}</p>
            </div>
            <div className="history-actions">
              <button 
                onClick={() => setSelectedHistory(historyItem)}
                className="btn btn-primary"
              >
                <History size={16} />
                상세보기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="인터페이스 연동 자동화"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="interface-automation-container" style={{ width: '90%', margin: '0 auto' }}>
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <Play size={16} />
          인터페이스 생성
        </button>
        <button
          className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          <Settings size={16} />
          인터페이스 관리
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} />
          변경 이력
        </button>

      <div className="tab-content">
        {activeTab === 'create' && renderCreateTab()}
        {activeTab === 'manage' && renderManageTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>
        </div>
      </main>
    </div>
  );
};

export default InterfaceAutomation;
