import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, X, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import { getAuthHeadersForFormData } from '../utils/api';

interface Keyword {
  id: number;
  keyword: string;
  display_name: string;
  category: string;
}

interface Template {
  id: number;
  keyword_id: number;
  template_name: string;
  template_description: string;
  required_fields: any[];
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'number' | 'select';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

const EARRequestRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Keyword[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PDF 선택 모달 관련 상태
  const [showPDFSelectionModal, setShowPDFSelectionModal] = useState(false);
  const [generatedPDF, setGeneratedPDF] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestContent, setRequestContent] = useState('');
  
  // AI 자동작성 관련 상태
  const [writingMode, setWritingMode] = useState<'ai' | 'manual' | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 키워드 자동완성 API 호출
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 템플릿이 선택된 상태에서는 팝업을 표시하지 않음
    if (selectedTemplate) {
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/ear/keywords?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      // 중복된 display_name 제거 (같은 display_name이면 첫 번째 것만 유지)
      const uniqueKeywords = data.keywords?.reduce((acc: Keyword[], current: Keyword) => {
        const existing = acc.find(item => item.display_name === current.display_name);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []) || [];
      
      setSuggestions(uniqueKeywords);
      setShowSuggestions(true);
    } catch (error) {
      console.error('키워드 검색 오류:', error);
    }
  };

  // 입력값 변경 시 키워드 검색
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchSuggestions(inputValue);
      
      // 입력값이 변경되면 기존 선택된 템플릿 초기화
      if (selectedTemplate && inputValue !== selectedTemplate.template_name) {
        setSelectedTemplate(null);
        setFormData({});
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  // 폼 데이터 변경 시 요청 내용 실시간 업데이트
  useEffect(() => {
    if (selectedTemplate && Object.keys(formData).length > 0) {
      const keyword = suggestions.find(s => s.display_name === selectedTemplate.template_name) || 
                     { id: 0, keyword: '', display_name: selectedTemplate.template_name, category: '기타' };
      const updatedContent = generateRequestContent(selectedTemplate, keyword, formData);
      setRequestContent(updatedContent);
    }
  }, [formData, selectedTemplate]);

  // AI 자동작성 함수
  const generateAIFormData = async (template: Template, keyword: Keyword) => {
    setIsAIGenerating(true);
    try {
      const response = await fetch('/api/ear/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_name: template.template_name,
          template_description: template.template_description,
          required_fields: template.required_fields,
          keyword: keyword.keyword,
          category: keyword.category
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.generated_data || {};
      } else {
        console.error('AI 생성 실패');
        return {};
      }
    } catch (error) {
      console.error('AI 자동작성 오류:', error);
      return {};
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 템플릿 선택 시 폼 필드 초기화
  const handleTemplateSelect = async (keyword: Keyword) => {
    try {
      const response = await fetch(`/api/ear/templates?keyword_id=${keyword.id}`);
      const data = await response.json();
      
      if (data.templates && data.templates.length > 0) {
        const template = data.templates[0];
        setSelectedTemplate(template);
        setInputValue(template.template_name);
        setShowSuggestions(false); // 템플릿 선택 시 팝업 리스트 숨김
        
        // 요청 제목과 내용 자동 작성
        setRequestTitle(template.template_name);
        setRequestContent(generateRequestContent(template, keyword, {}));
        
        // 폼 데이터 초기화
        const initialFormData: Record<string, string> = {};
        template.required_fields.forEach((field: FormField) => {
          initialFormData[field.name] = '';
        });
        setFormData(initialFormData);
        
        // 작성 모드 초기화
        setWritingMode(null);
      } else {
        // 템플릿이 없으면 초기 데이터 시드 후 재시도
        try {
          const seedRes = await fetch('/api/ear/init-data', { method: 'POST' });
          if (seedRes.ok) {
            const retry = await fetch(`/api/ear/templates?keyword_id=${keyword.id}`);
            const retryData = await retry.json();
            if (retryData.templates && retryData.templates.length > 0) {
              const template = retryData.templates[0];
              setSelectedTemplate(template);
              setInputValue(template.template_name);
              setShowSuggestions(false);
              setRequestTitle(template.template_name);
              setRequestContent(generateRequestContent(template, keyword, {}));
              const initialFormData: Record<string, string> = {};
              template.required_fields.forEach((field: FormField) => {
                initialFormData[field.name] = '';
              });
              setFormData(initialFormData);
              setWritingMode(null);
            } else {
              alert('선택한 키워드에 대한 템플릿이 없습니다. 관리자가 템플릿을 등록해야 합니다.');
            }
          } else {
            alert('초기 데이터를 생성할 수 없습니다. 관리자에게 문의하세요.');
          }
        } catch (e) {
          console.error('초기 데이터 생성 오류:', e);
          alert('초기 데이터 생성 중 오류가 발생했습니다.');
        }
      }
    } catch (error) {
      console.error('템플릿 조회 오류:', error);
    }
  };

  // 요청 내용 자동 생성 함수 (실시간 업데이트)
  const generateRequestContent = (template: Template, keyword: Keyword, formData: Record<string, string>) => {
    let content = `요청 유형: ${template.template_name}\n`;
    content += `카테고리: ${keyword.category}\n`;
    content += `설명: ${template.template_description}\n\n`;
    
    if (template.required_fields && template.required_fields.length > 0) {
      content += `입력된 정보:\n`;
      template.required_fields.forEach((field: FormField) => {
        const value = formData[field.name];
        if (value && value.trim()) {
          content += `- ${field.label}: ${value}\n`;
        } else {
          content += `- ${field.label}: [미입력]${field.required ? ' (필수)' : ''}\n`;
        }
      });
    }
    
    return content;
  };

  // PDF 생성 함수 (HTML을 PDF로 변환하여 한글 지원)
  const generatePDF = async () => {
    console.log('generatePDF 함수 시작');
    try {
      // HTML 요소 생성
      const htmlContent = `
        <div style="font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; padding: 20px; max-width: 800px;">
          <h1 style="text-align: center; color: #333; margin-bottom: 30px;">EAR Request Document</h1>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">요청 제목</h2>
            <p style="font-size: 14px; margin: 10px 0;">${requestTitle}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">요청 내용</h2>
            <div style="font-size: 12px; margin: 10px 0; white-space: pre-line; line-height: 1.6;">${requestContent}</div>
          </div>
          
          ${selectedTemplate ? `
            <div style="margin-bottom: 20px;">
              <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">템플릿 정보</h2>
              <p style="font-size: 12px; margin: 5px 0;"><strong>템플릿명:</strong> ${selectedTemplate.template_name}</p>
              <p style="font-size: 12px; margin: 5px 0;"><strong>설명:</strong> ${selectedTemplate.template_description || ''}</p>
            </div>
            
            ${Object.keys(formData).length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">추가 입력 정보</h2>
                ${Object.entries(formData).map(([key, value]) => {
                  if (value) {
                    const field = selectedTemplate.required_fields.find(f => f.name === key);
                    const label = field ? field.label : key;
                    return `<p style="font-size: 12px; margin: 5px 0;"><strong>${label}:</strong> ${value}</p>`;
                  }
                  return '';
                }).join('')}
              </div>
            ` : ''}
          ` : ''}
          
          <div style="margin-top: 30px; text-align: right; font-size: 10px; color: #666;">
            생성 시간: ${new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      `;

      // 임시 div 요소 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      document.body.appendChild(tempDiv);

      // html2canvas와 jsPDF를 동적으로 import
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      // HTML을 캔버스로 변환
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // 캔버스를 PDF로 변환
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 너비
      const pageHeight = 295; // A4 높이
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 임시 요소 제거
      document.body.removeChild(tempDiv);

      console.log('PDF 문서 생성 완료');
      return pdf;
    } catch (error) {
      console.error('PDF 생성 중 오류:', error);
      throw error;
    }
  };


  // 채팅창 클릭 시 팝업 리스트 표시
  const handleInputClick = () => {
    if (inputValue.length >= 2 && !selectedTemplate) {
      setShowSuggestions(true);
    }
  };

  // 채팅창 포커스 시 팝업 리스트 표시
  const handleInputFocus = () => {
    if (inputValue.length >= 2 && !selectedTemplate) {
      setShowSuggestions(true);
    }
  };

  // AI 자동작성 선택 핸들러
  const handleAIModeSelect = async () => {
    if (!selectedTemplate) return;
    
    setWritingMode('ai');
    
    // 현재 선택된 키워드 찾기
    const keyword = suggestions.find(s => s.display_name === selectedTemplate.template_name) || 
                   { id: 0, keyword: '', display_name: selectedTemplate.template_name, category: '기타' };
    
    // AI로 폼 데이터 자동 생성
    const aiGeneratedData = await generateAIFormData(selectedTemplate, keyword);
    
    if (Object.keys(aiGeneratedData).length > 0) {
      setFormData(aiGeneratedData);
      
      // 요청 내용도 업데이트
      const updatedContent = generateRequestContent(selectedTemplate, keyword, aiGeneratedData);
      setRequestContent(updatedContent);
    }
  };

  // 수동작성 선택 핸들러
  const handleManualModeSelect = () => {
    setWritingMode('manual');
  };

  // 폼 필드 변경
  const handleFormFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // 파일 첨부
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // 허용된 파일 확장자 목록
    const allowedExtensions = ['.md', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.pdf', '.xls', '.xlsx'];
    
    // 파일 확장자 검증
    const validFiles: File[] = [];
    const invalidFiles: File[] = [];
    
    for (const file of files) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
    }
    
    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map(f => f.name).join(', ');
      alert(`지원하지 않는 파일 형식입니다:\n${invalidNames}\n\nMD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX 파일만 업로드 가능합니다.`);
    }
    
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
    
    // 파일 입력 초기화
    if (event.target) {
      event.target.value = '';
    }
  };

  // 파일 삭제
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // PDF 선택 모달 닫기
  const closePDFSelectionModal = () => {
    setShowPDFSelectionModal(false);
    setGeneratedPDF(null);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  // PDF 첨부하여 등록
  const handleSubmitWithPDF = async () => {
    if (generatedPDF) {
      const finalAttachments = [...attachments, generatedPDF];
      console.log('PDF 첨부하여 등록:', { pdfFile: generatedPDF.name, finalAttachmentsCount: finalAttachments.length });
      closePDFSelectionModal();
      await submitRequest(finalAttachments, true);
    }
  };

  // PDF 없이 등록
  const handleSubmitWithoutPDF = async () => {
    console.log('PDF 없이 등록');
    closePDFSelectionModal();
    await submitRequest(attachments, false);
  };

  // 요청 제출
  const handleSubmit = async () => {
    console.log('요청 제출 시작:', { requestTitle, requestContent, selectedTemplate, attachments });
    
    // 기본 요청 정보만 있어도 등록 가능
    if (!requestTitle.trim() || !requestContent.trim()) {
      alert('요청 제목과 요청 내용을 입력해주세요.');
      return;
    }

    // 템플릿이 선택된 경우에만 필수 필드 검증
    if (selectedTemplate) {
      const missingFields = selectedTemplate.required_fields.filter((field: FormField) => 
        field.required && !formData[field.name]?.trim()
      );

      if (missingFields.length > 0) {
        alert(`다음 필드를 입력해주세요: ${missingFields.map((f: FormField) => f.label).join(', ')}`);
        return;
      }
    }

    // 템플릿이 선택된 경우에만 PDF 생성 및 선택 모달 표시
    if (selectedTemplate) {
      console.log('템플릿 선택됨, PDF 생성 시작');
      try {
        // PDF 생성 완료까지 대기
        const pdf = await generatePDF();
        console.log('PDF 생성 완료');
        
        // PDF를 Blob으로 변환
        const pdfBlob = pdf.output('blob');
        console.log('PDF Blob 생성 완료:', pdfBlob.size, 'bytes');
        
        // PDF 파일 객체 생성
        const pdfFile = new File([pdfBlob], `EAR_Request_${Date.now()}.pdf`, { type: 'application/pdf' });
        console.log('PDF File 객체 생성 완료:', pdfFile.name, pdfFile.size, 'bytes');
        
        // PDF 미리보기 URL 생성
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // 상태 설정 및 모달 표시
        setGeneratedPDF(pdfFile);
        setPdfPreviewUrl(pdfUrl);
        setShowPDFSelectionModal(true);
        
      } catch (error) {
        console.error('PDF 생성 오류:', error);
        const attachPDF = confirm('PDF 생성 중 오류가 발생했습니다.\n\nPDF 없이 요청을 등록하시겠습니까?');
        if (attachPDF) {
          await submitRequest(attachments, false);
        }
      }
    } else {
      console.log('템플릿 선택되지 않음, PDF 없이 등록');
      // 템플릿이 선택되지 않은 경우 PDF 없이 바로 등록
      await submitRequest(attachments, false);
    }
  };

  // 실제 요청 등록 함수
  const submitRequest = async (finalAttachments: File[], pdfAttached: boolean = false) => {
    console.log('submitRequest 시작:', { finalAttachments, pdfAttached });
    setIsSubmitting(true);

    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('title', requestTitle);
      formDataToSubmit.append('content', requestContent);
      
      // 템플릿이 선택된 경우에만 템플릿 정보 추가
      if (selectedTemplate) {
        formDataToSubmit.append('template_id', selectedTemplate.id.toString());
        formDataToSubmit.append('form_data', JSON.stringify(formData));
        console.log('템플릿 정보 추가:', { template_id: selectedTemplate.id, form_data: formData });
      }
      
      // 첨부파일 추가 (백엔드에서 upload.array('attachments')로 설정되어 있음)
      console.log('첨부파일 추가 시작:', finalAttachments);
      finalAttachments.forEach((file, index) => {
        console.log(`첨부파일 ${index} 추가:`, { name: file.name, size: file.size, type: file.type });
        formDataToSubmit.append('attachments', file);
      });

      console.log('FormData 내용 확인:');
      for (let [key, value] of formDataToSubmit.entries()) {
        console.log(`${key}:`, value);
      }

      const response = await fetch('/api/ear/requests', {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formDataToSubmit
      });

      if (response.ok) {
        const successMessage = pdfAttached 
          ? 'EAR 요청이 성공적으로 등록되었습니다. (PDF 첨부됨)'
          : 'EAR 요청이 성공적으로 등록되었습니다.';
        alert(successMessage);
        
        // 폼 초기화
        setInputValue('');
        setSelectedTemplate(null);
        setFormData({});
        setAttachments([]);
        setRequestTitle('');
        setRequestContent('');
      } else {
        const error = await response.json();
        console.error('요청 등록 실패:', error);
        alert(`요청 등록 실패: ${error.error}`);
      }
    } catch (error) {
      console.error('요청 제출 오류:', error);
      alert('요청 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 뒤로가기
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
        pageTitle="EAR 요청등록"
        onTitleClick={handleBack}
      />
      <main className="app-main">
        <div className="ear-request-content" style={{ width: '90%', margin: '0 auto' }}>
        {/* 1. 채팅 입력창 */}
        <div className="chat-input-section" style={{ width: '100%' }}>
          <div className="chat-input-container" style={{ width: '100%' }}>
            <MessageCircle size={20} className="chat-icon" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onClick={handleInputClick}
              onFocus={handleInputFocus}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  fetchSuggestions(inputValue);
                }
              }}
              placeholder="요청 유형을 입력하세요 (예: 방화벽 오픈 신청)"
              className="chat-input"
            />
            <button
              onClick={() => {
                if (inputValue.trim()) {
                  fetchSuggestions(inputValue);
                }
              }}
              className="send-button"
              disabled={!inputValue.trim()}
              title="검색"
            >
              <Send size={16} />
            </button>
          </div>
          
          {/* 2. 자동완성 제안 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {suggestions.map((keyword) => (
                <div
                  key={keyword.id}
                  className="suggestion-item"
                  onClick={() => handleTemplateSelect(keyword)}
                >
                  <div className="suggestion-name">{keyword.display_name}</div>
                  <div className="suggestion-category">{keyword.category}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. 선택된 템플릿이 있을 때 추가 폼 표시 */}
        {selectedTemplate && (
          <div className="template-form-container" style={{ width: '100%' }}>
            <div className="template-form" style={{ width: '100%' }}>
              <div className="form-section">
                <h3>{selectedTemplate.template_name}</h3>
                <p className="template-description">{selectedTemplate.template_description}</p>
                
                {/* AI 자동작성 vs 수동작성 선택 UI */}
                {writingMode === null && (
                  <div className="writing-mode-selection">
                    <h4>작성 방식 선택</h4>
                    <div className="mode-selection-buttons">
                      <button
                        onClick={handleAIModeSelect}
                        className="mode-button ai-mode"
                        disabled={isAIGenerating}
                        title="AI로 자동작성"
                      >
                        <div className="mode-icon ai-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12l2 2 4-4"/>
                            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                            <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
                            <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
                          </svg>
                        </div>
                        <div className="mode-content">
                          <div className="mode-title">AI로 자동작성</div>
                          <div className="mode-description">AI가 템플릿에 맞게 자동으로 내용을 생성합니다</div>
                        </div>
                        {isAIGenerating && <div className="loading-spinner"></div>}
                      </button>
                      
                      <button
                        onClick={handleManualModeSelect}
                        className="mode-button manual-mode"
                        title="수동 작성"
                      >
                        <div className="mode-icon manual-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </div>
                        <div className="mode-content">
                          <div className="mode-title">수동 작성</div>
                          <div className="mode-description">직접 입력하여 내용을 작성합니다</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* 작성 모드가 선택된 후 폼 필드 표시 */}
                {writingMode && (
                  <>
                    <div className="writing-mode-indicator">
                      <span className={`mode-badge ${writingMode}`}>
                        {writingMode === 'ai' ? '🤖 AI 자동작성' : '✏️ 수동 작성'}
                      </span>
                      <button
                        onClick={() => setWritingMode(null)}
                        className="change-mode-button"
                        title="작성 방식 변경"
                      >
                        변경
                      </button>
                    </div>
                    
                    {selectedTemplate.required_fields.map((field: FormField) => (
                      <div key={field.name} className="form-group">
                        <label>
                          {field.label} {field.required && <span className="required">*</span>}
                        </label>
                        
                        {field.type === 'select' ? (
                          <select
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                            className="form-select"
                            disabled={writingMode === 'ai' && isAIGenerating}
                            title={`${field.label} 선택`}
                          >
                            <option value="">선택하세요</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFormFieldChange(field.name, e.target.value)}
                            placeholder={field.placeholder || `${field.label}을(를) 입력하세요`}
                            className="form-input"
                            disabled={writingMode === 'ai' && isAIGenerating}
                          />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. 기본 요청 정보 (항상 표시) */}
        <div className="request-form">
          <div className="form-section">
            <h3>요청 정보</h3>
            
            <div className="form-group">
              <label>요청 제목 *</label>
              <input
                type="text"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="요청 제목을 입력하세요"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>요청 내용 *</label>
              <textarea
                value={requestContent}
                onChange={(e) => setRequestContent(e.target.value)}
                placeholder="요청 내용을 상세히 입력하세요"
                className="form-textarea"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>첨부파일</label>
              
              <div className="file-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".md,.txt,.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  title="파일 첨부"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-button"
                  title="파일 첨부"
                >
                  <Upload size={16} />
                  파일 첨부
                </button>
              </div>

              {attachments.length > 0 && (
                <div className="attachments-list">
                  {attachments.map((file, index) => (
                    <div key={index} className="attachment-item">
                      <span>{file.name}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="remove-attachment"
                        title="첨부파일 삭제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="form-actions">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="submit-button"
              >
                {isSubmitting ? '등록 중...' : '요청 등록'}
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* PDF 선택 모달 */}
      {showPDFSelectionModal && (
        <div className="modal-overlay" onClick={closePDFSelectionModal}>
          <div className="modal-content pdf-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>PDF 첨부파일 선택</h2>
              <button onClick={closePDFSelectionModal} className="close-button" title="모달 닫기">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="pdf-preview-section">
                <h3>생성된 PDF 미리보기</h3>
                {pdfPreviewUrl && (
                  <div className="pdf-preview-container">
                    <iframe
                      src={pdfPreviewUrl}
                      width="100%"
                      height="400"
                      style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      title="PDF 미리보기"
                    />
                  </div>
                )}
              </div>

              <div className="pdf-selection-message">
                <p>요청서 PDF가 생성되었습니다. 첨부파일로 포함하여 등록하시겠습니까?</p>
              </div>
            </div>

            <div className="modal-footer pdf-selection-footer">
              <button 
                onClick={handleSubmitWithoutPDF} 
                className="btn-secondary"
                disabled={isSubmitting}
              >
                첨부파일 제외하여 요청 등록
              </button>
              <button 
                onClick={handleSubmitWithPDF} 
                className="btn-primary"
                disabled={isSubmitting}
              >
                첨부파일 추가하여 요청 등록
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default EARRequestRegistration;
