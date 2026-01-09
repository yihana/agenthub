import React from 'react';
import { X, FileText, Shield, Settings, AlertTriangle } from 'lucide-react';

interface FirewallTemplate {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    name: string;
    required: boolean;
    type: string;
    options?: string[];
  }>;
}

interface FirewallIntentModalProps {
  templates: FirewallTemplate[];
  onClose: () => void;
}

const FirewallIntentModal: React.FC<FirewallIntentModalProps> = ({
  templates,
  onClose
}) => {
  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'firewall-open':
        return <FileText size={20} />;
      case 'firewall-change':
        return <Settings size={20} />;
      case 'firewall-exception':
        return <Shield size={20} />;
      case 'firewall-troubleshoot':
        return <AlertTriangle size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  const handleTemplateSelect = (template: FirewallTemplate) => {
    // 실제 구현에서는 선택된 템플릿에 따라 폼을 표시하거나
    // ITSM 시스템으로 리다이렉트
    console.log('Selected template:', template);
    
    // 임시로 알림 표시
    alert(`${template.title} 템플릿이 선택되었습니다.\n\n필요한 필드:\n${template.fields.map(f => `- ${f.name}${f.required ? ' (필수)' : ''}`).join('\n')}`);
    
    onClose();
  };

  return (
    <div className="firewall-modal">
      <div className="firewall-modal-content">
        <div className="firewall-modal-header">
          <h2 className="firewall-modal-title">방화벽 ITSM 사례 선택</h2>
          <button className="close-button" onClick={onClose} title="모달 닫기">
            <X size={20} />
          </button>
        </div>

        <div className="firewall-templates">
          {templates.map((template) => (
            <div
              key={template.id}
              className="firewall-template"
              onClick={() => handleTemplateSelect(template)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#3b82f6' }}>
                  {getTemplateIcon(template.id)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="firewall-template-title">{template.title}</div>
                  <div className="firewall-template-description">{template.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          background: '#f8fafc', 
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: '#6b7280'
        }}>
          <strong>안내:</strong> 위 템플릿 중 하나를 선택하면 해당 ITSM 사례 생성 페이지로 이동합니다.
          각 템플릿에는 필요한 필수 정보가 포함되어 있습니다.
        </div>
      </div>
    </div>
  );
};

export default FirewallIntentModal;

