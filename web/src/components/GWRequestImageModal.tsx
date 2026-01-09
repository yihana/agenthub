import React from 'react';
import { X } from 'lucide-react';
import gwRequestImage from '../assets/gw_request.png';

interface GWRequestImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
}

const GWRequestImageModal: React.FC<GWRequestImageModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  showConfirmButton = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="gw-request-image-modal-overlay" onClick={onClose}>
      <div className="gw-request-image-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gw-request-image-modal-header">
          <button className="close-button" onClick={onClose} title="닫기">
            <X size={20} />
          </button>
        </div>
        
        <div className="gw-request-image-modal-body">
          <img 
            src={gwRequestImage} 
            alt="G/W 개선승인 요청 문서" 
            className="gw-request-image"
          />
        </div>
        
        {showConfirmButton && (
          <div className="gw-request-image-modal-footer">
            <button className="gw-request-image-cancel-button" onClick={onClose}>
              닫기
            </button>
            <button className="gw-request-image-confirm-button" onClick={handleConfirm}>
              신청하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GWRequestImageModal;

