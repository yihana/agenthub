import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Database, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'error';
  chunks?: number;
}

const RAGDocumentManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [useRedis, setUseRedis] = useState(false);
  const [redisConnected, _setRedisConnected] = useState<boolean | null>(null);
  const [postgresConnected, setPostgresConnected] = useState<boolean | null>(null);
  const [dbType, setDbType] = useState<'postgres' | 'hana' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 문서 목록 로드
  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/rag/documents');
      const data = await response.json();
      
      if (data.documents) {
        const formattedDocuments: Document[] = data.documents.map((doc: any) => ({
          id: doc.id.toString(),
          name: doc.name,
          type: doc.file_type.split('/')[1]?.toUpperCase() || 'UNKNOWN',
          size: doc.file_size,
          uploadedAt: new Date(doc.created_at).toLocaleString('ko-KR'),
          status: 'completed' as const,
          chunks: doc.chunk_count
        }));
        setDocuments(formattedDocuments);
      }
    } catch (error) {
      console.error('문서 목록 로드 실패:', error);
    }
  };

  // Redis 연결 상태 확인 (일시 비활성화)
  // const checkRedisConnection = async () => {
  //   try {
  //     const response = await fetch('/api/rag/redis-status');
  //     const data = await response.json();
  //     setRedisConnected(data.connected);
  //   } catch (error) {
  //     console.error('Redis 연결 상태 확인 실패:', error);
  //     setRedisConnected(false);
  //   }
  // };

  // DB 연결 상태 확인 (Postgres/HANA 공통)
  const checkPostgresConnection = async () => {
    try {
      const response = await fetch('/api/rag/db-status');
      const data = await response.json();
      setPostgresConnected(data.connected);
      if (data && (data.dbType === 'postgres' || data.dbType === 'hana')) {
        setDbType(data.dbType);
      }
    } catch (error) {
      console.error('데이터베이스 연결 상태 확인 실패:', error);
      setPostgresConnected(false);
    }
  };

  // 컴포넌트 마운트 시 문서 목록 로드 및 연결 상태 확인
  useEffect(() => {
    loadDocuments();
    // checkRedisConnection(); // Redis 일시 비활성화
    checkPostgresConnection();
  }, []);

  // 10초마다 연결 상태 재확인
  useEffect(() => {
    const interval = setInterval(() => {
      // checkRedisConnection(); // Redis 일시 비활성화
      checkPostgresConnection();
    }, 10000); // 10초

    return () => clearInterval(interval);
  }, []);

  // 드래그 앤 드롭 이벤트 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // 파일 업로드 처리
      handleFileUpload({ target: { files } } as any);
    }
  };

  // 페이지 전체에서 드래그 앤 드롭 방지
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };

    const preventDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    // 페이지 전체에 이벤트 리스너 추가
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDrop);

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDrop);
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 저장소 선택 시 연결 상태 확인
    // Redis 일시 비활성화
    // if (useRedis && redisConnected === false) {
    //   alert('Redis 서비스가 실행되지 않았습니다. localhost:6379에서 Redis 서비스를 시작해주세요.');
    //   return;
    // }
    
    if (!useRedis && postgresConnected === false) {
      alert('데이터베이스 서비스가 실행되지 않았습니다. 연결을 확인해주세요.');
      return;
    }

    // 허용된 파일 확장자 목록
    const allowedExtensions = ['.md', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.pdf', '.xls', '.xlsx'];
    
    // 파일 확장자 검증
    const invalidFiles: File[] = [];
    for (const file of files) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        invalidFiles.push(file);
      }
    }
    
    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map(f => f.name).join(', ');
      alert(`지원하지 않는 파일 형식입니다:\n${invalidNames}\n\nMD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX 파일만 업로드 가능합니다.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'rag_document');
      formData.append('originalName', btoa(unescape(encodeURIComponent(file.name)))); // Base64로 인코딩
      // formData.append('useRedis', useRedis.toString()); // Redis 일시 비활성화
      formData.append('useRedis', 'false'); // 항상 DB 사용 (Redis 비활성화)

      // 임시 문서 객체 생성
      let fileType = 'UNKNOWN';
      if (file.type && file.type.includes('/')) {
        fileType = file.type.split('/')[1].toUpperCase();
      } else if (file.name) {
        // 파일 확장자에서 추론
        const ext = file.name.split('.').pop()?.toUpperCase();
        fileType = ext || 'UNKNOWN';
      }
      
      const tempDocument: Document = {
        id: `temp_${Date.now()}`,
        name: file.name,
        type: fileType,
        size: file.size,
        uploadedAt: new Date().toLocaleString('ko-KR'),
        status: 'processing'
      };

      setDocuments(prev => [tempDocument, ...prev]);

      try {
        // 파일 업로드 및 임베딩 처리
        console.log('업로드 시작:', file.name, file.type, file.size);
        
        const response = await fetch('/api/rag/upload', {
          method: 'POST',
          body: formData
        });

        console.log('응답 상태:', response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          console.log('업로드 성공:', data);
          // 업로드 성공 후 문서 목록 새로고침
          await loadDocuments();
          alert(`파일 "${file.name}" 업로드가 완료되었습니다.`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('업로드 실패:', response.status, errorData);
          alert(`업로드 실패: ${errorData.error || response.statusText}`);
          setDocuments(prev => prev.map(doc => 
            doc.id === tempDocument.id 
              ? { ...doc, status: 'error' }
              : doc
          ));
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert(`업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        setDocuments(prev => prev.map(doc => 
          doc.id === tempDocument.id 
            ? { ...doc, status: 'error' }
            : doc
        ));
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm('이 문서를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/rag/document/${documentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 삭제 성공 후 문서 목록 새로고침
        await loadDocuments();
      } else {
        alert('문서 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('문서 삭제 중 오류가 발생했습니다.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadDocument = async (documentId: string, documentName: string) => {
    try {
      const response = await fetch(`/api/rag/download/${documentId}`, {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = documentName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('문서 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('문서 다운로드 중 오류가 발생했습니다.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return '#f59e0b';
      case 'completed': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return '처리 중';
      case 'completed': return '완료';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  const currentDbLabel = useRedis ? 'Redis' : (dbType === 'hana' ? 'HANA' : 'PostgreSQL');

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="RAG 문서관리"
        onTitleClick={handleBack}
      />
      <main className="app-main">
        <div className="rag-document-management" style={{ width: '90%', margin: '0 auto' }}>
        {/* 저장소 선택 */}
        <div className="storage-selection">
          <h3>저장소 선택</h3>
          <div className="storage-options">
            <label className="storage-option">
              <input
                type="radio"
                name="storage"
                checked={!useRedis}
                onChange={() => setUseRedis(false)}
              />
              <div className="storage-info">
                <Database size={20} />
                <span>{dbType === 'hana' ? 'HANA' : 'PostgreSQL'}</span>
                <small>기본 저장소</small>
                {postgresConnected === true && <span className="status-connected">● 연결됨</span>}
                {postgresConnected === false && <span className="status-disconnected">● 연결 안됨</span>}
              </div>
            </label>
            <label className="storage-option">
              <input
                type="radio"
                name="storage"
                checked={useRedis}
                onChange={() => setUseRedis(true)}
              />
              <div className="storage-info">
                <Database size={20} />
                <span>Redis</span>
                <small>localhost:6379</small>
                {redisConnected === true && <span className="status-connected">● 연결됨</span>}
                {redisConnected === false && <span className="status-disconnected">● 연결 안됨</span>}
              </div>
            </label>
          </div>
        </div>

        <div 
          className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={48} />
          <h3>문서 업로드</h3>
          <p>MD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX 파일을 드래그하거나 클릭하여 업로드하세요</p>
          <div className="supported-formats">
            지원 형식: MD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt,.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          aria-label="파일 업로드"
        />
        
        {isUploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>업로드 중... {uploadProgress}%</span>
          </div>
        )}
      </div>

      <div className="documents-section">
        <h2>업로드된 문서</h2>
        <div className="documents-list">
          {documents.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <p>업로드된 문서가 없습니다</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-icon">
                  <FileText size={24} />
                </div>
                <div className="document-info">
                  <div 
                    className="document-name" 
                    style={{ 
                      cursor: 'pointer',
                      color: '#2563eb',
                      textDecoration: 'underline'
                    }}
                    onClick={() => handleDownloadDocument(doc.id, doc.name)}
                    title="클릭하여 다운로드"
                  >
                    {doc.name}
                  </div>
                  <div className="document-details">
                    <span className="document-type">{doc.type}</span>
                    <span className="document-size">{formatFileSize(doc.size)}</span>
                    <span className="document-date">{doc.uploadedAt}</span>
                    {doc.chunks && (
                      <span className="document-chunks">{doc.chunks}개 청크</span>
                    )}
                  </div>
                </div>
                <div className="document-status">
                  <div 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(doc.status) }}
                  />
                  <span className="status-text">{getStatusText(doc.status)}</span>
                </div>
                <div className="document-actions">
                  <button 
                    className="action-button view"
                    title="문서 보기"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    className="action-button delete"
                    onClick={() => handleDeleteDocument(doc.id)}
                    title="문서 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="database-info">
        <div className="info-card">
          <Database size={24} />
          <div className="info-content">
            <h3>{currentDbLabel} 임베딩 저장</h3>
            <p>업로드된 문서는 자동으로 벡터 임베딩으로 변환되어 {currentDbLabel} 데이터베이스에 저장됩니다.</p>
            <div className="info-stats">
              <div className="stat">
                <span className="stat-label">총 문서 수:</span>
                <span className="stat-value">{documents.filter(d => d.status === 'completed').length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">총 청크 수:</span>
                <span className="stat-value">
                  {documents.reduce((sum, d) => sum + (d.chunks || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .storage-selection {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .storage-selection h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #374151;
        }

        .storage-options {
          display: flex;
          gap: 1rem;
        }

        .storage-option {
          flex: 1;
          cursor: pointer;
          padding: 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          transition: all 0.2s ease;
        }

        .storage-option:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .storage-option input[type="radio"] {
          display: none;
        }

        .storage-option input[type="radio"]:checked + .storage-info {
          color: #3b82f6;
        }

        .storage-option input[type="radio"]:checked {
          border-color: #3b82f6;
          background: #f0f9ff;
        }

        .storage-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          text-align: center;
        }

        .storage-info span {
          font-weight: 600;
          font-size: 1rem;
        }

        .storage-info small {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .status-connected {
          color: #10b981;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-disconnected {
          color: #ef4444;
          font-size: 0.75rem;
          font-weight: 500;
        }
      `}</style>
      </main>
      <AppBottom />
    </div>
  );
};

export default RAGDocumentManagement;
