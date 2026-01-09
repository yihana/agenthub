// API 호출을 위한 공통 헬퍼 함수들

// JWT 토큰을 가져오는 함수
export const getAuthToken = (): string | null => {
  const token = localStorage.getItem('token');
  console.log('현재 저장된 토큰:', token ? `토큰 존재 (${token.substring(0, 20)}...)` : '토큰 없음');
  return token;
};

// API 호출을 위한 기본 헤더를 생성하는 함수
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// FormData용 API 호출을 위한 헤더를 생성하는 함수 (Content-Type 제외)
export const getAuthHeadersForFormData = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// API 호출을 위한 fetch 래퍼 함수
export const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const defaultOptions: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };
  
  return fetch(url, defaultOptions);
};
