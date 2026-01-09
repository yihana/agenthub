import { Router, Response } from 'express';
import { query, DB_TYPE } from '../db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeHtml } from '../utils/htmlSanitizer';

const router = Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/privacy-policies');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (fileExtension === '.html') {
      cb(null, true);
    } else {
      cb(new Error('HTML 파일만 업로드 가능합니다.'));
    }
  }
});

// 파일명 인코딩 변환 헬퍼 함수
function decodeFileName(originalName: string): string {
  try {
    // URL 인코딩된 경우 디코딩
    if (originalName.includes('%')) {
      return decodeURIComponent(originalName);
    }
    // multer는 파일명을 latin1로 받아오므로 UTF-8로 변환
    // 한글이 깨진 경우 latin1 -> utf8 변환 시도
    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    // 변환 결과가 유효한 UTF-8인지 확인 (한글이 포함되어 있는지)
    if (decoded !== originalName && /[\uAC00-\uD7A3]/.test(decoded)) {
      return decoded;
    }
    return originalName;
  } catch (e) {
    console.warn('파일명 디코딩 실패:', e);
    return originalName;
  }
}

// HTML의 71-72번째 줄 영역을 이전 버전 링크로 수정하는 함수
function modifyHtmlWithPreviousVersions(htmlContent: string, previousVersions: Array<{ id: number; version: string; file_name: string }>): string {
  // HTML을 줄 단위로 분할
  const lines = htmlContent.split('\n');
  
  // 이전 버전 링크 HTML 생성
  let previousVersionsHtml = '';
  if (previousVersions.length > 0) {
    previousVersionsHtml = '<div style="margin-top: 10px;">\n';
    previousVersionsHtml += '<strong>이전 개인정보 처리방침:</strong><br>\n';
    previousVersions.forEach((version, index) => {
      previousVersionsHtml += `<a href="#" onclick="window.parent.postMessage({type: 'openPrivacyPolicy', id: ${version.id}}, '*'); return false;" style="color: #0056b3; text-decoration: underline; margin-right: 15px;">${version.version} (${version.file_name})</a>`;
      if (index < previousVersions.length - 1) {
        previousVersionsHtml += ' | ';
      }
    });
    previousVersionsHtml += '</div>\n';
  } else {
    previousVersionsHtml = '<p style="color: #666; font-size: 0.9em;">이전 개인정보 처리방침이 없습니다.</p>\n';
  }
  
  // 71-72번째 줄 찾기 (0-based index이므로 70-71)
  if (lines.length > 71) {
    // 71-72번째 줄을 교체
    lines[70] = '    <p><strong>○ 이전의 방침은 아래에서 확인할 수 있습니다. </strong></p>';
    lines[71] = previousVersionsHtml;
  } else {
    // 줄이 부족한 경우 끝에 추가
    while (lines.length < 71) {
      lines.push('');
    }
    lines.push('    <p><strong>○ 이전의 방침은 아래에서 확인할 수 있습니다. </strong></p>');
    lines.push(previousVersionsHtml);
  }
  
  return lines.join('\n');
}

// 개인정보 처리방침 업로드
router.post('/upload', authenticateToken, upload.single('file'), async (req, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const userId = (req as AuthenticatedRequest).user?.userid;
    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    // 파일 읽기
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // 파일명 인코딩 처리 (한글 파일명 깨짐 방지)
    const fileName = decodeFileName(req.file.originalname);
    
    // 파일명에서 버전 추출 (예: 개인정보처리방침_20251215.html -> 20251215)
    const versionMatch = fileName.match(/_(\d{8})\.html$/i);
    const version = versionMatch ? versionMatch[1] : new Date().toISOString().split('T')[0].replace(/-/g, '');

    // 이전 버전 목록 조회
    let previousVersions: Array<{ id: number; version: string; file_name: string }> = [];
    if (DB_TYPE === 'postgres') {
      const prevResult = await query(
        `SELECT id, version, file_name FROM privacy_policies ORDER BY created_at DESC`
      );
      previousVersions = prevResult.rows || [];
    } else {
      const prevResult = await query(
        `SELECT ID as id, VERSION as version, FILE_NAME as file_name FROM EAR.privacy_policies ORDER BY CREATED_AT DESC`
      );
      previousVersions = prevResult.rows || [];
    }

    // HTML 수정 (이전 버전 링크 추가)
    const modifiedHtml = modifyHtmlWithPreviousVersions(fileContent, previousVersions);

    // XSS 방지를 위한 sanitization (전체 HTML 구조 허용)
    const sanitizedHtml = sanitizeHtml(modifiedHtml, false, true);

    // 기존의 모든 버전을 is_current = false로 설정
    if (DB_TYPE === 'postgres') {
      await query(`UPDATE privacy_policies SET is_current = false WHERE is_current = true`);
      
      // 새 버전 저장
      const result = await query(
        `INSERT INTO privacy_policies (version, file_name, html_content, is_current, created_by)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id, version, file_name, created_at`,
        [version, fileName, sanitizedHtml, userId]
      );
      
      // 업로드된 파일 삭제 (DB에 저장했으므로)
      fs.unlinkSync(req.file.path);
      
      res.json({
        success: true,
        data: {
          id: result.rows[0].id,
          version: result.rows[0].version,
          file_name: result.rows[0].file_name,
          created_at: result.rows[0].created_at
        }
      });
    } else {
      await query(`UPDATE EAR.privacy_policies SET IS_CURRENT = false WHERE IS_CURRENT = true`);
      
      const result = await query(
        `INSERT INTO EAR.privacy_policies (VERSION, FILE_NAME, HTML_CONTENT, IS_CURRENT, CREATED_BY)
         VALUES (?, ?, ?, true, ?)`,
        [version, fileName, sanitizedHtml, userId]
      );
      
      fs.unlinkSync(req.file.path);
      
      const insertedId = await query(`SELECT TOP 1 ID FROM EAR.privacy_policies WHERE VERSION = ? AND FILE_NAME = ? ORDER BY CREATED_AT DESC`, [version, fileName]);
      
      res.json({
        success: true,
        data: {
          id: insertedId.rows?.[0]?.id || insertedId.rows?.[0]?.ID,
          version: version,
          file_name: fileName,
          created_at: new Date().toISOString()
        }
      });
    }
  } catch (error: any) {
    console.error('개인정보 처리방침 업로드 오류:', error);
    
    // 업로드된 파일이 있으면 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message || '개인정보 처리방침 업로드 중 오류가 발생했습니다.' });
  }
});

// 현재 활성 버전 조회
router.get('/current', async (req, res: Response) => {
  try {
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        `SELECT id, version, file_name, html_content, created_at, created_by
         FROM privacy_policies
         WHERE is_current = true
         ORDER BY created_at DESC
         LIMIT 1`
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '현재 활성화된 개인정보 처리방침이 없습니다.' });
      }
      
      res.json({ data: result.rows[0] });
    } else {
      result = await query(
        `SELECT TOP 1 ID as id, VERSION as version, FILE_NAME as file_name, HTML_CONTENT as html_content, CREATED_AT as created_at, CREATED_BY as created_by
         FROM EAR.privacy_policies
         WHERE IS_CURRENT = true
         ORDER BY CREATED_AT DESC`
      );
      
      if (!result || !result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '현재 활성화된 개인정보 처리방침이 없습니다.' });
      }
      
      res.json({ data: result.rows[0] });
    }
  } catch (error: any) {
    console.error('현재 개인정보 처리방침 조회 오류:', error);
    res.status(500).json({ error: '개인정보 처리방침 조회 중 오류가 발생했습니다.' });
  }
});

// 모든 버전 목록 조회
router.get('/list', authenticateToken, async (req, res: Response) => {
  try {
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        `SELECT id, version, file_name, is_current, created_at, created_by
         FROM privacy_policies
         ORDER BY created_at DESC`
      );
      
      res.json({ data: result.rows });
    } else {
      result = await query(
        `SELECT ID as id, VERSION as version, FILE_NAME as file_name, IS_CURRENT as is_current, CREATED_AT as created_at, CREATED_BY as created_by
         FROM EAR.privacy_policies
         ORDER BY CREATED_AT DESC`
      );
      
      res.json({ data: result.rows || [] });
    }
  } catch (error: any) {
    console.error('개인정보 처리방침 목록 조회 오류:', error);
    res.status(500).json({ error: '개인정보 처리방침 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 특정 버전 조회
router.get('/:id', authenticateToken, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
    }

    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        `SELECT id, version, file_name, html_content, is_current, created_at, created_by
         FROM privacy_policies
         WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '개인정보 처리방침을 찾을 수 없습니다.' });
      }
      
      res.json({ data: result.rows[0] });
    } else {
      result = await query(
        `SELECT ID as id, VERSION as version, FILE_NAME as file_name, HTML_CONTENT as html_content, IS_CURRENT as is_current, CREATED_AT as created_at, CREATED_BY as created_by
         FROM EAR.privacy_policies
         WHERE ID = ?`,
        [id]
      );
      
      if (!result || !result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '개인정보 처리방침을 찾을 수 없습니다.' });
      }
      
      res.json({ data: result.rows[0] });
    }
  } catch (error: any) {
    console.error('개인정보 처리방침 조회 오류:', error);
    res.status(500).json({ error: '개인정보 처리방침 조회 중 오류가 발생했습니다.' });
  }
});

// 현재 버전 설정
router.put('/:id/set-current', authenticateToken, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
    }

    const userId = (req as AuthenticatedRequest).user?.userid;
    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    // 기존의 모든 버전을 is_current = false로 설정
    if (DB_TYPE === 'postgres') {
      await query(`UPDATE privacy_policies SET is_current = false WHERE is_current = true`);
      
      // 선택한 버전을 is_current = true로 설정
      const result = await query(
        `UPDATE privacy_policies SET is_current = true WHERE id = $1 RETURNING id, version, file_name`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '개인정보 처리방침을 찾을 수 없습니다.' });
      }
      
      res.json({ success: true, data: result.rows[0] });
    } else {
      await query(`UPDATE EAR.privacy_policies SET IS_CURRENT = false WHERE IS_CURRENT = true`);
      
      await query(
        `UPDATE EAR.privacy_policies SET IS_CURRENT = true WHERE ID = ?`,
        [id]
      );
      
      const result = await query(
        `SELECT ID as id, VERSION as version, FILE_NAME as file_name FROM EAR.privacy_policies WHERE ID = ?`,
        [id]
      );
      
      if (!result || !result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '개인정보 처리방침을 찾을 수 없습니다.' });
      }
      
      res.json({ success: true, data: result.rows[0] });
    }
  } catch (error: any) {
    console.error('현재 버전 설정 오류:', error);
    res.status(500).json({ error: '현재 버전 설정 중 오류가 발생했습니다.' });
  }
});

export default router;

