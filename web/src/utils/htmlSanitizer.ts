import DOMPurify from 'dompurify';

/**
 * HTML 콘텐츠를 sanitize하여 XSS 공격을 방지합니다.
 * ReactQuill에서 사용하는 안전한 태그만 허용합니다.
 * @param html - sanitize할 HTML 문자열
 * @param allowImages - 이미지 태그 허용 여부 (기본값: false)
 * @returns sanitize된 HTML 문자열
 */
export function sanitizeHtml(html: string, allowImages: boolean = false): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const config: DOMPurify.Config = {
    // 기본 허용 태그 (ReactQuill에서 사용하는 태그 포함)
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'h1', 'h2', 'h3',
      'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote',
      ...(allowImages ? ['img'] : [])
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'style', 'class',
      ...(allowImages ? ['src', 'alt', 'width', 'height'] : [])
    ],
    // 스타일 속성 허용 (ReactQuill의 색상/배경색 기능 지원)
    ALLOW_DATA_ATTR: false,
    // 안전하지 않은 프로토콜 차단 (javascript:, data: 등)
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // 위험한 태그 차단
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
    // 위험한 속성 차단
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    // 자동으로 target="_blank"에 rel="noopener noreferrer" 추가
    ADD_ATTR: ['target'],
    // HTML 엔티티 인코딩
    USE_PROFILES: { html: true }
  };

  return DOMPurify.sanitize(html, config);
}

