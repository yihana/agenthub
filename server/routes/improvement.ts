import { Router, Response, NextFunction } from 'express';
import { query, DB_TYPE } from '../db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeHtml, sanitizeText } from '../utils/htmlSanitizer';

const router = Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/improvements');
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

// 허용된 파일 확장자 목록 (화이트리스트 방식)
const allowedExtensions = ['.jpg', '.gif', '.jpeg', '.png', '.docx', '.pptx', '.xlsx', '.pdf'];
const allowedMimeTypes = [
  'image/jpeg', // .jpg, .jpeg
  'image/gif', // .gif
  'image/png', // .png
  'application/pdf', // .pdf
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
];

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    
    // 화이트리스트 방식: 확장자와 MIME 타입 모두 검증 (AND 조건)
    if (isValidExtension && isValidMimeType) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. JPG, GIF, JPEG, PNG, DOCX, PPTX, XLSX, PDF 파일만 업로드 가능합니다.'));
    }
  }
});

// 개선요청 생성
router.post('/requests', authenticateToken, async (req, res: Response) => {
  try {
    const { sessionId, chatHistoryId, selectedText, category, description } = req.body;
    const userId = (req as AuthenticatedRequest).user?.userid; // JWT에서 사용자 ID 추출

    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    if (!selectedText || !category || !description) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    // XSS 공격 방지를 위한 텍스트 sanitization
    const sanitizedSelectedText = sanitizeText(selectedText);
    const sanitizedCategory = sanitizeText(category);
    const sanitizedDescription = sanitizeText(description);

    // chatHistoryId가 0이면 NULL로 처리
    const validChatHistoryId = chatHistoryId && chatHistoryId > 0 ? chatHistoryId : null;
    // sessionId가 없으면 기본값 사용
    const validSessionId = sessionId || `session_${Date.now()}`;

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO improvement_requests (session_id, chat_history_id, selected_text, category, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [validSessionId, validChatHistoryId, sanitizedSelectedText, sanitizedCategory, sanitizedDescription, userId]
      );
      return res.json({ success: true, request: (result as any).rows[0] });
    } else {
      await query(
        `INSERT INTO EAR.IMPROVEMENT_REQUESTS (SESSION_ID, CHAT_HISTORY_ID, SELECTED_TEXT, CATEGORY, DESCRIPTION, CREATED_BY)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [validSessionId, validChatHistoryId, sanitizedSelectedText, sanitizedCategory, sanitizedDescription, userId]
      );
      const sel = await query(
        `SELECT TOP 1 * FROM EAR.IMPROVEMENT_REQUESTS ORDER BY ID DESC`
      );
      const row = (sel as any).rows?.[0] || (sel as any)[0];
      return res.json({ success: true, request: row });
    }
  } catch (error) {
    console.error('Error creating improvement request:', error);
    res.status(500).json({ error: '개선요청 생성 중 오류가 발생했습니다.' });
  }
});

// 개선요청 목록 조회 (사용자별)
router.get('/requests', authenticateToken, async (req, res: Response) => {
  try {
    const { status } = req.query;
    const userId = (req as AuthenticatedRequest).user?.userid; // JWT에서 사용자 ID 추출

    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    if (DB_TYPE === 'postgres') {
      let queryText = `
        SELECT ir.*, ch.user_message, ch.assistant_response, ch.created_at as chat_created_at
        FROM improvement_requests ir
        LEFT JOIN chat_history ch ON ir.chat_history_id = ch.id
        WHERE ir.created_by = $1
      `;
      const params: any[] = [userId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        queryText += ` AND ir.status = $${paramCount}`;
        params.push(status);
      }

      queryText += ` ORDER BY ir.created_at DESC`;

      const result = await query(queryText, params);
      return res.json({ requests: (result as any).rows });
    } else {
      let queryText = `
        SELECT IR.*, CH.USER_MESSAGE, CH.ASSISTANT_RESPONSE, CH.CREATED_AT as CHAT_CREATED_AT
        FROM EAR.IMPROVEMENT_REQUESTS IR
        LEFT JOIN EAR.CHAT_HISTORY CH ON IR.CHAT_HISTORY_ID = CH.ID
        WHERE IR.CREATED_BY = ?
      `;
      const params: any[] = [userId];
      
      if (status) {
        queryText += ' AND IR.STATUS = ?';
        params.push(status);
      }
      
      queryText += ' ORDER BY IR.CREATED_AT DESC';
      const result = await query(queryText, params);
      return res.json({ requests: (result as any).rows || result });
    }
  } catch (error) {
    console.error('Error fetching improvement requests:', error);
    res.status(500).json({ error: '개선요청 조회 중 오류가 발생했습니다.' });
  }
});

// 개선요청 상세 조회
router.get('/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `SELECT ir.*, ch.user_message, ch.assistant_response, ch.created_at as chat_created_at,
                u.full_name as created_by_full_name
         FROM improvement_requests ir
         LEFT JOIN chat_history ch ON ir.chat_history_id = ch.id
         LEFT JOIN users u ON ir.created_by = u.userid
         WHERE ir.id = $1`,
        [id]
      );
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: '개선요청을 찾을 수 없습니다.' });
      }
      const responses = await query(
        `SELECT * FROM improvement_responses WHERE request_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      return res.json({ 
        request: (result as any).rows[0], 
        responses: (responses as any).rows 
      });
    } else {
      const result = await query(
        `SELECT IR.*, CH.USER_MESSAGE, CH.ASSISTANT_RESPONSE, CH.CREATED_AT as CHAT_CREATED_AT,
                U.FULL_NAME AS CREATED_BY_FULL_NAME
         FROM EAR.IMPROVEMENT_REQUESTS IR
         LEFT JOIN EAR.CHAT_HISTORY CH ON IR.CHAT_HISTORY_ID = CH.ID
         LEFT JOIN EAR.USERS U ON IR.CREATED_BY = U.USERID
         WHERE IR.ID = ?`,
        [id]
      );
      const rows = (result as any).rows || result;
      if (!rows || rows.length === 0) {
      return res.status(404).json({ error: '개선요청을 찾을 수 없습니다.' });
      }
      const responses = await query(
        `SELECT * FROM EAR.IMPROVEMENT_RESPONSES WHERE REQUEST_ID = ? ORDER BY CREATED_AT ASC`,
        [id]
      );
      return res.json({ 
        request: rows[0], 
        responses: (responses as any).rows || responses 
      });
    }
  } catch (error) {
    console.error('Error fetching improvement request:', error);
    res.status(500).json({ error: '개선요청 조회 중 오류가 발생했습니다.' });
  }
});

// 개선요청 상태 업데이트 (관리자용)
router.put('/requests/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `UPDATE improvement_requests 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [status, id]
      );
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: '개선요청을 찾을 수 없습니다.' });
      }
      return res.json({ success: true, request: (result as any).rows[0] });
    } else {
      await query(
        `UPDATE EAR.IMPROVEMENT_REQUESTS 
         SET STATUS = ?, UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE ID = ?`,
        [status, id]
      );
      const sel = await query(`SELECT * FROM EAR.IMPROVEMENT_REQUESTS WHERE ID = ?`, [id]);
      const rows = (sel as any).rows || sel;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '개선요청을 찾을 수 없습니다.' });
      }
      return res.json({ success: true, request: rows[0] });
    }
  } catch (error) {
    console.error('Error updating improvement request status:', error);
    res.status(500).json({ error: '개선요청 상태 업데이트 중 오류가 발생했습니다.' });
  }
});

// 관리자 응답 추가
router.post('/requests/:id/responses', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseText, respondedBy } = req.body;

    if (!responseText) {
      return res.status(400).json({ error: '응답 내용이 필요합니다.' });
    }

    // XSS 공격 방지를 위한 텍스트 sanitization
    const sanitizedResponseText = sanitizeText(responseText);

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO improvement_responses (request_id, response_text, responded_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [id, sanitizedResponseText, respondedBy || 'admin']
      );

      await query(
        `UPDATE improvement_requests 
         SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id]
      );

      return res.json({ success: true, response: (result as any).rows[0] });
    } else {
      await query(
        `INSERT INTO EAR.IMPROVEMENT_RESPONSES (REQUEST_ID, RESPONSE_TEXT, RESPONDED_BY)
         VALUES (?, ?, ?)`,
        [id, sanitizedResponseText, respondedBy || 'admin']
      );
      await query(
        `UPDATE EAR.IMPROVEMENT_REQUESTS 
         SET STATUS = 'in_progress', UPDATED_AT = CURRENT_TIMESTAMP 
         WHERE ID = ?`,
        [id]
      );
      const sel = await query(
        `SELECT TOP 1 * FROM EAR.IMPROVEMENT_RESPONSES WHERE REQUEST_ID = ? ORDER BY ID DESC`,
        [id]
      );
      const row = (sel as any).rows?.[0] || (sel as any)[0];
      return res.json({ success: true, response: row });
    }
  } catch (error) {
    console.error('Error adding improvement response:', error);
    res.status(500).json({ error: '관리자 응답 추가 중 오류가 발생했습니다.' });
  }
});

// 관리자용 - 모든 개선요청 조회
router.get('/admin/requests', requireAdmin, async (req, res) => {
  try {
    const { status, category } = req.query;

    if (DB_TYPE === 'postgres') {
      let queryText = `
        SELECT 
          ir.*, 
          ch.user_message, 
          ch.assistant_response, 
          ch.created_at as chat_created_at,
          (SELECT COUNT(*) FROM improvement_responses WHERE request_id = ir.id) as response_count,
          u.full_name as created_by_full_name
        FROM improvement_requests ir
        LEFT JOIN chat_history ch ON ir.chat_history_id = ch.id
        LEFT JOIN users u ON ir.created_by = u.userid
      `;
      const params: any[] = [];
      let paramCount = 0;

      const conditions = [] as string[];
      if (status) {
        paramCount++;
        conditions.push(`ir.status = $${paramCount}`);
        params.push(status);
      }
      if (category) {
        paramCount++;
        conditions.push(`ir.category = $${paramCount}`);
        params.push(category);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(' AND ')}`;
      }

      queryText += ` ORDER BY ir.created_at DESC`;

      const result = await query(queryText, params);
      return res.json({ requests: (result as any).rows });
    } else {
      // HANA: Avoid GROUP BY by calculating response_count via subquery
      let queryText = `
        SELECT 
          IR.*, 
          CH.USER_MESSAGE, 
          CH.ASSISTANT_RESPONSE, 
          CH.CREATED_AT AS CHAT_CREATED_AT,
          (SELECT COUNT(*) FROM EAR.IMPROVEMENT_RESPONSES R WHERE R.REQUEST_ID = IR.ID) AS RESPONSE_COUNT,
          U.FULL_NAME AS CREATED_BY_FULL_NAME
        FROM EAR.IMPROVEMENT_REQUESTS IR
        LEFT JOIN EAR.CHAT_HISTORY CH ON IR.CHAT_HISTORY_ID = CH.ID
        LEFT JOIN EAR.USERS U ON IR.CREATED_BY = U.USERID
      `;
      const params: any[] = [];
      const conditions = [] as string[];
      if (status) {
        conditions.push('IR.STATUS = ?');
        params.push(status);
      }
      if (category) {
        conditions.push('IR.CATEGORY = ?');
        params.push(category);
      }
      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }
      queryText += ' ORDER BY IR.CREATED_AT DESC';
      const result = await query(queryText, params);
      return res.json({ requests: (result as any).rows || result });
    }
  } catch (error) {
    console.error('Error fetching admin improvement requests:', error);
    res.status(500).json({ error: '관리자 개선요청 조회 중 오류가 발생했습니다.' });
  }
});

// ===== 시스템 개선요청 (독립적인 개선요청, 채팅 무관) =====

// 시스템 개선요청 생성 (파일 첨부 지원)
router.post('/system-requests', authenticateToken, upload.array('attachments', 5), async (req, res: Response) => {
  try {
    const { title, content } = req.body;
    const userId = (req as AuthenticatedRequest).user?.userid; // JWT에서 사용자 ID 추출

    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    // XSS 공격 방지를 위한 HTML/텍스트 sanitization
    const sanitizedTitle = sanitizeText(title);
    const sanitizedContent = sanitizeHtml(content, true); // 이미지 허용

    // 첨부파일 정보 저장
    const attachments = req.files ? (req.files as Express.Multer.File[]).map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    })) : [];

    const attachmentsJson = JSON.stringify(attachments);

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO system_improvement_requests (title, content, attachments, created_by, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [sanitizedTitle, sanitizedContent, attachmentsJson, userId]
      );
      return res.json({ success: true, request: (result as any).rows[0] });
    } else {
      await query(
        `INSERT INTO EAR.SYSTEM_IMPROVEMENT_REQUESTS (TITLE, CONTENT, ATTACHMENTS, CREATED_BY, STATUS)
         VALUES (?, ?, ?, ?, 'pending')`,
        [sanitizedTitle, sanitizedContent, attachmentsJson, userId]
      );
      const sel = await query(
        `SELECT TOP 1 * FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS ORDER BY ID DESC`
      );
      const row = (sel as any).rows?.[0] || (sel as any)[0];
      return res.json({ success: true, request: row });
    }
  } catch (error) {
    console.error('Error creating system improvement request:', error);
    res.status(500).json({ error: '시스템 개선요청 생성 중 오류가 발생했습니다.' });
  }
});

// 시스템 개선요청 목록 조회 (페이징 지원)
router.get('/system-requests', authenticateToken, async (req, res: Response) => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    const userId = (req as AuthenticatedRequest).user?.userid; // JWT에서 사용자 ID 추출

    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    if (DB_TYPE === 'postgres') {
      // 전체 개수 조회
      let countQuery = 'SELECT COUNT(*) FROM system_improvement_requests WHERE created_by = $1';
      const countParams: any[] = [userId];

      if (status) {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt((countResult as any).rows[0].count, 10);

      // 데이터 조회
      let dataQuery = `
        SELECT sir.*, 
               (SELECT COUNT(*) FROM system_improvement_responses WHERE request_id = sir.id) as response_count
        FROM system_improvement_requests sir
        WHERE created_by = $1
      `;
      const dataParams: any[] = [userId];

      if (status) {
        dataQuery += ' AND status = $2';
        dataParams.push(status);
      }

      dataQuery += ` ORDER BY sir.created_at DESC LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
      dataParams.push(limitNum, offset);

      const dataResult = await query(dataQuery, dataParams);

      return res.json({
        requests: (dataResult as any).rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } else {
      // HANA
      // 전체 개수 조회
      let countQuery = 'SELECT COUNT(*) AS CNT FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS WHERE CREATED_BY = ?';
      const countParams: any[] = [userId];

      if (status) {
        countQuery += ' AND STATUS = ?';
        countParams.push(status);
      }

      const countResult = await query(countQuery, countParams);
      const total = (countResult as any).rows?.[0]?.cnt || (countResult as any)[0]?.cnt || 0;

      // 데이터 조회
      let dataQuery = `
        SELECT SIR.*, 
               (SELECT COUNT(*) FROM EAR.SYSTEM_IMPROVEMENT_RESPONSES WHERE REQUEST_ID = SIR.ID) AS RESPONSE_COUNT
        FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS SIR
        WHERE CREATED_BY = ?
      `;
      const dataParams: any[] = [userId];

      if (status) {
        dataQuery += ' AND STATUS = ?';
        dataParams.push(status);
      }

      dataQuery += ' ORDER BY SIR.CREATED_AT DESC LIMIT ? OFFSET ?';
      dataParams.push(limitNum, offset);

      const dataResult = await query(dataQuery, dataParams);

      return res.json({
        requests: (dataResult as any).rows || dataResult,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }
  } catch (error) {
    console.error('Error fetching system improvement requests:', error);
    res.status(500).json({ error: '시스템 개선요청 조회 중 오류가 발생했습니다.' });
  }
});

// 시스템 개선요청 상세 조회
router.get('/system-requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'postgres') {
      const result = await query(
        'SELECT * FROM system_improvement_requests WHERE id = $1',
        [id]
      );
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: '시스템 개선요청을 찾을 수 없습니다.' });
      }
      const responses = await query(
        'SELECT * FROM system_improvement_responses WHERE request_id = $1 ORDER BY created_at ASC',
        [id]
      );
      return res.json({
        request: (result as any).rows[0],
        responses: (responses as any).rows
      });
    } else {
      const result = await query(
        'SELECT * FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS WHERE ID = ?',
        [id]
      );
      const rows = (result as any).rows || result;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '시스템 개선요청을 찾을 수 없습니다.' });
      }
      const responses = await query(
        'SELECT * FROM EAR.SYSTEM_IMPROVEMENT_RESPONSES WHERE REQUEST_ID = ? ORDER BY CREATED_AT ASC',
        [id]
      );
      return res.json({
        request: rows[0],
        responses: (responses as any).rows || responses
      });
    }
  } catch (error) {
    console.error('Error fetching system improvement request:', error);
    res.status(500).json({ error: '시스템 개선요청 조회 중 오류가 발생했습니다.' });
  }
});

// 시스템 개선요청 상태 업데이트 (관리자용)
router.put('/system-requests/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(
        'UPDATE system_improvement_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: '시스템 개선요청을 찾을 수 없습니다.' });
      }
      return res.json({ success: true, request: (result as any).rows[0] });
    } else {
      await query(
        'UPDATE EAR.SYSTEM_IMPROVEMENT_REQUESTS SET STATUS = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?',
        [status, id]
      );
      const sel = await query('SELECT * FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS WHERE ID = ?', [id]);
      const rows = (sel as any).rows || sel;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '시스템 개선요청을 찾을 수 없습니다.' });
      }
      return res.json({ success: true, request: rows[0] });
    }
  } catch (error) {
    console.error('Error updating system improvement request status:', error);
    res.status(500).json({ error: '시스템 개선요청 상태 업데이트 중 오류가 발생했습니다.' });
  }
});

// 시스템 개선요청 응답 추가 (관리자용)
router.post('/system-requests/:id/responses', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseText, respondedBy } = req.body;

    if (!responseText) {
      return res.status(400).json({ error: '응답 내용이 필요합니다.' });
    }

    // XSS 공격 방지를 위한 텍스트 sanitization
    const sanitizedResponseText = sanitizeText(responseText);

    if (DB_TYPE === 'postgres') {
      const result = await query(
        'INSERT INTO system_improvement_responses (request_id, response_text, responded_by) VALUES ($1, $2, $3) RETURNING *',
        [id, sanitizedResponseText, respondedBy || 'admin']
      );

      await query(
        'UPDATE system_improvement_requests SET status = \'in_progress\', updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      return res.json({ success: true, response: (result as any).rows[0] });
    } else {
      await query(
        'INSERT INTO EAR.SYSTEM_IMPROVEMENT_RESPONSES (REQUEST_ID, RESPONSE_TEXT, RESPONDED_BY) VALUES (?, ?, ?)',
        [id, sanitizedResponseText, respondedBy || 'admin']
      );
      await query(
        'UPDATE EAR.SYSTEM_IMPROVEMENT_REQUESTS SET STATUS = \'in_progress\', UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?',
        [id]
      );
      const sel = await query(
        'SELECT TOP 1 * FROM EAR.SYSTEM_IMPROVEMENT_RESPONSES WHERE REQUEST_ID = ? ORDER BY ID DESC',
        [id]
      );
      const row = (sel as any).rows?.[0] || (sel as any)[0];
      return res.json({ success: true, response: row });
    }
  } catch (error) {
    console.error('Error adding system improvement response:', error);
    res.status(500).json({ error: '관리자 응답 추가 중 오류가 발생했습니다.' });
  }
});

// 관리자용 - 모든 시스템 개선요청 조회 (페이징 지원)
router.get('/admin/system-requests', requireAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    if (DB_TYPE === 'postgres') {
      let countQuery = 'SELECT COUNT(*) FROM system_improvement_requests';
      const countParams: any[] = [];

      if (status) {
        countQuery += ' WHERE status = $1';
        countParams.push(status);
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt((countResult as any).rows[0].count, 10);

      let dataQuery = `
        SELECT sir.*, 
               (SELECT COUNT(*) FROM system_improvement_responses WHERE request_id = sir.id) as response_count
        FROM system_improvement_requests sir
      `;
      const dataParams: any[] = [];

      if (status) {
        dataQuery += ' WHERE status = $1';
        dataParams.push(status);
      }

      dataQuery += ` ORDER BY sir.created_at DESC LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
      dataParams.push(limitNum, offset);

      const dataResult = await query(dataQuery, dataParams);

      return res.json({
        requests: (dataResult as any).rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } else {
      let countQuery = 'SELECT COUNT(*) AS CNT FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS';
      const countParams: any[] = [];

      if (status) {
        countQuery += ' WHERE STATUS = ?';
        countParams.push(status);
      }

      const countResult = await query(countQuery, countParams);
      const total = (countResult as any).rows?.[0]?.cnt || (countResult as any)[0]?.cnt || 0;

      let dataQuery = `
        SELECT SIR.*, 
               (SELECT COUNT(*) FROM EAR.SYSTEM_IMPROVEMENT_RESPONSES WHERE REQUEST_ID = SIR.ID) AS RESPONSE_COUNT
        FROM EAR.SYSTEM_IMPROVEMENT_REQUESTS SIR
      `;
      const dataParams: any[] = [];

      if (status) {
        dataQuery += ' WHERE STATUS = ?';
        dataParams.push(status);
      }

      dataQuery += ' ORDER BY SIR.CREATED_AT DESC LIMIT ? OFFSET ?';
      dataParams.push(limitNum, offset);

      const dataResult = await query(dataQuery, dataParams);

      return res.json({
        requests: (dataResult as any).rows || dataResult,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }
  } catch (error) {
    console.error('Error fetching admin system improvement requests:', error);
    res.status(500).json({ error: '관리자 시스템 개선요청 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
