import express from 'express';
import { getAllowedIps, invalidateIpWhitelistCache } from '../middleware/ipWhitelist';
import { requireAdmin } from '../middleware/auth';
import { query, DB_TYPE } from '../db';

const router = express.Router();

// 허용된 IP 목록 조회 (관리자만)
router.get('/', requireAdmin, async (req, res) => {
  try {
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        'SELECT id, ip_address, description, is_active, created_by, created_at, updated_at FROM ip_whitelist ORDER BY created_at DESC',
        []
      );
    } else {
      result = await query(
        'SELECT ID as id, IP_ADDRESS as ip_address, DESCRIPTION as description, IS_ACTIVE as is_active, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.ip_whitelist ORDER BY CREATED_AT DESC',
        []
      );
    }
    
    const allowedIps = result.rows || [];
    
    res.json({
      success: true,
      allowedIps: allowedIps,
      count: allowedIps.length
    });
  } catch (error) {
    console.error('IP 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// IP 추가 (관리자만)
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { ip, description } = req.body;
    const createdBy = (req as any).user?.userid || 'admin';
    
    if (!ip) {
      return res.status(400).json({ error: 'IP 주소를 입력해주세요.' });
    }
    
    // IP 형식 검증 (간단한 검증)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
    const localhostRegex = /^(localhost|127\.0\.0\.1|::1)$/;
    
    if (!ipRegex.test(ip) && !localhostRegex.test(ip)) {
      return res.status(400).json({ error: '올바른 IP 주소 형식이 아닙니다.' });
    }
    
    // DB에 IP 추가
    if (DB_TYPE === 'postgres') {
      await query(
        'INSERT INTO ip_whitelist (ip_address, description, is_active, created_by) VALUES ($1, $2, true, $3) ON CONFLICT (ip_address) DO UPDATE SET description = $2, is_active = true, updated_at = CURRENT_TIMESTAMP',
        [ip, description || null, createdBy]
      );
    } else {
      // HANA는 ON CONFLICT 지원 안함, 먼저 확인 후 INSERT/UPDATE
      const checkResult = await query(
        'SELECT ID FROM EAR.ip_whitelist WHERE IP_ADDRESS = ?',
        [ip]
      );
      
      if (checkResult.rows && checkResult.rows.length > 0) {
        await query(
          'UPDATE EAR.ip_whitelist SET DESCRIPTION = ?, IS_ACTIVE = true, UPDATED_AT = CURRENT_TIMESTAMP WHERE IP_ADDRESS = ?',
          [description || null, ip]
        );
      } else {
        await query(
          'INSERT INTO EAR.ip_whitelist (IP_ADDRESS, DESCRIPTION, IS_ACTIVE, CREATED_BY) VALUES (?, ?, ?, ?)',
          [ip, description || null, true, createdBy]
        );
      }
    }
    
    // 캐시 무효화
    invalidateIpWhitelistCache();
    
    res.json({
      success: true,
      message: `IP ${ip}가 허용 목록에 추가되었습니다.`,
      addedIp: ip
    });
  } catch (error: any) {
    console.error('IP 추가 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// IP 제거 (관리자만)
router.delete('/remove', requireAdmin, async (req, res) => {
  try {
    const { ip, id } = req.body;
    
    if (!ip && !id) {
      return res.status(400).json({ error: 'IP 주소 또는 ID를 입력해주세요.' });
    }
    
    // DB에서 IP 제거 (is_active를 false로 변경하거나 삭제)
    if (DB_TYPE === 'postgres') {
      if (id) {
        await query('DELETE FROM ip_whitelist WHERE id = $1', [id]);
      } else {
        await query('DELETE FROM ip_whitelist WHERE ip_address = $1', [ip]);
      }
    } else {
      if (id) {
        await query('DELETE FROM EAR.ip_whitelist WHERE ID = ?', [id]);
      } else {
        await query('DELETE FROM EAR.ip_whitelist WHERE IP_ADDRESS = ?', [ip]);
      }
    }
    
    // 캐시 무효화
    invalidateIpWhitelistCache();
    
    res.json({
      success: true,
      message: `IP ${ip || id}가 허용 목록에서 제거되었습니다.`,
      removedIp: ip || id
    });
  } catch (error: any) {
    console.error('IP 제거 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// IP 테스트 (관리자만)
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: '테스트할 IP 주소를 입력해주세요.' });
    }
    
    const allowedIps = await getAllowedIps();
    const isAllowed = allowedIps.some(allowedIp => {
      // localhost 처리
      if (allowedIp === 'localhost' && (ip === '127.0.0.1' || ip === '::1')) {
        return true;
      }
      
      // 정확한 IP 매치
      if (ip === allowedIp) {
        return true;
      }
      
      // CIDR 표기법 처리
      if (allowedIp.includes('/')) {
        const [network, prefixLength] = allowedIp.split('/');
        const prefix = parseInt(prefixLength);
        
        // IPv4 CIDR 처리
        if (ip.includes('.')) {
          const clientIpNum = ipToNumber(ip);
          const networkNum = ipToNumber(network);
          const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
          
          return (clientIpNum & mask) === (networkNum & mask);
        }
      }
      
      return false;
    });
    
    res.json({
      success: true,
      testIp: ip,
      isAllowed: isAllowed,
      message: isAllowed ? '허용된 IP입니다.' : '허용되지 않은 IP입니다.'
    });
  } catch (error) {
    console.error('IP 테스트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// IPv4 주소를 숫자로 변환
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

export default router;
