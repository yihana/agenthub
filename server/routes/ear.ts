import express from 'express';
import multer from 'multer';
import path from 'path';
import { query, DB_TYPE } from '../db';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// 허용된 파일 확장자 목록
const allowedExtensions = ['.md', '.txt', '.doc', '.docx', '.ppt', '.pptx', '.pdf', '.xls', '.xlsx'];
const allowedMimeTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
];

// 파일 업로드를 위한 multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    
    if (isValidExtension || isValidMimeType) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. MD, TXT, DOC, DOCX, PPT, PPTX, PDF, XLS, XLSX 파일만 업로드 가능합니다.'));
    }
  },
});

// AI 자동작성 API
router.post('/ai-generate', authenticateToken, async (req, res) => {
  try {
    const { template_name, template_description, required_fields, keyword, category } = req.body;
    
    if (!template_name || !required_fields) {
      return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
    }

    // 템플릿에 따른 AI 생성 로직
    const generatedData: Record<string, string> = {};
    
    // 방화벽 오픈 신청 템플릿의 경우
    if (template_name.includes('방화벽') || template_name.includes('firewall')) {
      generatedData.source_ip = '192.168.1.100';
      generatedData.dest_ip = '10.0.0.50';
      generatedData.port = '443';
      generatedData.protocol = 'TCP';
      generatedData.start_date = new Date().toISOString().split('T')[0];
      generatedData.end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30일 후
      generatedData.target_system = '웹서버';
      generatedData.reason = 'HTTPS 서비스를 위한 포트 오픈이 필요합니다. 보안 정책에 따라 필요한 최소 권한으로 설정하겠습니다.';
      generatedData.service_name = 'HTTPS 서비스';
    }
    // 다른 템플릿들에 대한 기본값 설정
    else {
      required_fields.forEach((field: any) => {
        switch (field.name) {
          case 'start_date':
            generatedData[field.name] = new Date().toISOString().split('T')[0];
            break;
          case 'end_date':
            generatedData[field.name] = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7일 후
            break;
          case 'protocol':
            generatedData[field.name] = field.options?.[0] || 'TCP';
            break;
          case 'port':
            generatedData[field.name] = '443';
            break;
          default:
            if (field.type === 'text') {
              generatedData[field.name] = `${field.label}에 대한 자동 생성된 내용입니다.`;
            } else if (field.type === 'email') {
              generatedData[field.name] = 'user@company.com';
            } else if (field.type === 'number') {
              generatedData[field.name] = '1';
            }
        }
      });
    }

    res.json({
      success: true,
      generated_data: generatedData,
      message: 'AI가 템플릿에 맞게 자동으로 내용을 생성했습니다.'
    });

  } catch (error) {
    console.error('AI 자동작성 오류:', error);
    res.status(500).json({ error: 'AI 자동작성 중 오류가 발생했습니다.' });
  }
});

// 키워드 검색 API
router.get('/keywords', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ keywords: [] });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(`
        SELECT id, keyword, display_name, category
        FROM ear_keywords
        WHERE keyword ILIKE $1 OR display_name ILIKE $1
        ORDER BY 
          CASE 
            WHEN keyword ILIKE $2 THEN 1
            WHEN display_name ILIKE $2 THEN 2
            ELSE 3
          END,
          display_name
        LIMIT 10
      `, [`%${q}%`, `${q}%`]);

      return res.json({ keywords: (result as any).rows });
    } else {
      const likeAny = `%${String(q).toUpperCase()}%`;
      const likePrefix = `${String(q).toUpperCase()}%`;
      const result = await query(
        `SELECT ID as id, KEYWORD as keyword, DISPLAY_NAME as display_name, CATEGORY as category
         FROM EAR.EAR_KEYWORDS
         WHERE UPPER(KEYWORD) LIKE ? OR UPPER(DISPLAY_NAME) LIKE ?
         ORDER BY 
           CASE 
             WHEN UPPER(KEYWORD) LIKE ? THEN 1
             WHEN UPPER(DISPLAY_NAME) LIKE ? THEN 2
             ELSE 3
           END,
           DISPLAY_NAME
         LIMIT 10`,
        [likeAny, likeAny, likePrefix, likePrefix]
      );

      return res.json({ keywords: (result as any).rows || result });
    }
  } catch (error) {
    console.error('키워드 검색 오류:', error);
    res.status(500).json({ error: '키워드 검색 중 오류가 발생했습니다.' });
  }
});

// 템플릿 조회 API
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { keyword_id } = req.query;
    
    if (!keyword_id) {
      return res.status(400).json({ error: '키워드 ID가 필요합니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(`
        SELECT 
          t.id,
          t.keyword_id,
          t.template_name,
          t.template_description,
          t.required_fields,
          k.display_name as keyword_display_name
        FROM ear_request_templates t
        JOIN ear_keywords k ON t.keyword_id = k.id
        WHERE t.keyword_id = $1
        ORDER BY t.template_name
      `, [keyword_id]);

      const templates = (result as any).rows.map((r: any) => ({
        ...r,
        required_fields: typeof r.required_fields === 'string' ? JSON.parse(r.required_fields) : r.required_fields
      }));
      return res.json({ templates });
    } else {
      const result = await query(
        `SELECT 
           T.ID as id,
           T.KEYWORD_ID as keyword_id,
           T.TEMPLATE_NAME as template_name,
           T.TEMPLATE_DESCRIPTION as template_description,
           T.REQUIRED_FIELDS as required_fields,
           K.DISPLAY_NAME as keyword_display_name
         FROM EAR.EAR_REQUEST_TEMPLATES T
         JOIN EAR.EAR_KEYWORDS K ON T.KEYWORD_ID = K.ID
         WHERE T.KEYWORD_ID = ?
         ORDER BY T.TEMPLATE_NAME`,
        [Number(keyword_id)]
      );

      const rows = (result as any).rows || result;
      const templates = rows.map((r: any) => ({
        ...r,
        required_fields: typeof r.required_fields === 'string' ? JSON.parse(r.required_fields) : r.required_fields
      }));
      return res.json({ templates });
    }
  } catch (error) {
    console.error('템플릿 조회 오류:', error);
    res.status(500).json({ error: '템플릿 조회 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 등록 API
router.post('/requests', authenticateToken, upload.array('attachments'), async (req, res) => {
  try {
    const { title, content, template_id, form_data } = req.body;
    const files = req.files as Express.Multer.File[];
    
    // XSUAA에서 받은 email 추출 (email이 없으면 userid 사용)
    const userEmail = (req as AuthenticatedRequest).user?.email || (req as AuthenticatedRequest).user?.userid;
    
    if (!userEmail) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    console.log('EAR 요청 등록 요청:', { title, content, template_id, filesCount: files?.length || 0, userEmail });

    // 기본 필수 필드만 검증 (template_id는 선택사항)
    if (!title || !content) {
      return res.status(400).json({ error: '요청 제목과 요청 내용은 필수입니다.' });
    }

    // 템플릿이 제공된 경우에만 템플릿 존재 확인
    let templateName = null;
    if (template_id) {
      const templateResult = await query(
        'SELECT id, template_name FROM ear_request_templates WHERE id = $1',
        [template_id]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: '템플릿을 찾을 수 없습니다.' });
      }
      
      templateName = templateResult.rows[0].template_name;
    }

    // 첨부파일 정보 처리
    let attachmentsData = null;
    if (files && files.length > 0) {
      console.log('첨부파일 처리 시작:', files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })));
      attachmentsData = files.map(file => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        data: file.buffer.toString('base64')
      }));
      console.log('첨부파일 처리 완료:', attachmentsData.length, '개 파일');
    } else {
      console.log('첨부파일 없음');
    }

    // 요청 등록 (template_id가 null일 수 있음)
    let newRequest: any;
    if (DB_TYPE === 'postgres') {
      const result = await query(`
        INSERT INTO ear_requests (
          request_title,
          request_content,
          template_id,
          form_data,
          attachments,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, request_title, status, created_at
      `, [
        title,
        content,
        template_id || null,
        form_data ? JSON.stringify(JSON.parse(form_data)) : null,
        attachmentsData ? JSON.stringify(attachmentsData) : null,
        userEmail
      ]);
      newRequest = (result as any).rows[0];
    } else {
      // HANA: EAR 스키마 및 대문자 컬럼 사용, RETURNING 미지원 → 최근 레코드 조회
      await query(
        `INSERT INTO EAR.EAR_REQUESTS (
           REQUEST_TITLE,
           REQUEST_CONTENT,
           TEMPLATE_ID,
           FORM_DATA,
           ATTACHMENTS,
           STATUS,
           CREATED_BY,
           CREATED_AT,
           UPDATED_AT
         ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          title,
          content,
          template_id || null,
          form_data ? JSON.stringify(JSON.parse(form_data)) : null,
          attachmentsData ? JSON.stringify(attachmentsData) : null,
          userEmail
        ]
      );

      const selectResult = await query(
        `SELECT TOP 1 ID as id, REQUEST_TITLE as request_title, STATUS as status, CREATED_AT as created_at
         FROM EAR.EAR_REQUESTS
         ORDER BY ID DESC`
      );
      newRequest = (selectResult as any).rows?.[0] || (selectResult as any)[0];
    }
    console.log('EAR 요청 등록 완료:', { id: newRequest.id, title: newRequest.request_title });

    res.json({
      success: true,
      message: 'EAR 요청이 성공적으로 등록되었습니다.',
      request: newRequest
    });

  } catch (error) {
    console.error('EAR 요청 등록 오류:', error);
    res.status(500).json({ error: 'EAR 요청 등록 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 목록 조회 API
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      search, 
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20 
    } = req.query;

    if (DB_TYPE === 'postgres') {
      let listQuery = `
        SELECT 
          r.id,
          r.request_title,
          r.request_content,
          r.status,
          r.created_by,
          r.created_at,
          r.updated_at,
          t.template_name
        FROM ear_requests r
        LEFT JOIN ear_request_templates t ON r.template_id = t.id
      `;
      
      let countQuery = 'SELECT COUNT(*) as total FROM ear_requests r';
      
      const queryParams: any[] = [];
      const countParams: any[] = [];
      let paramIndex = 1;
      let countParamIndex = 1;
      let whereConditions: string[] = [];

      if (status) {
        whereConditions.push(`r.status = $${paramIndex}`);
        queryParams.push(status);
        countParams.push(status);
        paramIndex++;
        countParamIndex++;
      }

      if (search) {
        whereConditions.push(`(r.request_title ILIKE $${paramIndex} OR r.request_content ILIKE $${paramIndex})`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm);
        countParams.push(searchTerm);
        paramIndex++;
        countParamIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`r.created_at >= $${paramIndex}`);
        queryParams.push(dateFrom);
        countParams.push(dateFrom);
        paramIndex++;
        countParamIndex++;
      }

      if (dateTo) {
        whereConditions.push(`r.created_at <= $${paramIndex}`);
        queryParams.push(String(dateTo) + ' 23:59:59');
        countParams.push(String(dateTo) + ' 23:59:59');
        paramIndex++;
        countParamIndex++;
      }

      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        listQuery += whereClause;
        countQuery += whereClause;
      }

      listQuery += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (Number(page) - 1) * Number(limit));

      const result = await query(listQuery, queryParams);
      const countResult = await query(countQuery, countParams);
      const total = parseInt((countResult as any).rows[0].total);

      return res.json({
        requests: (result as any).rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } else {
      // HANA
      let listQuery = `
        SELECT 
          R.ID as id,
          R.REQUEST_TITLE as request_title,
          R.REQUEST_CONTENT as request_content,
          R.STATUS as status,
          R.CREATED_BY as created_by,
          R.CREATED_AT as created_at,
          R.UPDATED_AT as updated_at,
          T.TEMPLATE_NAME as template_name
        FROM EAR.EAR_REQUESTS R
        LEFT JOIN EAR.EAR_REQUEST_TEMPLATES T ON R.TEMPLATE_ID = T.ID
      `;

      let countQuery = 'SELECT COUNT(*) as total FROM EAR.EAR_REQUESTS R';

      const queryParams: any[] = [];
      const countParams: any[] = [];
      const whereConditions: string[] = [];

      if (status) {
        whereConditions.push(`R.STATUS = ?`);
        queryParams.push(String(status).toUpperCase());
        countParams.push(String(status).toUpperCase());
      }

      if (search) {
        whereConditions.push('(UPPER(R.REQUEST_TITLE) LIKE ? OR UPPER(R.REQUEST_CONTENT) LIKE ?)');
        const searchTerm = `%${String(search).toUpperCase()}%`;
        queryParams.push(searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm);
      }

      if (dateFrom) {
        whereConditions.push('R.CREATED_AT >= ?');
        queryParams.push(dateFrom);
        countParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push('R.CREATED_AT <= ?');
        const endOfDay = String(dateTo) + ' 23:59:59';
        queryParams.push(endOfDay);
        countParams.push(endOfDay);
      }

      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        listQuery += whereClause;
        countQuery += whereClause;
      }

      // HANA supports LIMIT ... OFFSET
      listQuery += ' ORDER BY R.CREATED_AT DESC LIMIT ? OFFSET ?';
      queryParams.push(Number(limit), (Number(page) - 1) * Number(limit));

      const result = await query(listQuery, queryParams);
      const countResult = await query(countQuery, countParams);
      const total = parseInt(((countResult as any).rows?.[0] || (countResult as any)[0]).total);

      return res.json({
        requests: (result as any).rows || result,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    }

  } catch (error) {
    console.error('EAR 요청 목록 조회 오류:', error);
    res.status(500).json({ error: 'EAR 요청 목록 조회 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 상세 조회 API
router.get('/requests/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        r.*,
        t.template_name,
        t.template_description,
        k.display_name as keyword_display_name
      FROM ear_requests r
      LEFT JOIN ear_request_templates t ON r.template_id = t.id
      LEFT JOIN ear_keywords k ON t.keyword_id = k.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    const request = result.rows[0];

    // 첨부파일 정보에서 base64 데이터 제거 (용량 때문)
    if (request.attachments) {
      request.attachments = request.attachments.map((file: any) => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
    }

    res.json({ request });

  } catch (error) {
    console.error('EAR 요청 상세 조회 오류:', error);
    res.status(500).json({ error: 'EAR 요청 상세 조회 중 오류가 발생했습니다.' });
  }
});

// 초기 데이터 설정 API (개발용, 관리자 전용)
router.post('/init-data', requireAdmin, async (req, res) => {
  try {
    // 키워드 데이터 삽입
    const keywordsData = [
      {
        keyword: '방화',
        display_name: '방화벽 오픈 신청',
        category: '보안'
      },
      {
        keyword: 'firewall',
        display_name: 'Firewall Access Request',
        category: '보안'
      },
      {
        keyword: '시스템',
        display_name: '시스템 접근 신청',
        category: '인프라'
      },
      {
        keyword: '계정',
        display_name: '계정 생성/변경 신청',
        category: '계정관리'
      }
    ];

    for (const keywordData of keywordsData) {
      await query(`
        INSERT INTO ear_keywords (keyword, display_name, category)
        VALUES ($1, $2, $3)
        ON CONFLICT (keyword) DO NOTHING
      `, [keywordData.keyword, keywordData.display_name, keywordData.category]);
    }

    // 방화벽 오픈 신청 템플릿
    const firewallKeyword = await query(
      'SELECT id FROM ear_keywords WHERE keyword = $1',
      ['방화']
    );

    if (firewallKeyword.rows.length > 0) {
      const keywordId = firewallKeyword.rows[0].id;
      
      const requiredFields = [
        { name: 'source_ip', label: '출발지 IP', type: 'text', required: true, placeholder: '예: 192.168.1.100' },
        { name: 'dest_ip', label: '도착지 IP', type: 'text', required: true, placeholder: '예: 10.0.0.50' },
        { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '예: 443' },
        { name: 'protocol', label: 'Protocol', type: 'select', required: true, options: ['TCP', 'UDP', 'ICMP'] },
        { name: 'start_date', label: '오픈일', type: 'date', required: true },
        { name: 'end_date', label: '종료일', type: 'date', required: true },
        { name: 'target_system', label: '대상시스템', type: 'text', required: true, placeholder: '예: 웹서버' },
        { name: 'reason', label: '오픈사유', type: 'text', required: true, placeholder: '방화벽 오픈 사유를 입력하세요' },
        { name: 'service_name', label: '서비스명', type: 'text', required: true, placeholder: '예: HTTPS 서비스' }
      ];

      await query(`
        INSERT INTO ear_request_templates (keyword_id, template_name, template_description, required_fields)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (keyword_id, template_name) DO NOTHING
      `, [
        keywordId,
        '방화벽 오픈 신청',
        '네트워크 보안을 위한 방화벽 포트 오픈을 신청합니다. 모든 필수 정보를 정확히 입력해주세요.',
        JSON.stringify(requiredFields)
      ]);
    }

    res.json({
      success: true,
      message: '초기 데이터가 성공적으로 설정되었습니다.'
    });

  } catch (error) {
    console.error('초기 데이터 설정 오류:', error);
    res.status(500).json({ error: '초기 데이터 설정 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 첨부파일 다운로드 API
router.get('/requests/:id/attachments/:attachmentIndex', authenticateToken, async (req, res) => {
  try {
    const { id, attachmentIndex } = req.params;

    const result = await query(`
      SELECT attachments
      FROM ear_requests
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    const attachments = result.rows[0].attachments;
    if (!attachments || !attachments[attachmentIndex]) {
      return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' });
    }

    const attachment = attachments[attachmentIndex];
    const fileBuffer = Buffer.from(attachment.data, 'base64');

    res.setHeader('Content-Type', attachment.type);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.send(fileBuffer);

  } catch (error) {
    console.error('첨부파일 다운로드 오류:', error);
    res.status(500).json({ error: '첨부파일 다운로드 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 첨부파일 미리보기 API
router.get('/requests/:id/attachments/:attachmentIndex/preview', authenticateToken, async (req, res) => {
  try {
    const { id, attachmentIndex } = req.params;

    const result = await query(`
      SELECT attachments
      FROM ear_requests
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    const attachments = result.rows[0].attachments;
    if (!attachments || !attachments[attachmentIndex]) {
      return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' });
    }

    const attachment = attachments[attachmentIndex];
    
    // 이미지 파일인 경우에만 미리보기 제공
    if (attachment.type.startsWith('image/')) {
      const fileBuffer = Buffer.from(attachment.data, 'base64');
      res.setHeader('Content-Type', attachment.type);
      res.setHeader('Content-Length', fileBuffer.length);
      res.send(fileBuffer);
    } else {
      res.status(400).json({ error: '이미지 파일만 미리보기가 가능합니다.' });
    }

  } catch (error) {
    console.error('첨부파일 미리보기 오류:', error);
    res.status(500).json({ error: '첨부파일 미리보기 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 상태 변경 API (관리자 전용)
router.patch('/requests/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!status) {
      return res.status(400).json({ error: '상태가 필요합니다.' });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }

    const result = await query(`
      UPDATE ear_requests 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, status, updated_at
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      message: '요청 상태가 성공적으로 변경되었습니다.',
      request: result.rows[0]
    });

  } catch (error) {
    console.error('EAR 요청 상태 변경 오류:', error);
    res.status(500).json({ error: '요청 상태 변경 중 오류가 발생했습니다.' });
  }
});

// EAR 요청 삭제 API (관리자 전용)
router.delete('/requests/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('EAR 요청 삭제 요청:', { id });
    
    // 요청 존재 확인
    const checkResult = await query('SELECT id, request_title FROM ear_requests WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    }
    
    const request = checkResult.rows[0];
    
    // 요청 삭제 (첨부파일도 함께 삭제됨)
    await query('DELETE FROM ear_requests WHERE id = $1', [id]);
    
    console.log('EAR 요청 삭제 완료:', { id: request.id, title: request.request_title });
    
    res.json({ 
      message: '요청이 성공적으로 삭제되었습니다.',
      deletedRequest: { id: request.id, title: request.request_title }
    });
  } catch (error) {
    console.error('요청 삭제 오류:', error);
    res.status(500).json({ error: '요청 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
