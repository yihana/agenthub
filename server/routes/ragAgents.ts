import express from 'express';
import { query, DB_TYPE } from '../db';
import { requireAdmin, authenticateToken } from '../middleware/auth';

const router = express.Router();

// RAG Agent 목록 조회 (관리자만)
router.get('/', requireAdmin, async (req, res) => {
  try {
    let queryText: string;
    let params: any[] = [];

    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, company_code, agent_description, agent_url, agent_token,
               is_active, created_by, updated_by, created_at, updated_at
        FROM rag_agents_info
        ORDER BY company_code, created_at DESC
      `;
    } else {
      // HANA
      queryText = `
        SELECT ID, COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN,
               IS_ACTIVE, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
        FROM EAR.RAG_AGENTS_INFO
        ORDER BY COMPANY_CODE, CREATED_AT DESC
      `;
    }

    const result = await query(queryText, params);
    
    // 필드명 정규화 (HANA는 대문자, PostgreSQL은 소문자)
    const agents = result.rows.map((row: any) => ({
      id: row.id || row.ID,
      company_code: row.company_code || row.COMPANY_CODE,
      agent_description: row.agent_description || row.AGENT_DESCRIPTION,
      agent_url: row.agent_url || row.AGENT_URL,
      agent_token: row.agent_token || row.AGENT_TOKEN,
      is_active: row.is_active || row.IS_ACTIVE,
      created_by: row.created_by || row.CREATED_BY,
      updated_by: row.updated_by || row.UPDATED_BY,
      created_at: row.created_at || row.CREATED_AT,
      updated_at: row.updated_at || row.UPDATED_AT
    }));

    res.json({ agents });
  } catch (error) {
    console.error('RAG Agent 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// RAG Agent 상세 조회 (관리자만)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let queryText: string;
    let params: any[] = [];

    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, company_code, agent_description, agent_url, agent_token,
               is_active, created_by, updated_by, created_at, updated_at
        FROM rag_agents_info
        WHERE id = $1
      `;
      params = [id];
    } else {
      // HANA
      queryText = `
        SELECT ID, COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN,
               IS_ACTIVE, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
        FROM EAR.RAG_AGENTS_INFO
        WHERE ID = ?
      `;
      params = [id];
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RAG Agent를 찾을 수 없습니다.' });
    }

    const row = result.rows[0];
    const agent = {
      id: row.id || row.ID,
      company_code: row.company_code || row.COMPANY_CODE,
      agent_description: row.agent_description || row.AGENT_DESCRIPTION,
      agent_url: row.agent_url || row.AGENT_URL,
      agent_token: row.agent_token || row.AGENT_TOKEN,
      is_active: row.is_active || row.IS_ACTIVE,
      created_by: row.created_by || row.CREATED_BY,
      updated_by: row.updated_by || row.UPDATED_BY,
      created_at: row.created_at || row.CREATED_AT,
      updated_at: row.updated_at || row.UPDATED_AT
    };

    res.json({ agent });
  } catch (error) {
    console.error('RAG Agent 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// RAG Agent 생성 (관리자만)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { company_code, agent_description, agent_url, agent_token, is_active } = req.body;
    const userId = (req as any).user?.userid || 'system';

    if (!company_code || !agent_url || !agent_token) {
      return res.status(400).json({ error: '회사구분코드, Agent URL, Agent Token은 필수입니다.' });
    }

    // is_active 값 검증
    if (is_active && is_active !== 'Y' && is_active !== 'N') {
      return res.status(400).json({ error: '사용여부는 Y 또는 N만 가능합니다.' });
    }

    // 동일한 회사코드에서 사용여부 Y가 이미 있는지 확인
    let checkQuery: string;
    let checkParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      checkQuery = `
        SELECT COUNT(*) as count
        FROM rag_agents_info
        WHERE company_code = $1 AND is_active = 'Y'
      `;
      checkParams = [company_code];
    } else {
      checkQuery = `
        SELECT COUNT(*) as COUNT
        FROM EAR.RAG_AGENTS_INFO
        WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y'
      `;
      checkParams = [company_code];
    }

    const checkResult = await query(checkQuery, checkParams);
    const activeCount = DB_TYPE === 'postgres' 
      ? parseInt(checkResult.rows[0].count) 
      : parseInt(checkResult.rows[0].COUNT);

    // 새로 추가하려는 항목이 Y이고, 이미 Y가 있으면 에러
    if (is_active === 'Y' && activeCount > 0) {
      return res.status(400).json({ 
        error: '동일한 회사구분코드에 사용여부 Y인 항목이 이미 존재합니다. 먼저 기존 항목의 사용여부를 N으로 변경해주세요.' 
      });
    }

    // 새로 추가하려는 항목이 Y가 아니고, 기존에 Y가 없으면 첫 번째 항목을 Y로 설정
    let finalIsActive = is_active || 'N';
    if (finalIsActive !== 'Y' && activeCount === 0) {
      finalIsActive = 'Y';
    }

    let insertQuery: string;
    let insertParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO rag_agents_info 
        (company_code, agent_description, agent_url, agent_token, is_active, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, company_code, agent_description, agent_url, agent_token,
                  is_active, created_by, updated_by, created_at, updated_at
      `;
      insertParams = [company_code, agent_description || null, agent_url, agent_token, finalIsActive, userId, userId];
    } else {
      insertQuery = `
        INSERT INTO EAR.RAG_AGENTS_INFO 
        (COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN, IS_ACTIVE, CREATED_BY, UPDATED_BY)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      insertParams = [company_code, agent_description || null, agent_url, agent_token, finalIsActive, userId, userId];
    }

    const result = await query(insertQuery, insertParams);

    if (DB_TYPE === 'postgres') {
      res.status(201).json({ agent: result.rows[0] });
    } else {
      // HANA는 ID를 별도로 조회
      const idResult = await query(
        `SELECT ID, COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN,
                IS_ACTIVE, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
         FROM EAR.RAG_AGENTS_INFO
         WHERE COMPANY_CODE = ? AND AGENT_URL = ? AND AGENT_TOKEN = ?
         ORDER BY CREATED_AT DESC
         LIMIT 1`,
        [company_code, agent_url, agent_token]
      );
      const row = idResult.rows[0];
      res.status(201).json({
        agent: {
          id: row.ID,
          company_code: row.COMPANY_CODE,
          agent_description: row.AGENT_DESCRIPTION,
          agent_url: row.AGENT_URL,
          agent_token: row.AGENT_TOKEN,
          is_active: row.IS_ACTIVE,
          created_by: row.CREATED_BY,
          updated_by: row.UPDATED_BY,
          created_at: row.CREATED_AT,
          updated_at: row.UPDATED_AT
        }
      });
    }
  } catch (error: any) {
    console.error('RAG Agent 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// RAG Agent 수정 (관리자만)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_code, agent_description, agent_url, agent_token, is_active } = req.body;
    const userId = (req as any).user?.userid || 'system';

    if (!company_code || !agent_url || !agent_token) {
      return res.status(400).json({ error: '회사구분코드, Agent URL, Agent Token은 필수입니다.' });
    }

    // is_active 값 검증
    if (is_active && is_active !== 'Y' && is_active !== 'N') {
      return res.status(400).json({ error: '사용여부는 Y 또는 N만 가능합니다.' });
    }

    // 기존 항목 조회
    let getQuery: string;
    let getParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      getQuery = `SELECT id, company_code, is_active FROM rag_agents_info WHERE id = $1`;
      getParams = [id];
    } else {
      getQuery = `SELECT ID, COMPANY_CODE, IS_ACTIVE FROM EAR.RAG_AGENTS_INFO WHERE ID = ?`;
      getParams = [id];
    }

    const existingResult = await query(getQuery, getParams);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'RAG Agent를 찾을 수 없습니다.' });
    }

    const existing = existingResult.rows[0];
    const existingCompanyCode = existing.company_code || existing.COMPANY_CODE;
    const existingIsActive = existing.is_active || existing.IS_ACTIVE;

    // 사용여부를 Y로 변경하려는 경우, 동일한 회사코드에 다른 Y가 있는지 확인
    if (is_active === 'Y' && existingIsActive !== 'Y') {
      let checkQuery: string;
      let checkParams: any[] = [];

      if (DB_TYPE === 'postgres') {
        checkQuery = `
          SELECT COUNT(*) as count
          FROM rag_agents_info
          WHERE company_code = $1 AND is_active = 'Y' AND id != $2
        `;
        checkParams = [company_code, id];
      } else {
        checkQuery = `
          SELECT COUNT(*) as COUNT
          FROM EAR.RAG_AGENTS_INFO
          WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y' AND ID != ?
        `;
        checkParams = [company_code, id];
      }

      const checkResult = await query(checkQuery, checkParams);
      const activeCount = DB_TYPE === 'postgres' 
        ? parseInt(checkResult.rows[0].count) 
        : parseInt(checkResult.rows[0].COUNT);

      if (activeCount > 0) {
        return res.status(400).json({ 
          error: '동일한 회사구분코드에 사용여부 Y인 항목이 이미 존재합니다. 먼저 기존 항목의 사용여부를 N으로 변경해주세요.' 
        });
      }
    }

    // 사용여부를 N으로 변경하려는 경우, 마지막 남은 Y인지 확인
    if (is_active === 'N' && existingIsActive === 'Y') {
      let checkQuery: string;
      let checkParams: any[] = [];

      if (DB_TYPE === 'postgres') {
        checkQuery = `
          SELECT COUNT(*) as count
          FROM rag_agents_info
          WHERE company_code = $1 AND is_active = 'Y'
        `;
        checkParams = [company_code];
      } else {
        checkQuery = `
          SELECT COUNT(*) as COUNT
          FROM EAR.RAG_AGENTS_INFO
          WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y'
        `;
        checkParams = [company_code];
      }

      const checkResult = await query(checkQuery, checkParams);
      const activeCount = DB_TYPE === 'postgres' 
        ? parseInt(checkResult.rows[0].count) 
        : parseInt(checkResult.rows[0].COUNT);

      if (activeCount === 1) {
        return res.status(400).json({ 
          error: '마지막 남은 사용여부 Y인 항목은 N으로 변경할 수 없습니다. 최소한 하나의 항목은 Y여야 합니다.' 
        });
      }
    }

    // 업데이트 실행
    let updateQuery: string;
    let updateParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE rag_agents_info
        SET company_code = $1, agent_description = $2, agent_url = $3, 
            agent_token = $4, is_active = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, company_code, agent_description, agent_url, agent_token,
                  is_active, created_by, updated_by, created_at, updated_at
      `;
      updateParams = [company_code, agent_description || null, agent_url, agent_token, is_active, userId, id];
    } else {
      updateQuery = `
        UPDATE EAR.RAG_AGENTS_INFO
        SET COMPANY_CODE = ?, AGENT_DESCRIPTION = ?, AGENT_URL = ?, 
            AGENT_TOKEN = ?, IS_ACTIVE = ?, UPDATED_BY = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;
      updateParams = [company_code, agent_description || null, agent_url, agent_token, is_active, userId, id];
    }

    await query(updateQuery, updateParams);

    // 업데이트된 항목 조회
    if (DB_TYPE === 'postgres') {
      const result = await query(
        `SELECT id, company_code, agent_description, agent_url, agent_token,
                is_active, created_by, updated_by, created_at, updated_at
         FROM rag_agents_info WHERE id = $1`,
        [id]
      );
      res.json({ agent: result.rows[0] });
    } else {
      const result = await query(
        `SELECT ID, COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN,
                IS_ACTIVE, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
         FROM EAR.RAG_AGENTS_INFO WHERE ID = ?`,
        [id]
      );
      const row = result.rows[0];
      res.json({
        agent: {
          id: row.ID,
          company_code: row.COMPANY_CODE,
          agent_description: row.AGENT_DESCRIPTION,
          agent_url: row.AGENT_URL,
          agent_token: row.AGENT_TOKEN,
          is_active: row.IS_ACTIVE,
          created_by: row.CREATED_BY,
          updated_by: row.UPDATED_BY,
          created_at: row.CREATED_AT,
          updated_at: row.UPDATED_AT
        }
      });
    }
  } catch (error: any) {
    console.error('RAG Agent 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// RAG Agent 삭제 (관리자만)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 기존 항목 조회
    let getQuery: string;
    let getParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      getQuery = `SELECT id, company_code, is_active FROM rag_agents_info WHERE id = $1`;
      getParams = [id];
    } else {
      getQuery = `SELECT ID, COMPANY_CODE, IS_ACTIVE FROM EAR.RAG_AGENTS_INFO WHERE ID = ?`;
      getParams = [id];
    }

    const existingResult = await query(getQuery, getParams);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'RAG Agent를 찾을 수 없습니다.' });
    }

    const existing = existingResult.rows[0];
    const companyCode = existing.company_code || existing.COMPANY_CODE;
    const isActive = existing.is_active || existing.IS_ACTIVE;

    // 삭제하려는 항목이 Y이고, 마지막 남은 Y인지 확인
    if (isActive === 'Y') {
      let checkQuery: string;
      let checkParams: any[] = [];

      if (DB_TYPE === 'postgres') {
        checkQuery = `
          SELECT COUNT(*) as count
          FROM rag_agents_info
          WHERE company_code = $1 AND is_active = 'Y'
        `;
        checkParams = [companyCode];
      } else {
        checkQuery = `
          SELECT COUNT(*) as COUNT
          FROM EAR.RAG_AGENTS_INFO
          WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y'
        `;
        checkParams = [companyCode];
      }

      const checkResult = await query(checkQuery, checkParams);
      const activeCount = DB_TYPE === 'postgres' 
        ? parseInt(checkResult.rows[0].count) 
        : parseInt(checkResult.rows[0].COUNT);

      if (activeCount === 1) {
        return res.status(400).json({ 
          error: '마지막 남은 사용여부 Y인 항목은 삭제할 수 없습니다. 최소한 하나의 항목은 Y여야 합니다.' 
        });
      }
    }

    // 삭제 실행
    let deleteQuery: string;
    let deleteParams: any[] = [];

    if (DB_TYPE === 'postgres') {
      deleteQuery = `DELETE FROM rag_agents_info WHERE id = $1`;
      deleteParams = [id];
    } else {
      deleteQuery = `DELETE FROM EAR.RAG_AGENTS_INFO WHERE ID = ?`;
      deleteParams = [id];
    }

    await query(deleteQuery, deleteParams);

    res.json({ message: 'RAG Agent가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('RAG Agent 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회사코드별 활성 RAG Agent 조회 (인증 필요, 채팅에서 사용)
router.get('/active/:companyCode', authenticateToken, async (req, res) => {
  try {
    const { companyCode } = req.params;
    let queryText: string;
    let params: any[] = [];

    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, company_code, agent_description, agent_url, agent_token,
               is_active, created_by, updated_by, created_at, updated_at
        FROM rag_agents_info
        WHERE company_code = $1 AND is_active = 'Y'
        LIMIT 1
      `;
      params = [companyCode];
    } else {
      queryText = `
        SELECT ID, COMPANY_CODE, AGENT_DESCRIPTION, AGENT_URL, AGENT_TOKEN,
               IS_ACTIVE, CREATED_BY, UPDATED_BY, CREATED_AT, UPDATED_AT
        FROM EAR.RAG_AGENTS_INFO
        WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y'
        LIMIT 1
      `;
      params = [companyCode];
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '활성화된 RAG Agent를 찾을 수 없습니다.' });
    }

    const row = result.rows[0];
    const agent = {
      id: row.id || row.ID,
      company_code: row.company_code || row.COMPANY_CODE,
      agent_description: row.agent_description || row.AGENT_DESCRIPTION,
      agent_url: row.agent_url || row.AGENT_URL,
      agent_token: row.agent_token || row.AGENT_TOKEN,
      is_active: row.is_active || row.IS_ACTIVE
    };

    res.json({ agent });
  } catch (error) {
    console.error('활성 RAG Agent 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

