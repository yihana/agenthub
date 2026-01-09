import express from 'express';

/**
 * Cloud Foundry 환경에서 실제 클라이언트 IP 주소를 가져오는 함수
 * @param req Express Request 객체
 * @returns 클라이언트의 실제 IP 주소
 */
export function getClientIp(req: express.Request): string {
  // X-Forwarded-For 헤더 확인 (Cloud Foundry에서 가장 우선순위)
  const xForwardedFor = req.get('X-Forwarded-For');
  if (xForwardedFor) {
    // 여러 IP가 있을 경우 첫 번째 IP 사용 (실제 클라이언트 IP)
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // X-Real-IP 헤더 확인
  const xRealIp = req.get('X-Real-IP');
  if (xRealIp) {
    return xRealIp;
  }
  
  // 기존 방식들
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * 클라이언트 IP 정보를 로깅하는 함수
 * @param req Express Request 객체
 * @param context 로깅 컨텍스트 (예: '로그인 시도')
 */
export function logClientIpInfo(req: express.Request, context: string = ''): void {
  const clientIp = getClientIp(req);
  
  console.log(`[${context}] 클라이언트 IP 정보:`, {
    'X-Forwarded-For': req.get('X-Forwarded-For'),
    'X-Real-IP': req.get('X-Real-IP'),
    'req.ip': req.ip,
    'req.connection.remoteAddress': req.connection.remoteAddress,
    'req.socket.remoteAddress': req.socket.remoteAddress,
    '최종 선택된 IP': clientIp
  });
}

/**
 * Cloud Foundry 환경에서 올바른 Host 헤더를 가져오는 함수
 * Custom Domain 사용 시 X-Forwarded-Host 헤더를 우선적으로 확인
 * @param req Express Request 객체
 * @returns 호스트명 (포트 포함 가능)
 */
export function getClientHost(req: express.Request): string {
  // X-Forwarded-Host 헤더 확인 (Custom Domain 사용 시 중요)
  const xForwardedHost = req.get('X-Forwarded-Host');
  if (xForwardedHost) {
    // 여러 호스트가 있을 경우 첫 번째 호스트 사용
    const hosts = xForwardedHost.split(',').map(h => h.trim());
    return hosts[0];
  }
  
  // Host 헤더 확인
  const host = req.get('host');
  if (host) {
    return host;
  }
  
  // 폴백: 원본 Host 헤더
  return req.headers.host || 'unknown';
}

/**
 * Cloud Foundry 환경에서 올바른 프로토콜을 가져오는 함수
 * @param req Express Request 객체
 * @returns 프로토콜 ('http' 또는 'https')
 */
export function getClientProtocol(req: express.Request): string {
  // Cloud Foundry 환경에서는 항상 https 사용 (VCAP_SERVICES 존재 시)
  if (process.env.VCAP_SERVICES) {
    return 'https';
  }
  
  // X-Forwarded-Proto 헤더 확인 (프록시 뒤에서 실행될 수 있음)
  const xForwardedProto = req.get('x-forwarded-proto');
  if (xForwardedProto) {
    return xForwardedProto.split(',')[0].trim().toLowerCase();
  }
  
  // 기존 방식
  return req.protocol || 'https';
}

/**
 * Cloud Foundry 환경에서 올바른 Base URL을 생성하는 함수
 * Custom Domain과 프록시 환경을 고려
 * @param req Express Request 객체
 * @returns Base URL (예: 'https://ear-dev.sk.com')
 */
export function getBaseUrl(req: express.Request): string {
  const protocol = getClientProtocol(req);
  const host = getClientHost(req);
  const baseUrl = `${protocol}://${host}`;
  
  // 디버깅 로그 (환경 변수로 제어 가능)
  if (process.env.DEBUG_URL || process.env.NODE_ENV === 'development') {
    console.log('[Base URL 생성]', {
      'X-Forwarded-Host': req.get('X-Forwarded-Host'),
      'X-Forwarded-Proto': req.get('X-Forwarded-Proto'),
      'req.get(host)': req.get('host'),
      'req.headers.host': req.headers.host,
      'req.protocol': req.protocol,
      'VCAP_SERVICES': !!process.env.VCAP_SERVICES,
      '최종 protocol': protocol,
      '최종 host': host,
      '최종 baseUrl': baseUrl
    });
  }
  
  return baseUrl;
}