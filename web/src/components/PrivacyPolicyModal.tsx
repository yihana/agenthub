import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyId?: number; // 특정 버전을 표시할 때 사용
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose, policyId }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadPrivacyPolicy();
    } else {
      setHtmlContent('');
      setError('');
    }
  }, [isOpen, policyId]);

  // postMessage를 통한 이전 버전 열기 처리
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'openPrivacyPolicy' && event.data.id) {
        loadPrivacyPolicy(event.data.id);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPrivacyPolicy = async (id?: number) => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const url = id 
        ? `/api/privacy-policy/${id}`
        : `/api/privacy-policy/current`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHtmlContent(data.data?.html_content || '');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '개인정보 처리방침을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('개인정보 처리방침 로드 오류:', err);
      setError('개인정보 처리방침을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="privacy-policy-modal-overlay" onClick={onClose}>
      <div className="privacy-policy-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-policy-modal-header">
          <h2>개인정보 처리방침</h2>
          <button className="close-button" onClick={onClose} title="닫기">
            <X size={20} />
          </button>
        </div>
        
        <div className="privacy-policy-modal-body">
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>로딩 중...</p>
            </div>
          )}
          
          {error && (
            <div className="error-container">
              <p>{error}</p>
            </div>
          )}
          
          {!loading && !error && htmlContent && (
            <iframe
              srcDoc={htmlContent}
              className="privacy-policy-iframe"
              title="개인정보 처리방침"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyModal;

