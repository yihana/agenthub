import DOMPurify from 'isomorphic-dompurify';

/**
 * HTML 콘텐츠를 sanitize하여 XSS 공격을 방지합니다.
 * @param html - sanitize할 HTML 문자열
 * @param allowImages - 이미지 태그 허용 여부 (기본값: false)
 * @param allowFullHtml - 전체 HTML 구조 허용 여부 (개인정보 처리방침 등, 기본값: false)
 * @returns sanitize된 HTML 문자열
 */
export function sanitizeHtml(html: string, allowImages: boolean = false, allowFullHtml: boolean = false): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // 전체 HTML 허용 모드 (개인정보 처리방침 등)
  if (allowFullHtml) {
    const config: DOMPurify.Config = {
      ALLOWED_TAGS: [
        'html', 'head', 'body', 'meta', 'title', 'style',
        'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
        ...(allowImages ? ['img'] : [])
      ],
      ALLOWED_ATTR: [
        'charset', 'name', 'content', 'http-equiv', 'lang',
        'href', 'target', 'rel', 'style', 'class', 'id',
        'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
        'border', 'cellpadding', 'cellspacing',
        ...(allowImages ? ['src', 'alt'] : [])
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onchange', 'onsubmit'],
      USE_PROFILES: { html: true }
    };
    return DOMPurify.sanitize(html, config);
  }

  // 기본 모드 (ReactQuill 등)
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
    // 클래스명 제한
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
    // 스타일 내 위험한 속성 차단
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    // 자동으로 target="_blank"에 rel="noopener noreferrer" 추가
    ADD_ATTR: ['target'],
    // HTML 엔티티 인코딩
    USE_PROFILES: { html: true }
  };

  return DOMPurify.sanitize(html, config);
}

/**
 * 일반 텍스트 필드를 sanitize합니다 (HTML 태그 제거)
 * @param text - sanitize할 텍스트
 * @returns sanitize된 텍스트
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // HTML 태그를 모두 제거하고 텍스트만 추출
  const stripped = DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });

  // 추가로 위험한 문자들을 이스케이프
  return stripped
    .replace(/[<>]/g, '') // < > 제거
    .trim();
}

