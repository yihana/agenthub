import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Download, 
  Calendar,
  User,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Lock,
  RefreshCw
} from 'lucide-react';
import './LoginHistoryPage.css';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface LoginHistoryItem {
  id: number;
  user_id: number;
  userid: string;
  login_time: string;
  ip_address: string;
  user_agent: string;
  login_status: 'success' | 'failed' | 'locked';
  failure_reason: string | null;
  full_name: string | null;
  department: string | null;
  position: string | null;
}

interface LoginStats {
  period: number;
  dailyStats: Array<{
    date: string;
    total_logins: number;
    successful_logins: number;
    failed_logins: number;
    locked_logins: number;
  }>;
  totalStats: {
    total_logins: number;
    successful_logins: number;
    failed_logins: number;
    locked_logins: number;
    unique_users: number;
  };
  recentFailures: Array<{
    username: string;
    login_time: string;
    ip_address: string;
    failure_reason: string;
  }>;
}

const LoginHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 필터 상태
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    userid: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadLoginHistory();
    loadStats();
  }, [filters]);

  const loadLoginHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
        return;
      }

    // 날짜 파라미터 처리 - startDate는 00:00:00, endDate는 23:59:59로 설정
    const queryParams = new URLSearchParams({
      page: filters.page.toString(),
      limit: filters.limit.toString(),
      ...(filters.userid && { userid: filters.userid }),
      ...(filters.status && { status: filters.status }),
      ...(filters.startDate && { startDate: `${filters.startDate}T00:00:00` }),
      ...(filters.endDate && { endDate: `${filters.endDate}T23:59:59` })
    });

      const response = await fetch(`/api/login-history?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLoginHistory(data.loginHistory);
        setPagination(data.pagination);
      } else if (response.status === 401) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '로그인 이력을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 이력 로드 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/login-history/stats?period=7', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('통계 로드 오류:', error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // 필터 변경 시 첫 페이지로
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="status-icon success" />;
      case 'failed':
        return <XCircle size={16} className="status-icon failed" />;
      case 'locked':
        return <Lock size={16} className="status-icon locked" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '성공';
      case 'failed':
        return '실패';
      case 'locked':
        return '잠김';
      default:
        return status;
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['사용자ID', '이름', '부서', '직급', '로그인 시간', 'IP 주소', '상태', '실패 사유'];
    const csvContent = [
      headers.join(','),
      ...loginHistory.map(item => [
        item.userid,
        item.full_name || '',
        item.department || '',
        item.position || '',
        formatDateTime(item.login_time),
        item.ip_address,
        getStatusText(item.login_status),
        item.failure_reason || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `login_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="로그인 이력 조회"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="login-history-container" style={{ width: '90%', margin: '0 auto' }}>
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">
              <User size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalStats.unique_users}</div>
              <div className="stat-label">고유 사용자</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalStats.successful_logins}</div>
              <div className="stat-label">성공한 로그인</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon failed">
              <XCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalStats.failed_logins}</div>
              <div className="stat-label">실패한 로그인</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon locked">
              <Lock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalStats.locked_logins}</div>
              <div className="stat-label">잠긴 로그인</div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="filters-section">
        <div className="filter-group">
          <div className="filter-item">
            <label>사용자ID</label>
            <div className="input-group">
              <Search size={16} className="input-icon" />
              <input
                type="text"
                placeholder="사용자ID 검색"
                value={filters.userid}
                onChange={(e) => handleFilterChange('userid', e.target.value)}
              />
            </div>
          </div>
          
          <div className="filter-item">
            <label htmlFor="status-filter">상태</label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              title="로그인 상태 필터"
            >
              <option value="">전체</option>
              <option value="success">성공</option>
              <option value="failed">실패</option>
              <option value="locked">잠김</option>
            </select>
          </div>

          <div className="filter-item">
            <label htmlFor="start-date-filter">시작 날짜</label>
            <div className="input-group">
              <Calendar size={16} className="input-icon" />
              <input
                id="start-date-filter"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                title="시작 날짜 선택"
              />
            </div>
          </div>

          <div className="filter-item">
            <label htmlFor="end-date-filter">종료 날짜</label>
            <div className="input-group">
              <Calendar size={16} className="input-icon" />
              <input
                id="end-date-filter"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                title="종료 날짜 선택"
              />
            </div>
          </div>
          
          <div className="filter-actions">
            <button 
              onClick={loadLoginHistory} 
              className="btn btn-secondary btn-icon"
              disabled={isLoading}
              title="새로고침"
            >
              <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
            </button>
            <button 
              onClick={exportToCSV} 
              className="btn btn-primary"
              disabled={loginHistory.length === 0}
            >
              <Download size={16} />
              내보내기
            </button>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="error-message">
          <XCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 로그인 이력 테이블 */}
      <div className="table-container">
        <table className="login-history-table">
          <thead>
            <tr>
              <th>사용자ID</th>
              <th>이름</th>
              <th>부서/직급</th>
              <th>로그인 시간</th>
              <th>IP 주소</th>
              <th>상태</th>
              <th>실패 사유</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="loading-cell">
                  <RefreshCw size={20} className="spinning" />
                  로딩 중...
                </td>
              </tr>
            ) : loginHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  로그인 이력이 없습니다.
                </td>
              </tr>
            ) : (
              loginHistory.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="user-info">
                      <User size={16} />
                      <span>{item.userid}</span>
                    </div>
                  </td>
                  <td>{item.full_name || '-'}</td>
                  <td>
                    {item.department && item.position 
                      ? `${item.department} / ${item.position}`
                      : item.department || item.position || '-'
                    }
                  </td>
                  <td>
                    <div className="datetime-info">
                      <Clock size={14} />
                      <span>{formatDateTime(item.login_time)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="ip-info">
                      <MapPin size={14} />
                      <span>{item.ip_address}</span>
                    </div>
                  </td>
                  <td>
                    <div className="status-info">
                      {getStatusIcon(item.login_status)}
                      <span>{getStatusText(item.login_status)}</span>
                    </div>
                  </td>
                  <td>{item.failure_reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            총 {pagination.total}개 항목 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
          </div>
          
          <div className="pagination">
            <button
              onClick={() => handlePageChange(1)}
              disabled={pagination.page === 1 || isLoading}
              className="pagination-btn"
              title="첫 페이지"
            >
              «
            </button>
            
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || isLoading}
              className="pagination-btn"
              title="이전 페이지"
            >
              ‹
            </button>
            
            {/* 페이지 번호 버튼들 */}
            {(() => {
              const pages = [];
              const currentPage = pagination.page;
              const totalPages = pagination.totalPages;
              const maxVisiblePages = 5;
              
              let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
              
              // 끝 페이지가 조정되면 시작 페이지도 조정
              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }
              
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    disabled={isLoading}
                    className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
                  >
                    {i}
                  </button>
                );
              }
              
              return pages;
            })()}
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || isLoading}
              className="pagination-btn"
              title="다음 페이지"
            >
              ›
            </button>
            
            <button
              onClick={() => handlePageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages || isLoading}
              className="pagination-btn"
              title="마지막 페이지"
            >
              »
            </button>
          </div>
          
          <div className="pagination-size">
            <label htmlFor="page-size">페이지당 항목:</label>
            <select
              id="page-size"
              value={filters.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setFilters(prev => ({
                  ...prev,
                  limit: newLimit,
                  page: 1
                }));
              }}
              disabled={isLoading}
              className="page-size-select"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
          </div>
        </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default LoginHistoryPage;
