import React, { useState, useEffect } from 'react';
import { FileText, X, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';

interface ESMRequest {
  id: string;
  request_title: string;
  status: string;
  created_at: string;
  created_by?: string;
  request_content?: string;
  extensions?: {
    ZCOTIME?: string;
    [key: string]: any;
  };
  history?: {
    requestedOn?: string;
    receivedOn?: string;
    processedOn?: string;
    completedOn?: string;
    isReceived?: boolean;
    isCompleted?: boolean;
  };
}

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const RequestStatusPane: React.FC = () => {
  const [esmRequests, setEsmRequests] = useState<ESMRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ESMRequest | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });

  useEffect(() => {
    loadESMRequests();
  }, []);

  const loadESMRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/c4c/cases', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // 응답 형식에 따라 데이터 추출
        let cases = [];
        if (data.value) {
          if (Array.isArray(data.value)) {
            cases = data.value;
          } else {
            // value가 단일 객체인 경우
            cases = [data.value];
          }
        } else if (Array.isArray(data)) {
          cases = data;
        }
        
        // SAP C4C 응답을 UI 형식으로 매핑
        const mappedRequests = cases.map((caseItem: any) => {
          // 상태 매핑 (SAP 상태 -> 내부 상태)
          // Status 기준: 01 검토중, 02 진행중, 05 완료
          let status = 'pending';
          const statusCode = caseItem.status || caseItem.statusCode || '';
          const statusDesc = caseItem.statusDescription?.toLowerCase() || '';
          const lifeCycleStatus = caseItem.lifeCycleStatus?.toLowerCase() || '';
          
          // 상태 코드 기반 매핑 (우선순위: 코드 > 설명)
          if (statusCode === '01' || statusCode === '1') {
            status = 'pending';
          } else if (statusCode === '02' || statusCode === '2') {
            status = 'in_progress';
          } else if (statusCode === '05' || statusCode === '5') {
            status = 'completed';
          } else if (lifeCycleStatus === 'open' && statusDesc === 'open') {
            status = 'in_progress';
          } else if (lifeCycleStatus === 'closed' || statusDesc.includes('완료') || statusDesc.includes('closed')) {
            status = 'completed';
          } else if (statusDesc.includes('대기') || statusDesc.includes('검토중') || statusDesc.includes('pending')) {
            status = 'pending';
          }
          
          // 처리이력 데이터 추출
          const requestedOn = caseItem.adminData?.createdOn;
          const zretime = caseItem.extensions?.ZRETIME;
          const initialReviewCompletedOn = caseItem.timePoints?.initialReviewCompletedOn;
          // 완료 기준 일시는 확장 필드 ZACTIME을 사용
          const completedOn = caseItem.extensions?.ZACTIME;
          
          // 접수 시간: ZRETIME이 있으면 사용, 없으면 initialReviewCompletedOn 사용
          const receivedOn = zretime || initialReviewCompletedOn;
          const isReceived = !!receivedOn;
          
          // 완료 여부: ZACTIME 존재 여부 기준
          const isCompleted = !!completedOn;
          
          return {
            id: caseItem.id || caseItem.displayId,
            displayId: caseItem.displayId,
            request_title: `[${caseItem.displayId || ''}] ${caseItem.subject || ''}`,
            request_content: caseItem.description?.content || '',
            status: status,
            statusDescription: caseItem.statusDescription || '',
            priority: caseItem.priorityDescription || '',
            caseType: caseItem.caseTypeDescription || '',
            created_at: caseItem.timePoints?.reportedOn || caseItem.adminData?.createdOn || new Date().toISOString(),
            account: caseItem.account?.name || '',
            contact: caseItem.contact?.name || '',
            extensions: caseItem.extensions || {},
            history: {
              requestedOn: requestedOn,
              receivedOn: receivedOn,
              processedOn: initialReviewCompletedOn,
              completedOn: completedOn,
              isReceived: isReceived,
              isCompleted: isCompleted
            }
          };
        });
        
        // 최신순으로 정렬
        const sortedRequests = mappedRequests.sort((a: ESMRequest, b: ESMRequest) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEsmRequests(sortedRequests);
        
        // 통계 계산
        const total = cases.length;
        const pending = mappedRequests.filter((r: any) => r.status === 'pending').length;
        const inProgress = mappedRequests.filter((r: any) => r.status === 'in_progress').length;
        const completed = mappedRequests.filter((r: any) => r.status === 'completed').length;
        
        setStats({ total, pending, inProgress, completed });
      } else {
        console.error('C4C API 응답 오류:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
        console.error('오류 상세:', errorData);
        setEsmRequests([]);
        setStats({ total: 0, pending: 0, inProgress: 0, completed: 0 });
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
      setEsmRequests([]);
      setStats({ total: 0, pending: 0, inProgress: 0, completed: 0 });
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleRequestSelect = async (request: ESMRequest) => {
    // 상세 정보를 가져오기 위해 API 호출
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/c4c/cases/${request.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // 응답 형식에 따라 데이터 추출
        let caseItem = null;
        if (data.value) {
          caseItem = Array.isArray(data.value) ? data.value[0] : data.value;
        } else {
          caseItem = data;
        }
        
        if (caseItem) {
          // 기존 request 정보와 상세 정보 병합
          const detailedRequest: ESMRequest = {
            ...request,
            extensions: caseItem.extensions || request.extensions || {}
          };
          setSelectedRequest(detailedRequest);
        } else {
          // 상세 정보를 가져오지 못한 경우 목록 데이터 사용
          setSelectedRequest(request);
        }
      } else {
        // 상세 정보를 가져오지 못한 경우 목록 데이터 사용
        console.warn('Case 상세 정보를 가져오지 못했습니다. 목록 데이터를 사용합니다.');
        setSelectedRequest(request);
      }
    } catch (error) {
      console.error('Failed to load case detail:', error);
      // 오류 발생 시 목록 데이터 사용
      setSelectedRequest(request);
    }
  };

  const getStatusLabel = (status: string) => {
    // Status 기준: 01 검토중, 02 진행중, 05 완료
    const statusUpper = status.toUpperCase();
    const statusLower = status.toLowerCase();
    
    // 상태 코드 기반 매핑
    if (status === '01' || status === '1' || statusLower === 'pending' || statusUpper === 'PENDING') {
      return '검토중';
    }
    if (status === '02' || status === '2' || statusLower === 'in_progress' || statusUpper === 'IN_PROGRESS') {
      return '진행중';
    }
    if (status === '05' || status === '5' || statusLower === 'completed' || statusUpper === 'COMPLETED') {
      return '완료';
    }
    if (statusLower === 'rejected' || statusUpper === 'REJECTED') return '거부됨';
    if (statusUpper === 'CANCELLED') return '취소';
    return status;
  };

  const getStatusColor = (status: string) => {
    // Status 기준: 01 검토중, 02 진행중, 05 완료
    const statusUpper = status.toUpperCase();
    const statusLower = status.toLowerCase();
    
    // 상태 코드 기반 매핑
    if (status === '01' || status === '1' || statusLower === 'pending' || statusUpper === 'PENDING') {
      return '#f59e0b';
    }
    if (status === '02' || status === '2' || statusLower === 'in_progress' || statusUpper === 'IN_PROGRESS') {
      return '#3b82f6';
    }
    if (status === '05' || status === '5' || statusLower === 'completed' || statusUpper === 'COMPLETED') {
      return '#10b981';
    }
    if (statusLower === 'rejected' || statusUpper === 'REJECTED') return '#ef4444';
    if (statusUpper === 'CANCELLED') return '#6b7280';
    return '#6b7280';
  };

  // UTC 시간을 한국 시간(UTC+9)으로 변환하는 헬퍼 함수
  const convertToKoreaTime = (utcDateString: string): Date => {
    // UTC 시간을 파싱 (ISO 8601 형식의 UTC 시간 문자열)
    const utcDate = new Date(utcDateString);
    // UTC 시간에 9시간(한국 시간 오프셋)을 더함
    const koreaTime = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const koreaDate = convertToKoreaTime(dateString);
      // 한국 시간으로 변환된 Date 객체에서 로컬 시간 메서드 사용
      // 브라우저의 로컬 시간대가 한국이 아닐 수 있으므로, UTC 메서드를 사용하되
      // 변환된 시간을 올바르게 가져오기 위해 getUTCFullYear() 등을 사용
      // (9시간을 더한 Date 객체의 UTC 메서드는 변환된 시간을 반환)
      const year = koreaDate.getUTCFullYear();
      const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(koreaDate.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return '-';
    }
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      // UTC 시간을 파싱
      const utcDate = new Date(dateString);
      
      // UTC 시간의 각 구성 요소를 가져옴
      const utcYear = utcDate.getUTCFullYear();
      const utcMonth = utcDate.getUTCMonth();
      const utcDay = utcDate.getUTCDate();
      const utcHours = utcDate.getUTCHours();
      const utcMinutes = utcDate.getUTCMinutes();
      const utcSeconds = utcDate.getUTCSeconds();
      
      // 한국 시간으로 변환 (UTC + 9시간)
      let koreaHours = utcHours + 9;
      let koreaDay = utcDay;
      let koreaMonth = utcMonth;
      let koreaYear = utcYear;
      
      // 시간이 24를 넘으면 다음 날로
      if (koreaHours >= 24) {
        koreaHours -= 24;
        koreaDay += 1;
        
        // 날짜가 월의 마지막 날을 넘으면 다음 달로
        const daysInMonth = new Date(koreaYear, koreaMonth + 1, 0).getDate();
        if (koreaDay > daysInMonth) {
          koreaDay = 1;
          koreaMonth += 1;
          
          // 월이 12를 넘으면 다음 해로
          if (koreaMonth >= 12) {
            koreaMonth = 0;
            koreaYear += 1;
          }
        }
      }
      
      const year = String(koreaYear).padStart(4, '0');
      const month = String(koreaMonth + 1).padStart(2, '0');
      const day = String(koreaDay).padStart(2, '0');
      const hours = String(koreaHours).padStart(2, '0');
      const minutes = String(utcMinutes).padStart(2, '0');
      const seconds = String(utcSeconds).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return '-';
    }
  };

  return (
    <div className="request-status-pane">
      <div className="request-status-header">
        <h3 className="request-status-title">
          <FileText size={18} style={{ marginRight: '0.5rem' }} />
          요청현황
        </h3>
      </div>

      {/* 통계 섹션 */}
      <div className="request-status-stats-container" style={{ 
        marginBottom: '0.5rem', 
        padding: '0.5rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '0.4rem' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.4rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '6px', 
              backgroundColor: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.4rem'
            }}>
              <TrendingUp size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>전체</div>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.4rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '6px', 
              backgroundColor: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.4rem'
            }}>
              <Clock size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                {stats.pending}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>검토중</div>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.4rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '6px', 
              backgroundColor: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.4rem'
            }}>
              <AlertCircle size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                {stats.inProgress}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>진행중</div>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.4rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '6px', 
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.4rem'
            }}>
              <CheckCircle size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                {stats.completed}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>완료</div>
            </div>
          </div>
        </div>
      </div>

      <div className="request-status-list-container">
        <div className="request-status-list">
            {isLoadingRequests ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#6b7280', 
                padding: '2rem 1rem',
                fontSize: '0.9rem'
              }}>
                <p>요청 목록을 불러오는 중...</p>
              </div>
            ) : esmRequests.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#6b7280', 
                padding: '2rem 1rem',
                fontSize: '0.9rem'
              }}>
                <FileText size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>요청이 없습니다.</p>
              </div>
            ) : (
              esmRequests.map((request) => (
                <div
                  key={request.id}
                  className="request-status-item"
                  onClick={() => handleRequestSelect(request)}
                >
                  <div className="request-status-item-content">
                    <div className="request-status-item-title">{request.request_title}</div>
                    <div 
                      className="request-status-item-status"
                      style={{ color: getStatusColor(request.status) }}
                    >
                      {getStatusLabel(request.status)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
      </div>

      {/* 요청 상세 모달 팝업 */}
      {selectedRequest && (
        <div 
          className="request-detail-modal-overlay"
          onClick={() => setSelectedRequest(null)}
        >
          <div 
            className="request-detail-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="request-detail-header">
              <h4 className="request-detail-title">요청 상세</h4>
              <button 
                className="request-detail-close"
                onClick={() => setSelectedRequest(null)}
                title="닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="request-detail-content">
              {/* 임시주석 처리 <h3 className="request-history-title">요청내용</h3> */}
              <div className="request-detail-item">
                <span className="request-detail-label">제목:</span>
                <span className="request-detail-value">{selectedRequest.request_title}</span>
              </div>
              <div className="request-detail-item">
                <span className="request-detail-label">처리상태:</span>
                <span 
                  className="request-detail-status"
                  style={{ color: getStatusColor(selectedRequest.status) }}
                >
                  {getStatusLabel(selectedRequest.status)}
                </span>
              </div>
              {selectedRequest.request_content && (
                <div className="request-detail-item">
                  <span className="request-detail-label">내용:</span>
                  <div className="request-detail-value">{selectedRequest.request_content}</div>
                </div>
              )}
            </div>
            <div className="request-history-section">
              {/* 임시주석 처리 <h3 className="request-history-title">처리이력</h3> */}
              <div className="request-history-list">
                <div className="request-history-item">
                  <div className="request-history-user">요청</div>
                  <div className="request-history-action">요청이 등록 되었습니다.</div>
                  <div className="request-history-date">{formatDateTime(selectedRequest.history?.requestedOn)}</div>
                </div>
                {selectedRequest.history?.isReceived ? (
                  <div className="request-history-item">
                    <div className="request-history-user">접수</div>
                    <div className="request-history-action">담당자에게 접수 되었습니다.</div>
                    <div className="request-history-date">{formatDateTime(selectedRequest.history?.receivedOn)}</div>
                  </div>
                ) : (
                  <div className="request-history-item">
                    <div className="request-history-user">접수</div>
                    <div className="request-history-action">-</div>
                    <div className="request-history-date">-</div>
                  </div>
                )}
                {selectedRequest.history?.processedOn ? (
                  <div className="request-history-item">
                    <div className="request-history-user">처리</div>
                    <div className="request-history-action">처리를 시작 하였습니다.</div>
                    <div className="request-history-date">{formatDateTime(selectedRequest.history?.processedOn)}</div>
                  </div>
                ) : (
                  <div className="request-history-item">
                    <div className="request-history-user">처리</div>
                    <div className="request-history-action">-</div>
                    <div className="request-history-date">-</div>
                  </div>
                )}
                <div className="request-history-item">
                  <div className="request-history-user">완료</div>
                  <div className="request-history-action">
                    {selectedRequest.history?.isCompleted ? '요청이 완료 되었습니다.' : '-'}
                  </div>
                  <div className="request-history-date">
                    {selectedRequest.history?.isCompleted 
                      ? formatDateTime(selectedRequest.history?.completedOn) 
                      : '-'}
                  </div>
                </div>
              </div>
              <div className="request-scheduled-date">
                <span className="request-scheduled-label">완료예정일 : </span>
                <span className="request-scheduled-value">
                  {selectedRequest.extensions?.ZCOTIME 
                    ? formatDate(selectedRequest.extensions.ZCOTIME)
                    : '입력안됨'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestStatusPane;

