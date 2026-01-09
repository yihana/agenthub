import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Download, Calendar, User, Tag, X, FileText, Image, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';

interface EARRequest {
  id: number;
  request_title: string;
  request_content: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  template_name: string;
}

interface EARRequestDetail {
  id: number;
  request_title: string;
  request_content: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  template_id: number;
  template_name: string;
  template_description: string;
  keyword_display_name: string;
  form_data: any;
  attachments: Array<{
    name: string;
    size: number;
    type: string;
  }>;
}

interface RequestFilters {
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

const EARRequestList: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [requests, setRequests] = useState<EARRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RequestFilters>({
    status: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  
  // 상세보기 관련 상태
  const [selectedRequest, setSelectedRequest] = useState<EARRequestDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 삭제 관련 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<EARRequest | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusOptions = [
    { value: '', label: '전체' },
    { value: 'pending', label: '검토중' },
    { value: 'approved', label: '승인됨' },
    { value: 'rejected', label: '거부됨' },
    { value: 'in_progress', label: '진행중' },
    { value: 'completed', label: '완료됨' }
  ];

  // 요청 목록 조회
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '5',
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      const response = await fetch(`/api/ear/requests?${queryParams}`);
      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.total || 0);
        setError(null);
      } else {
        setError(data.error || '요청 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터 변경 핸들러
  const handleFilterChange = (key: keyof RequestFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      status: '',
      search: '',
      dateFrom: '',
      dateTo: ''
    });
    setCurrentPage(1);
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 상태별 색상 반환 (Status 기준: 01 검토중, 02 진행중, 05 완료)
  const getStatusColor = (status: string) => {
    // 상태 코드 기반 매핑
    if (status === '01' || status === '1' || status.toLowerCase() === 'pending') {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (status === '02' || status === '2' || status.toLowerCase() === 'in_progress') {
      return 'bg-blue-100 text-blue-800';
    }
    if (status === '05' || status === '5' || status.toLowerCase() === 'completed') {
      return 'bg-gray-100 text-gray-800';
    }
    // 기존 switch 문
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 상태 한글 변환 (Status 기준: 01 검토중, 02 진행중, 05 완료)
  const getStatusLabel = (status: string) => {
    // 상태 코드 기반 매핑
    if (status === '01' || status === '1' || status.toLowerCase() === 'pending') {
      return '검토중';
    }
    if (status === '02' || status === '2' || status.toLowerCase() === 'in_progress') {
      return '진행중';
    }
    if (status === '05' || status === '5' || status.toLowerCase() === 'completed') {
      return '완료';
    }
    // 기존 옵션에서 찾기
    const option = statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 뒤로가기
  const handleBack = () => {
    navigate('/');
  };

  // 요청 상세 보기
  const handleViewRequest = async (requestId: number) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/ear/requests/${requestId}`);
      const data = await response.json();

      if (response.ok) {
        setSelectedRequest(data.request);
        setShowDetailModal(true);
      } else {
        alert(`상세 정보를 불러오는데 실패했습니다: ${data.error}`);
      }
    } catch (error) {
      console.error('상세보기 오류:', error);
      alert('상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  // 상세보기 모달 닫기
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  // 삭제 모달 열기
  const handleDeleteRequest = (request: EARRequest, event: React.MouseEvent) => {
    event.stopPropagation(); // 상세보기 모달이 열리지 않도록 방지
    setRequestToDelete(request);
    setShowDeleteModal(true);
  };

  // 삭제 모달 닫기
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setRequestToDelete(null);
  };

  // 요청 삭제 실행
  const confirmDeleteRequest = async () => {
    if (!requestToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/ear/requests/${requestToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '삭제 중 오류가 발생했습니다.');
      }

      const result = await response.json();
      console.log('삭제 완료:', result);

      // 목록에서 삭제된 요청 제거
      setRequests(prev => prev.filter(req => req.id !== requestToDelete.id));
      
      // 총 개수 업데이트
      setTotalCount(prev => prev - 1);

      // 삭제 모달 닫기
      closeDeleteModal();

      alert('요청이 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 오류:', error);
      alert(`삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // 첨부파일 다운로드
  const handleDownloadAttachment = async (requestId: number, attachmentIndex: number, fileName: string) => {
    try {
      console.log('다운로드 시작:', { requestId, attachmentIndex, fileName });
      const response = await fetch(`/api/ear/requests/${requestId}/attachments/${attachmentIndex}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('다운로드 완료:', fileName);
      } else {
        const error = await response.json();
        console.error('다운로드 실패:', error);
        alert(`다운로드 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('첨부파일 다운로드 오류:', error);
      alert('첨부파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 첨부파일 미리보기
  const handlePreviewAttachment = async (requestId: number, attachmentIndex: number, _fileName: string, fileType: string) => {
    try {
      if (fileType.startsWith('image/')) {
        const response = await fetch(`/api/ear/requests/${requestId}/attachments/${attachmentIndex}/preview`);
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          // 이미지 미리보기 창 열기
          const previewWindow = window.open(url, '_blank', 'width=800,height=600');
          
          if (previewWindow) {
            // 창이 닫힐 때 URL 정리
            previewWindow.addEventListener('beforeunload', () => {
              window.URL.revokeObjectURL(url);
            });
          } else {
            // 팝업이 차단된 경우 URL 정리
            window.URL.revokeObjectURL(url);
            alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
          }
        } else {
          const error = await response.json();
          alert(`미리보기 실패: ${error.error}`);
        }
      } else {
        alert('이미지 파일만 미리보기가 가능합니다.');
      }
    } catch (error) {
      console.error('첨부파일 미리보기 오류:', error);
      alert('첨부파일 미리보기 중 오류가 발생했습니다.');
    }
  };

  // 요청 다운로드
  const handleDownloadRequest = (requestId: number) => {
    // 요청 정보를 파일로 다운로드
    console.log('요청 다운로드:', requestId);
    alert(`요청 ID ${requestId}의 정보를 다운로드합니다. (추후 구현 예정)`);
  };

  // 컴포넌트 마운트 및 필터 변경 시 데이터 조회
  useEffect(() => {
    fetchRequests();
  }, [currentPage, filters]);

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="EAR 요청목록"
        onTitleClick={handleBack}
      />
      <main className="app-main">
        <div className="ear-request-content" style={{ width: '90%', margin: '0 auto' }}>
        {/* 검색 및 필터 섹션 */}
        <div className="search-filter-section">
          <div className="search-bar">
            <div className="search-input-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="요청 제목이나 내용으로 검색..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`filter-toggle ${showFilters ? 'active' : ''}`}
            >
              <Filter size={16} />
              필터
            </button>
          </div>

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="filter-options">
              <div className="filter-row">
                <div className="filter-group">
                  <label>상태</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="filter-select"
                    aria-label="상태 필터"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>시작일</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="filter-input"
                    aria-label="시작일"
                  />
                </div>

                <div className="filter-group">
                  <label>종료일</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="filter-input"
                    aria-label="종료일"
                  />
                </div>

                <button onClick={resetFilters} className="reset-filters">
                  초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 요청 목록 */}
        <div className="request-list-section">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>요청 목록을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>❌ {error}</p>
              <button onClick={fetchRequests} className="retry-button">
                다시 시도
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <p>📝 등록된 요청이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="request-list">
                {requests.map((request) => (
                  <div key={request.id} className="request-item" onClick={() => handleViewRequest(request.id)}>
                    <div className="request-header">
                      <div className="request-title">
                        <h3>{request.request_title}</h3>
                        <span className={`status-badge ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      <div className="request-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="action-button view-button"
                          onClick={() => handleViewRequest(request.id)}
                          title="요청 상세보기"
                        >
                          <Eye size={16} />
                          보기
                        </button>
                        <button 
                          className="action-button download-button"
                          onClick={() => handleDownloadRequest(request.id)}
                          title="요청 다운로드"
                        >
                          <Download size={16} />
                          다운로드
                        </button>
                        <button 
                          className="action-button delete-button"
                          onClick={(e) => handleDeleteRequest(request, e)}
                          title="요청 삭제"
                        >
                          <Trash2 size={16} />
                          삭제
                        </button>
                      </div>
                    </div>

                    <div className="request-content">
                      <p>{request.request_content.substring(0, 100)}...</p>
                    </div>

                    <div className="request-meta">
                      <div className="meta-item">
                        <User size={14} />
                        <span>{request.created_by}</span>
                      </div>
                      <div className="meta-item">
                        <Tag size={14} />
                        <span>{request.template_name}</span>
                      </div>
                      <div className="meta-item">
                        <Calendar size={14} />
                        <span>{formatDate(request.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이징 정보 및 페이지네이션 */}
              <div className="pagination-info">
                <div className="pagination-stats">
                  <span>
                    총 <strong>{totalCount}</strong>개의 요청 중 
                    <strong> {(currentPage - 1) * 5 + 1}-{Math.min(currentPage * 5, totalCount)}</strong>번째 표시
                    (페이지 {currentPage}/{totalPages})
                  </span>
                </div>
                
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="page-button"
                    >
                      이전
                    </button>
                    
                    {/* 페이지 번호 표시 (최대 5개) */}
                    {(() => {
                      const startPage = Math.max(1, currentPage - 2);
                      const endPage = Math.min(totalPages, startPage + 4);
                      const pages = [];
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`page-button ${currentPage === i ? 'active' : ''}`}
                          >
                            {i}
                          </button>
                        );
                      }
                      return pages;
                    })()}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="page-button"
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 상세보기 모달 */}
      {showDetailModal && selectedRequest && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>요청 상세보기</h2>
              <button onClick={closeDetailModal} className="close-button" title="모달 닫기">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {detailLoading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>상세 정보를 불러오는 중...</p>
                </div>
              ) : (
                <>
                  {/* 기본 정보 */}
                  <div className="detail-section">
                    <h3>기본 정보</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>요청 제목</label>
                        <span>{selectedRequest.request_title}</span>
                      </div>
                      <div className="detail-item">
                        <label>상태</label>
                        <span className={`status-badge ${getStatusColor(selectedRequest.status)}`}>
                          {getStatusLabel(selectedRequest.status)}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>요청자</label>
                        <span>{selectedRequest.created_by}</span>
                      </div>
                      <div className="detail-item">
                        <label>요청일</label>
                        <span>{formatDate(selectedRequest.created_at)}</span>
                      </div>
                      <div className="detail-item">
                        <label>수정일</label>
                        <span>{formatDate(selectedRequest.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 요청 내용 */}
                  <div className="detail-section">
                    <h3>요청 내용</h3>
                    <div className="content-box">
                      <pre>{selectedRequest.request_content}</pre>
                    </div>
                  </div>

                  {/* 템플릿 정보 */}
                  {selectedRequest.template_name && (
                    <div className="detail-section">
                      <h3>템플릿 정보</h3>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <label>템플릿명</label>
                          <span>{selectedRequest.template_name}</span>
                        </div>
                        <div className="detail-item">
                          <label>카테고리</label>
                          <span>{selectedRequest.keyword_display_name}</span>
                        </div>
                        {selectedRequest.template_description && (
                          <div className="detail-item full-width">
                            <label>템플릿 설명</label>
                            <span>{selectedRequest.template_description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 추가 입력 정보 */}
                  {selectedRequest.form_data && Object.keys(selectedRequest.form_data).length > 0 && (
                    <div className="detail-section">
                      <h3>추가 입력 정보</h3>
                      <div className="detail-grid">
                        {Object.entries(selectedRequest.form_data).map(([key, value]) => (
                          <div key={key} className="detail-item">
                            <label>{key}</label>
                            <span>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 첨부파일 */}
                  <div className="detail-section">
                    <h3>첨부파일</h3>
                    {(() => {
                      console.log('첨부파일 데이터:', selectedRequest.attachments);
                      return null;
                    })()}
                    {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                      <div className="attachments-list">
                        {selectedRequest.attachments.map((file, index) => (
                          <div key={index} className="attachment-item">
                            {file.type.startsWith('image/') ? (
                              <Image size={16} />
                            ) : (
                              <FileText size={16} />
                            )}
                            <div className="attachment-info">
                              <span className="attachment-name">{file.name}</span>
                              <span className="attachment-size">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <div className="attachment-actions">
                              {file.type.startsWith('image/') && (
                                <button 
                                  className="preview-attachment"
                                  onClick={() => handlePreviewAttachment(selectedRequest.id, index, file.name, file.type)}
                                  title="미리보기"
                                >
                                  <Eye size={16} />
                                </button>
                              )}
                              <button 
                                className="download-attachment"
                                onClick={() => handleDownloadAttachment(selectedRequest.id, index, file.name)}
                                title="다운로드"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-attachments">
                        <FileText size={24} className="no-attachments-icon" />
                        <p>첨부파일이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={closeDetailModal} className="close-modal-button">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && requestToDelete && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>요청 삭제 확인</h2>
              <button onClick={closeDeleteModal} className="close-button" title="모달 닫기">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">
                  <Trash2 size={48} />
                </div>
                <div className="warning-content">
                  <h3>정말로 이 요청을 삭제하시겠습니까?</h3>
                  <p>삭제된 요청은 복구할 수 없으며, 첨부된 모든 파일도 함께 삭제됩니다.</p>
                  
                  <div className="request-info">
                    <h4>삭제될 요청 정보:</h4>
                    <div className="request-details">
                      <div className="detail-row">
                        <span className="label">제목:</span>
                        <span className="value">{requestToDelete.request_title}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">상태:</span>
                        <span className="value">{getStatusLabel(requestToDelete.status)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">생성일:</span>
                        <span className="value">{new Date(requestToDelete.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer delete-footer">
              <button 
                onClick={closeDeleteModal} 
                className="btn-secondary"
                disabled={deleteLoading}
              >
                취소
              </button>
              <button 
                onClick={confirmDeleteRequest} 
                className="btn-danger"
                disabled={deleteLoading}
              >
                {deleteLoading ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
      <AppBottom />
    </div>
  );
};

export default EARRequestList;
