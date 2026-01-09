import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, HardDrive, Hash } from 'lucide-react';

interface Document {
  id: number;
  name: string;
  file_type: string;
  file_size: number;
  text_content: string;
  created_at: string;
  chunks: Array<{
    id: number;
    chunk_index: number;
    content: string;
    created_at: string;
  }>;
}

interface DocumentViewerProps {
  documentId: number;
  onClose: () => void;
  initialPage?: number; // 초기 페이지 번호
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose, initialPage }) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'full' | 'chunks' | 'original'>('original');

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/rag/document/${documentId}`);
        const data = await response.json();
        
        if (response.ok) {
          setDocument(data.document);
        } else {
          setError(data.error || '문서를 불러올 수 없습니다.');
        }
      } catch (err) {
        setError('문서를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="document-viewer-overlay">
        <div className="document-viewer">
          <div className="document-viewer-loading">
            <div className="loading-spinner"></div>
            <p>문서를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="document-viewer-overlay">
        <div className="document-viewer">
          <div className="document-viewer-error">
            <p>{error || '문서를 찾을 수 없습니다.'}</p>
            <button onClick={onClose} className="close-button">
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div className="document-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="document-viewer-header">
          <div className="document-viewer-title">
            <FileText size={20} />
            <span>{document.name}</span>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="document-viewer-meta">
          <div className="meta-item">
            <Calendar size={16} />
            <span>업로드: {formatDate(document.created_at)}</span>
          </div>
          <div className="meta-item">
            <HardDrive size={16} />
            <span>크기: {formatFileSize(document.file_size)}</span>
          </div>
          <div className="meta-item">
            <Hash size={16} />
            <span>청크: {document.chunks.length}개</span>
          </div>
        </div>

        <div className="document-viewer-tabs">
          <button 
            className={`tab-button ${activeTab === 'original' ? 'active' : ''}`}
            onClick={() => setActiveTab('original')}
          >
            원본문서보기
          </button>
          <button 
            className={`tab-button ${activeTab === 'full' ? 'active' : ''}`}
            onClick={() => setActiveTab('full')}
          >
            전체 데이터
          </button>
          <button 
            className={`tab-button ${activeTab === 'chunks' ? 'active' : ''}`}
            onClick={() => setActiveTab('chunks')}
          >
            청크별 데이터
          </button>
        </div>

        <div className="document-viewer-content">
          {activeTab === 'full' ? (
            <div className="full-content">
              <pre className="document-text">{document.text_content}</pre>
            </div>
          ) : activeTab === 'chunks' ? (
            <div className="chunks-content">
              {document.chunks.map((chunk) => (
                <div key={chunk.id} className="chunk-item">
                  <div className="chunk-header">
                    <span className="chunk-index">청크 {chunk.chunk_index}</span>
                    <span className="chunk-date">{formatDate(chunk.created_at)}</span>
                  </div>
                  <div className="chunk-content">
                    <pre>{chunk.content}</pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="original-content">
              {document.file_type === 'application/pdf' ? (
                <div className="pdf-viewer">
                  <div className="pdf-viewer-header">
                    <span>PDF 문서 뷰어</span>
                    <a 
                      href={`/api/rag/download/${document.id}`}
                      download={document.name}
                      className="download-button"
                    >
                      다운로드
                    </a>
                  </div>
                  <iframe
                    src={`/api/rag/download/${document.id}${initialPage ? `#page=${initialPage}` : ''}`}
                    className="pdf-iframe"
                    title={`PDF: ${document.name}`}
                  />
                </div>
              ) : (
                <div className="original-text-content">
                  <div className="original-header">
                    <span>원본 텍스트</span>
                    <a 
                      href={`/api/rag/download/${document.id}`}
                      download={document.name}
                      className="download-button"
                    >
                      다운로드
                    </a>
                  </div>
                  <pre className="original-text">{document.text_content}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
