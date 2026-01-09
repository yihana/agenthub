import React, { useState } from 'react';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const AppBottom: React.FC = () => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  return (
    <>
      <div className="app-bottom">
        <div className="app-bottom-content">
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              setShowPrivacyModal(true);
            }}
            className="privacy-policy-link"
          >
            개인정보 처리방침
          </a>
        </div>
      </div>
      <PrivacyPolicyModal 
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </>
  );
};

export default AppBottom;

