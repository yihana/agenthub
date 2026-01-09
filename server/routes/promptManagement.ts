import express from 'express';
import { query, DB_TYPE } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// 프롬프트 목록 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { prompt_type, include_inactive } = req.query;
    
    let queryText;
    let params: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      let whereConditions = ['company_code = $1'];
      params.push(companyCode);
      
      if (prompt_type) {
        whereConditions.push(`prompt_type = $${params.length + 1}`);
        params.push(prompt_type);
      }
      
      if (include_inactive !== 'true') {
        whereConditions.push(`is_active = $${params.length + 1}`);
        params.push(true);
      }
      
      queryText = `
        SELECT id, prompt_type, company_code, reference_content, prompt, 
               is_active, created_by, created_at, updated_at
        FROM prompt_management
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY prompt_type ASC, created_at DESC
      `;
    } else {
      let whereConditions = ['COMPANY_CODE = ?'];
      params.push(companyCode);
      
      if (prompt_type) {
        whereConditions.push('PROMPT_TYPE = ?');
        params.push(prompt_type);
      }
      
      if (include_inactive !== 'true') {
        whereConditions.push('IS_ACTIVE = ?');
        params.push(true);
      }
      
      queryText = `
        SELECT ID as id, PROMPT_TYPE as prompt_type, COMPANY_CODE as company_code,
               REFERENCE_CONTENT as reference_content, PROMPT as prompt,
               IS_ACTIVE as is_active, CREATED_BY as created_by,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.prompt_management
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY PROMPT_TYPE ASC, CREATED_AT DESC
      `;
    }
    
    const result = await query(queryText, params);
    const prompts = (result as any).rows || result;
    
    res.json({ prompts });
  } catch (error) {
    console.error('Prompt management API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 프롬프트 상세 조회
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { id } = req.params;
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, prompt_type, company_code, reference_content, prompt,
               is_active, created_by, created_at, updated_at
        FROM prompt_management
        WHERE id = $1 AND company_code = $2
      `;
    } else {
      queryText = `
        SELECT ID as id, PROMPT_TYPE as prompt_type, COMPANY_CODE as company_code,
               REFERENCE_CONTENT as reference_content, PROMPT as prompt,
               IS_ACTIVE as is_active, CREATED_BY as created_by,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.prompt_management
        WHERE ID = ? AND COMPANY_CODE = ?
      `;
    }
    
    const result = await query(queryText, [id, companyCode]);
    const prompt = ((result as any).rows || result)[0];
    
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json({ prompt });
  } catch (error) {
    console.error('Prompt detail API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 프롬프트 생성
router.post('/', requireAdmin, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { prompt_type, reference_content, prompt, is_active } = req.body;
    const createdBy = user?.userid || user?.email || 'system';
    
    if (!prompt_type || !prompt) {
      return res.status(400).json({ error: 'prompt_type and prompt are required' });
    }
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        INSERT INTO prompt_management 
        (prompt_type, company_code, reference_content, prompt, is_active, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, prompt_type, company_code, reference_content, prompt, is_active, created_by, created_at, updated_at
      `;
    } else {
      queryText = `
        INSERT INTO EAR.prompt_management 
        (PROMPT_TYPE, COMPANY_CODE, REFERENCE_CONTENT, PROMPT, IS_ACTIVE, CREATED_BY, CREATED_AT, UPDATED_AT)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
    
    const params = [
      prompt_type,
      companyCode,
      reference_content || null,
      prompt,
      is_active !== undefined ? is_active : true,
      createdBy
    ];
    
    const result = await query(queryText, params);
    
    if (DB_TYPE === 'postgres') {
      const newPrompt = (result as any).rows[0];
      res.status(201).json({ prompt: newPrompt });
    } else {
      // HANA: INSERT 후 SELECT로 조회
      const selectResult = await query(
        `SELECT TOP 1 ID as id, PROMPT_TYPE as prompt_type, COMPANY_CODE as company_code,
                REFERENCE_CONTENT as reference_content, PROMPT as prompt,
                IS_ACTIVE as is_active, CREATED_BY as created_by,
                CREATED_AT as created_at, UPDATED_AT as updated_at
         FROM EAR.prompt_management
         WHERE COMPANY_CODE = ? AND PROMPT_TYPE = ?
         ORDER BY ID DESC`,
        [companyCode, prompt_type]
      );
      const newPrompt = ((selectResult as any).rows || selectResult)[0];
      res.status(201).json({ prompt: newPrompt });
    }
  } catch (error: any) {
    console.error('Prompt creation API error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// 프롬프트 수정
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { id } = req.params;
    const { prompt_type, reference_content, prompt, is_active } = req.body;
    
    if (!prompt_type || !prompt) {
      return res.status(400).json({ error: 'prompt_type and prompt are required' });
    }
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        UPDATE prompt_management
        SET prompt_type = $1, reference_content = $2, prompt = $3, 
            is_active = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND company_code = $6
        RETURNING id, prompt_type, company_code, reference_content, prompt, is_active, created_by, created_at, updated_at
      `;
    } else {
      queryText = `
        UPDATE EAR.prompt_management
        SET PROMPT_TYPE = ?, REFERENCE_CONTENT = ?, PROMPT = ?,
            IS_ACTIVE = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ? AND COMPANY_CODE = ?
      `;
    }
    
    const params = [
      prompt_type,
      reference_content || null,
      prompt,
      is_active !== undefined ? is_active : true,
      id,
      companyCode
    ];
    
    const result = await query(queryText, params);
    
    if (DB_TYPE === 'postgres') {
      const updatedPrompt = (result as any).rows[0];
      if (!updatedPrompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      res.json({ prompt: updatedPrompt });
    } else {
      // HANA: UPDATE 후 SELECT로 조회
      const selectResult = await query(
        `SELECT ID as id, PROMPT_TYPE as prompt_type, COMPANY_CODE as company_code,
                REFERENCE_CONTENT as reference_content, PROMPT as prompt,
                IS_ACTIVE as is_active, CREATED_BY as created_by,
                CREATED_AT as created_at, UPDATED_AT as updated_at
         FROM EAR.prompt_management
         WHERE ID = ? AND COMPANY_CODE = ?`,
        [id, companyCode]
      );
      const updatedPrompt = ((selectResult as any).rows || selectResult)[0];
      if (!updatedPrompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
      res.json({ prompt: updatedPrompt });
    }
  } catch (error: any) {
    console.error('Prompt update API error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// 프롬프트 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { id } = req.params;
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        DELETE FROM prompt_management
        WHERE id = $1 AND company_code = $2
        RETURNING id
      `;
    } else {
      queryText = `
        DELETE FROM EAR.prompt_management
        WHERE ID = ? AND COMPANY_CODE = ?
      `;
    }
    
    const result = await query(queryText, [id, companyCode]);
    
    if (DB_TYPE === 'postgres') {
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
    } else {
      // HANA: 삭제된 행 수 확인
      if ((result as any).rowsAffected === 0) {
        return res.status(404).json({ error: 'Prompt not found' });
      }
    }
    
    res.json({ message: 'Prompt deleted successfully' });
  } catch (error: any) {
    console.error('Prompt deletion API error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// 활성 프롬프트 조회 (ESM 등에서 사용)
router.get('/active/:prompt_type', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    const { prompt_type } = req.params;
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, prompt_type, company_code, reference_content, prompt, is_active
        FROM prompt_management
        WHERE prompt_type = $1 AND company_code = $2 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      queryText = `
        SELECT TOP 1 ID as id, PROMPT_TYPE as prompt_type, COMPANY_CODE as company_code,
               REFERENCE_CONTENT as reference_content, PROMPT as prompt, IS_ACTIVE as is_active
        FROM EAR.prompt_management
        WHERE PROMPT_TYPE = ? AND COMPANY_CODE = ? AND IS_ACTIVE = true
        ORDER BY CREATED_AT DESC
      `;
    }
    
    const result = await query(queryText, [prompt_type, companyCode]);
    const prompt = ((result as any).rows || result)[0];
    
    if (!prompt) {
      return res.status(404).json({ error: 'Active prompt not found' });
    }
    
    res.json({ prompt });
  } catch (error) {
    console.error('Active prompt API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

