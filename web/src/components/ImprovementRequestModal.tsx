import React, { useState } from 'react';
import { X, CheckCircle, MessageSquare } from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

interface ImprovementRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistoryId: number;
  sessionId?: string;
  selectedText: string;
  userMessage: string;
  assistantResponse: string;
}

const ImprovementRequestModal: React.FC<ImprovementRequestModalProps> = ({
  isOpen,
  onClose,
  chatHistoryId,
  sessionId,
  selectedText,
  userMessage,
  assistantResponse
}) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const categories = [
    { value: '응답품질', label: '응답품질' },
    { value: '말도안되는 답변', label: '말도안되는 답변' },
    { value: '오류 개선', label: '오류 개선' }
  ];

  const handleSubmit = async () => {
    if (!category || !description.trim()) {
      alert('분류와 답변품질 개선요청 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      console.log('API 호출 헤더:', headers);
      
      const requestBody = {
        sessionId: sessionId || `session_${Date.now()}`,
        chatHistoryId,
        selectedText,
        category,
        description: description.trim()
      };
      console.log('API 호출 데이터:', requestBody);
      
      const response = await fetch('/api/improvement/requests', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onClose();
          setSubmitSuccess(false);
          setCategory('');
          setDescription('');
        }, 2000);
      } else {
        const error = await response.json();
        if (response.status === 401) {
          alert('인증이 필요합니다. 다시 로그인해주세요.');
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 리다이렉트
          window.location.href = '/error';
        } else {
          alert(`답변품질 개선요청 제출 중 오류가 발생했습니다: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Error submitting improvement request:', error);
      alert('답변품질 개선요청 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setCategory('');
      setDescription('');
      setSubmitSuccess(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="improvement-modal-overlay" onClick={handleClose}>
      <div className="improvement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="improvement-modal-header">
          <h2>답변품질 개선요청</h2>
          <button onClick={handleClose} className="close-button" disabled={isSubmitting} title="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="improvement-modal-content">
          {submitSuccess ? (
            <div className="success-message">
              <CheckCircle size={48} color="#10b981" />
              <h3>답변품질 개선요청이 성공적으로 제출되었습니다!</h3>
              <p>관리자가 검토 후 응답드리겠습니다.</p>
            </div>
          ) : (
            <>
              {/* 채팅 히스토리 표시 */}
              <div className="chat-history-section">
                <h3>관련 채팅 내용</h3>
                <div className="chat-history-content">
                  <div className="user-message">
                    <strong>사용자:</strong> {userMessage}
                  </div>
                  <div className="assistant-message">
                    <strong>어시스턴트:</strong> {assistantResponse}
                  </div>
                  <div className="selected-text">
                    <strong>선택된 텍스트:</strong>
                    <div className="selected-text-content">{selectedText}</div>
                  </div>
                </div>
              </div>

              {/* 개선요청 폼 */}
              <div className="improvement-form">
                <div className="form-group">
                  <label htmlFor="category">답변품질 개선요청 분류 *</label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                    disabled={isSubmitting}
                  >
                    <option value="">분류를 선택하세요</option>
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="description">답변품질 개선요청 내용 *</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="어떤 부분이 불만족스러운지, 어떻게 개선되었으면 하는지 구체적으로 설명해주세요."
                    className="form-textarea"
                    rows={6}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* 제출 버튼 */}
              <div className="modal-actions">
                <button
                  onClick={handleSubmit}
                  disabled={!category || !description.trim() || isSubmitting}
                  className="submit-button"
                >
                  {isSubmitting ? (
                    <>
                      <div className="loading-spinner" />
                      제출 중...
                    </>
                  ) : (
                    <>
                      <MessageSquare size={16} />
                      답변품질 개선요청 제출
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovementRequestModal;
