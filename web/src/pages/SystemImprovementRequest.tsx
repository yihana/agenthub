import React, { useState, useRef } from 'react';
import { CheckCircle, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { getAuthHeadersForFormData } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';

const SystemImprovementRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<ReactQuill>(null);

  // Quill 에디터 모듈 설정 (이미지 붙여넣기 지원)
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ color: [] }, { background: [] }],
      ['link', 'image'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    }
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link', 'image'
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      
      // 최대 5개 파일 제한
      if (files.length + newFiles.length > 5) {
        alert('최대 5개의 파일만 업로드할 수 있습니다.');
        return;
      }
      
      // 허용된 파일 확장자 목록
      const allowedExtensions = ['.md', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.pdf', '.xls', '.xlsx'];
      
      // 파일 확장자 검증
      const validFiles: File[] = [];
      const invalidFiles: File[] = [];
      
      for (const file of newFiles) {
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
        setFiles([...files, ...validFiles]);
      }
      
      // 파일 입력 초기화
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('요청 제목을 입력해주세요.');
      return;
    }

    if (!formData.content.trim() || formData.content === '<p><br></p>') {
      alert('요청 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);

      // 첨부파일 추가
      files.forEach((file) => {
        formDataToSend.append('attachments', file);
      });

      const response = await fetch('/api/improvement/system-requests', {
        method: 'POST',
        headers: getAuthHeadersForFormData(),
        body: formDataToSend,
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        const error = await response.json();
        alert(`시스템 개선요청 제출 중 오류가 발생했습니다: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting system improvement request:', error);
      alert('시스템 개선요청 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (submitSuccess) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="시스템 개선요청"
          onTitleClick={handleBack}
        />
        <main className="app-main">
          <div className="success-container" style={{ width: '90%', margin: '0 auto' }}>
            <CheckCircle size={64} color="#10b981" />
            <h2>시스템 개선요청이 성공적으로 제출되었습니다!</h2>
            <p>관리자가 검토 후 응답드리겠습니다.</p>
            <p>잠시 후 메인 페이지로 이동합니다...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="시스템 개선요청"
        onTitleClick={handleBack}
      />
      <main className="app-main">
        <div className="system-improvement-form" style={{ width: '90%', margin: '0 auto' }}>
        {/* 요청 제목 */}
        <div className="form-group">
          <label htmlFor="title">요청 제목 *</label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="개선요청 제목을 입력하세요"
            className="form-input"
            maxLength={500}
          />
          <span className="char-count">{formData.title.length} / 500</span>
        </div>

        {/* 요청 내용 (리치 에디터) */}
        <div className="form-group">
          <label htmlFor="content">요청 내용 *</label>
          <div className="rich-editor-container">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              modules={modules}
              formats={formats}
              placeholder="개선이 필요한 내용을 상세히 작성해주세요. 클립보드의 이미지를 Ctrl+V로 붙여넣을 수 있습니다."
            />
          </div>
          <p className="help-text">
            💡 팁: 스크린샷을 클립보드에 복사한 후 에디터에서 <kbd>Ctrl+V</kbd>로 붙여넣을 수 있습니다.
          </p>
        </div>

        {/* 첨부파일 */}
        <div className="form-group">
          <label htmlFor="attachments">첨부파일 (선택사항)</label>
          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              id="attachments"
              multiple
              accept=".md,.txt,.doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="file-upload-button"
              disabled={files.length >= 5}
            >
              <Upload size={20} />
              파일 선택 (최대 5개)
            </button>
            <span className="file-upload-hint">
              지원 형식: MD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX (각 파일 최대 100MB)
            </span>
          </div>

          {/* 선택된 파일 목록 */}
          {files.length > 0 && (
            <div className="selected-files">
              <h4>선택된 파일 ({files.length}/5)</h4>
              <div className="file-list">
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <div className="file-info">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon size={16} className="file-icon" />
                      ) : (
                        <FileText size={16} className="file-icon" />
                      )}
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="remove-file-button"
                      title="파일 제거"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 제출 버튼 */}
        <div className="form-actions">
          <button
            onClick={handleSubmit}
            disabled={!formData.title.trim() || !formData.content.trim() || isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner" />
                제출 중...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                개선요청 제출
              </>
            )}
          </button>
        </div>
        </div>
      </main>
      <AppBottom />
    </div>
  );
};

export default SystemImprovementRequest;

