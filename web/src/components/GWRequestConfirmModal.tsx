import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface GWRequestConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const GWRequestConfirmModal: React.FC<GWRequestConfirmModalProps> = ({ 
  isOpen, 
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="gw-request-modal-overlay" onClick={onCancel}>
      <div className="gw-request-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gw-request-modal-header">
          <div className="gw-request-ai-indicator">
            <Sparkles size={20} />
            <span>AI가 자동으로 작성했습니다</span>
          </div>
          <button className="close-button" onClick={onCancel} title="닫기">
            <X size={20} />
          </button>
        </div>
        
        <div className="gw-request-modal-body">
          <p>G/W에 개선승인 요청을 전송하시겠습니까?</p>
        </div>
        
        <div className="gw-request-modal-footer">
          <button className="gw-request-cancel-button" onClick={onCancel}>
            취소
          </button>
          <button className="gw-request-confirm-button" onClick={onConfirm}>
            요청
          </button>
        </div>
      </div>
    </div>
  );
};

export default GWRequestConfirmModal;

