import express from 'express';
import { getClientIp } from '../utils/ipUtils';
import { query, DB_TYPE } from '../db';

// IP 로그 집계를 위한 캐시 (메모리 기반)
const ipLogCache = new Map<string, { lastLog: number; count: number }>();
const LOG_INTERVAL = 5000; // 5초마다 로그 출력
const CACHE_CLEANUP_INTERVAL = 60000; // 1분마다 캐시 정리

// IP 화이트리스트 캐시
let ipWhitelistCache: string[] = [];
let ipWhitelistCacheTime: number = 0;
const IP_WHITELIST_CACHE_TTL = 60000; // 1분 캐시

// 오래된 캐시 정리 함수
function cleanupOldCache(): void {
  const now = Date.now();
  for (const [key, value] of ipLogCache.entries()) {
    if (now - value.lastLog > CACHE_CLEANUP_INTERVAL) {
      ipLogCache.delete(key);
    }
  }
}

// 주기적으로 캐시 정리 (1분마다)
setInterval(cleanupOldCache, CACHE_CLEANUP_INTERVAL);

/**
 * IP가 허용된 대역에 속하는지 확인하는 함수
 * @param clientIp 클라이언트 IP
 * @param allowedIp 허용된 IP 또는 CIDR 표기법
 * @returns 허용 여부
 */
function isIpAllowed(clientIp: string, allowedIp: string): boolean {
  // localhost 처리
  if (allowedIp === 'localhost' && (clientIp === '127.0.0.1' || clientIp === '::1')) {
    return true;
  }
  
  // 정확한 IP 매치
  if (clientIp === allowedIp) {
    return true;
  }
  
  // CIDR 표기법 처리
  if (allowedIp.includes('/')) {
    const [network, prefixLength] = allowedIp.split('/');
    const prefix = parseInt(prefixLength);
    
    // IPv4 CIDR 처리
    if (clientIp.includes('.')) {
      const clientIpNum = ipToNumber(clientIp);
      const networkNum = ipToNumber(network);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
      
      return (clientIpNum & mask) === (networkNum & mask);
    }
  }
  
  return false;
}

/**
 * IPv4 주소를 숫자로 변환
 * @param ip IPv4 주소
 * @returns 숫자로 변환된 IP
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * IP 허용 로그를 집계하여 출력하는 함수
 * @param clientIp 클라이언트 IP
 * @param path 요청 경로
 */
function logAllowedIp(clientIp: string, path: string): void {
  const now = Date.now();
  const cacheKey = clientIp;
  const cached = ipLogCache.get(cacheKey);
  
  if (!cached || (now - cached.lastLog) > LOG_INTERVAL) {
    // 첫 번째 요청이거나 로그 간격이 지났을 때
    if (cached && cached.count > 1) {
      // 이전에 집계된 요청이 있었다면 집계 로그 출력
      console.log(`✅ 접근허용 IP: ${clientIp} - ${cached.count}개 요청 처리`);
    } else {
      // 단일 요청이면 일반 로그 출력
      console.log(`✅ 접근허용 IP: ${clientIp} - ${path}`);
    }
    
    // 캐시 업데이트
    ipLogCache.set(cacheKey, { lastLog: now, count: 1 });
  } else {
    // 로그 간격 내에서 추가 요청이면 카운트만 증가
    cached.count++;
  }
}

/**
 * DB에서 IP 화이트리스트를 가져오는 함수 (캐시 사용)
 */
async function getAllowedIpsFromDb(): Promise<string[]> {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (ipWhitelistCache.length > 0 && (now - ipWhitelistCacheTime) < IP_WHITELIST_CACHE_TTL) {
    return ipWhitelistCache;
  }
  
  try {
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        'SELECT ip_address FROM ip_whitelist WHERE is_active = true ORDER BY ip_address',
        []
      );
      ipWhitelistCache = result.rows.map((row: any) => row.ip_address);
    } else {
      result = await query(
        'SELECT IP_ADDRESS FROM EAR.ip_whitelist WHERE IS_ACTIVE = true ORDER BY IP_ADDRESS',
        []
      );
      ipWhitelistCache = result.rows.map((row: any) => row.IP_ADDRESS || row.ip_address);
    }
    
    ipWhitelistCacheTime = now;
    return ipWhitelistCache;
  } catch (error) {
    console.error('IP 화이트리스트 조회 오류:', error);
    // 오류 발생 시 빈 배열 반환 (모든 IP 차단)
    return [];
  }
}

/**
 * IP 화이트리스트 캐시 무효화
 */
export function invalidateIpWhitelistCache(): void {
  ipWhitelistCache = [];
  ipWhitelistCacheTime = 0;
}

/**
 * IP 화이트리스트 미들웨어
 * 허용되지 않은 IP에서 접근할 경우 에러 페이지로 리다이렉트
 */
export async function ipWhitelistMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // 헬스체크 경로는 IP 제한 완전 우회
  if (req.path === '/health') {
    return next();
  }
  
  // OAuth 콜백 경로는 IP 제한 완전 우회 (외부 서비스에서 오는 리다이렉트)
  // XSUAA/IAS에서 오는 인증 콜백은 IP 제한을 적용하면 안 됨
  if (req.path === '/api/auth/callback') {
    return next();
  }
  
  const clientIp = getClientIp(req);
  
  // DB에서 허용된 IP 목록 가져오기
  const allowedIps = await getAllowedIpsFromDb();
  
  // 허용된 IP인지 확인
  const isAllowed = allowedIps.some(allowedIp => isIpAllowed(clientIp, allowedIp));
  
  if (!isAllowed) {
    console.log(`🚫 접근제한 IP: ${clientIp} - ${req.path}`);
    
    // API 요청인 경우 JSON 에러 응답
    if (req.path.startsWith('/api')) {
      return res.status(403).json({
        error: '접근할 수 없는 IP 대역입니다.',
        message: '허용되지 않은 IP에서의 접근입니다.',
        clientIp: clientIp
      });
    }
    
    // 웹 페이지 요청인 경우 에러 페이지 렌더링
    const errorHtml = generateErrorHtml(clientIp);
    return res.status(403).send(errorHtml);
  }
  
  // 허용된 IP는 집계 로그 사용
  logAllowedIp(clientIp, req.path);
  next();
}

/**
 * IP 화이트리스트 설정을 가져오는 함수
 */
export async function getAllowedIps(): Promise<string[]> {
  return await getAllowedIpsFromDb();
}

/**
 * IP 제한 에러 페이지 HTML 생성
 */
function generateErrorHtml(clientIp: string): string {
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>접근 제한 - IP 대역 오류</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        
        .error-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 60px 40px;
            max-width: 600px;
            width: 90%;
            text-align: center;
            animation: slideUp 0.6s ease-out;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .error-icon {
            font-size: 80px;
            color: #e74c3c;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .error-title {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        
        .error-message {
            font-size: 18px;
            color: #7f8c8d;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .ip-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
            border-left: 4px solid #e74c3c;
        }
        
        .ip-label {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .ip-address {
            font-family: 'Courier New', monospace;
            font-size: 18px;
            color: #e74c3c;
            background: white;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        
        .allowed-ips {
            margin-top: 20px;
            text-align: left;
        }
        
        .allowed-ips-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .ip-list {
            list-style: none;
            padding: 0;
        }
        
        .ip-list li {
            background: #ecf0f1;
            margin: 5px 0;
            padding: 8px 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            color: #34495e;
        }
        
        .contact-info {
            margin-top: 30px;
            padding: 20px;
            background: #e8f4fd;
            border-radius: 10px;
            border-left: 4px solid #3498db;
        }
        
        .contact-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .contact-text {
            color: #7f8c8d;
            line-height: 1.5;
        }
        
        .retry-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            transition: transform 0.2s ease;
        }
        
        .retry-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #95a5a6;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">🚫</div>
        <h1 class="error-title">접근할 수 없는 IP 대역입니다</h1>
        <p class="error-message">
            현재 사용 중인 IP 주소는 시스템 접근이 허용되지 않습니다.<br>
            관리자에게 문의하시거나 허용된 네트워크에서 접근해 주세요.
        </p>
        
        <div class="ip-info">
            <div class="ip-label">현재 접근 시도 IP:</div>
            <div class="ip-address">${clientIp}</div>
        </div>
        
        <!-- 보안상 허용된 IP 대역은 표시하지 않음 -->
        
        <div class="contact-info">
            <div class="contact-title">📞 문의사항</div>
            <div class="contact-text">
                시스템 접근이 필요한 경우 시스템 관리자에게 문의하시기 바랍니다.<br>
                허용된 네트워크 환경에서 다시 시도해 주세요.
            </div>
        </div>
        
        <button class="retry-button" onclick="window.location.reload()">
            다시 시도
        </button>
        
        <div class="footer">
            <p>© 2025 SKAX EAR System - IP Access Control</p>
        </div>
    </div>
</body>
</html>`;
}
