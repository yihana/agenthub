import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import GWRequestConfirmModal from './GWRequestConfirmModal';
import GWRequestImageModal from './GWRequestImageModal';

interface ImprovementStepsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 1, title: 'G/W 개선승인 요청' },
  { id: 2, title: '승인독촉' },
  { id: 3, title: '승인결과 수신(확인)' },
  { id: 4, title: 'ESM 요청등록' },
  { id: 5, title: '담당자 개선처리' }
];

const ImprovementStepsModal: React.FC<ImprovementStepsModalProps> = ({ isOpen, onClose }) => {
  const [selectedStep, setSelectedStep] = useState<number | null>(1); // 처음에는 1단계 선택
  const [showGWConfirmModal, setShowGWConfirmModal] = useState(false);
  const [showGWImageModal, setShowGWImageModal] = useState(false);

  if (!isOpen) return null;

  const handleStepClick = (stepId: number) => {
    setSelectedStep(stepId);
    
    // G/W 개선승인 요청 클릭 시 이미지 팝업 표시
    if (stepId === 1) {
      setShowGWImageModal(true);
    } else {
      // 다른 단계는 추후 구현
      alert(`${STEPS.find(s => s.id === stepId)?.title} 기능은 준비 중입니다.`);
    }
  };

  const handleGWConfirm = () => {
    setShowGWConfirmModal(false);
    // G/W 요청 처리 로직
    alert('G/W 개선승인 요청이 전송되었습니다.');
    onClose();
  };

  const handleGWImageConfirm = () => {
    setShowGWImageModal(false);
    // G/W 요청 처리 로직
    alert('G/W 개선승인 요청이 전송되었습니다.');
    onClose();
  };

  const handleViewDocument = () => {
    setShowGWImageModal(true);
  };

  const handleEditDocument = () => {
    // 문서 수정 기능 - 추후 구현
    alert('작성내용 수정 기능은 준비 중입니다.');
  };

  return (
    <>
      <div className="improvement-steps-modal-overlay" onClick={onClose}>
        <div className="improvement-steps-modal-content" onClick={(e) => e.stopPropagation()}>
          {/* 닫기 버튼 */}
          <button className="improvement-steps-close-button" onClick={onClose} title="닫기">
            <X size={24} />
          </button>
          
          <div className="improvement-steps-container">
            {STEPS.map((step, index) => {
              const isFirstStep = step.id === 1;
              const isSelected = selectedStep === step.id;
              const isActive = isFirstStep && isSelected; // 처음에는 1단계가 활성화
              
              // 좌우 교차 배치를 위한 스타일
              const isLeft = index % 2 === 0;
              const isLast = index === STEPS.length - 1;
              
              return (
                <React.Fragment key={step.id}>
                  <div className={`improvement-step-wrapper ${isLeft ? 'step-left' : 'step-right'}`}>
                    <div
                      className={`improvement-step ${isActive ? 'active-step' : ''}`}
                      onClick={() => handleStepClick(step.id)}
                    >
                      <div className="improvement-step-number">{step.id}</div>
                      <div className="improvement-step-title">{step.title}</div>
                    </div>
                    {/* 1단계에만 말풍선 표시 */}
                    {step.id === 1 && isActive && (
                      <div className="improvement-step-tooltip">
                        <div className="tooltip-content">
                          <p className="tooltip-message">
                            사용자가 입력한 채팅 내용을 기반으로 AI가 자동으로 G/W 개선승인 요청 문서를 작성하였습니다.
                          </p>
                          <div className="tooltip-buttons">
                            <button 
                              className="tooltip-button primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDocument();
                              }}
                            >
                              작성문서 보기
                            </button>
                            <button 
                              className="tooltip-button secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditDocument();
                              }}
                            >
                              작성내용 수정
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 화살표 추가 (마지막 단계가 아닐 때만) */}
                  {!isLast && (
                    <div className={`improvement-step-arrow ${isLeft ? 'arrow-left-to-right' : 'arrow-right-to-left'}`}>
                      <ArrowRight size={32} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {showGWConfirmModal && (
        <GWRequestConfirmModal
          isOpen={showGWConfirmModal}
          onConfirm={handleGWConfirm}
          onCancel={() => setShowGWConfirmModal(false)}
        />
      )}

      {showGWImageModal && (
        <GWRequestImageModal
          isOpen={showGWImageModal}
          onClose={() => setShowGWImageModal(false)}
          onConfirm={handleGWImageConfirm}
          showConfirmButton={true}
        />
      )}
    </>
  );
};

export default ImprovementStepsModal;

