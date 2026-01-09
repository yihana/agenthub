import express from 'express';
import { query, DB_TYPE } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 의도 패턴 목록 조회
router.get('/patterns', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, pattern_type, pattern_value, response_message, intent_category, 
               is_active, priority, display_type, company_code, created_at, updated_at
        FROM chat_intent_patterns
        WHERE company_code = $1
        ORDER BY priority DESC, id ASC
      `;
    } else {
      queryText = `
        SELECT ID as id, PATTERN_TYPE as pattern_type, PATTERN_VALUE as pattern_value,
               RESPONSE_MESSAGE as response_message, INTENT_CATEGORY as intent_category,
               IS_ACTIVE as is_active, PRIORITY as priority, DISPLAY_TYPE as display_type,
               COMPANY_CODE as company_code, CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.chat_intent_patterns
        WHERE COMPANY_CODE = ?
        ORDER BY PRIORITY DESC, ID ASC
      `;
    }
    
    const result = await query(queryText, [companyCode]);
    const patterns = (result as any).rows || result;
    
    res.json({ patterns });
  } catch (error) {
    console.error('Intent patterns API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 의도 패턴 상세 조회 (선택지 포함)
router.get('/patterns/:id', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    
    const { id } = req.params;
    
    let patternQuery;
    if (DB_TYPE === 'postgres') {
      patternQuery = `
        SELECT id, pattern_type, pattern_value, response_message, intent_category,
               is_active, priority, display_type, company_code, created_at, updated_at
        FROM chat_intent_patterns
        WHERE id = $1 AND company_code = $2
      `;
    } else {
      patternQuery = `
        SELECT ID as id, PATTERN_TYPE as pattern_type, PATTERN_VALUE as pattern_value,
               RESPONSE_MESSAGE as response_message, INTENT_CATEGORY as intent_category,
               IS_ACTIVE as is_active, PRIORITY as priority, DISPLAY_TYPE as display_type,
               COMPANY_CODE as company_code, CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.chat_intent_patterns
        WHERE ID = ? AND COMPANY_CODE = ?
      `;
    }
    
    const patternResult = await query(patternQuery, [id, companyCode]);
    const pattern = ((patternResult as any).rows || patternResult)[0];
    
    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }
    
    // 선택지 조회
    let optionsQuery;
    if (DB_TYPE === 'postgres') {
      optionsQuery = `
        SELECT id, option_title, option_description, action_type, action_data, icon_name, display_order
        FROM chat_intent_options
        WHERE intent_pattern_id = $1
        ORDER BY display_order ASC, id ASC
      `;
    } else {
      optionsQuery = `
        SELECT ID as id, OPTION_TITLE as option_title, OPTION_DESCRIPTION as option_description,
               ACTION_TYPE as action_type, ACTION_DATA as action_data, ICON_NAME as icon_name, DISPLAY_ORDER as display_order
        FROM EAR.chat_intent_options
        WHERE INTENT_PATTERN_ID = ?
        ORDER BY DISPLAY_ORDER ASC, ID ASC
      `;
    }
    
    const optionsResult = await query(optionsQuery, [id]);
    const options = (optionsResult as any).rows || optionsResult;
    
    res.json({
      pattern: {
        ...pattern,
        options: options.map((opt: any) => ({
          ...opt,
          actionData: typeof opt.action_data === 'string' ? JSON.parse(opt.action_data) : opt.action_data
        }))
      }
    });
  } catch (error) {
    console.error('Intent pattern detail API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 의도 패턴 생성
router.post('/patterns', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    
    const { pattern_type, pattern_value, response_message, intent_category, is_active, priority, display_type, company_code } = req.body;
    
    if (!pattern_type || !pattern_value || !response_message) {
      return res.status(400).json({ error: 'pattern_type, pattern_value, and response_message are required' });
    }
    
    // 고객사 구분코드 검증 (SKN, SKT, SKI, SKAX만 허용)
    const validCompanyCodes = ['SKN', 'SKT', 'SKI', 'SKAX'];
    const companyCode = company_code && validCompanyCodes.includes(company_code) ? company_code : (user?.companyCode || 'SKN');
    
    let insertQuery;
    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO chat_intent_patterns (pattern_type, pattern_value, response_message, intent_category, is_active, priority, display_type, company_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, pattern_type, pattern_value, response_message, intent_category, is_active, priority, display_type, company_code, created_at, updated_at
      `;
    } else {
      insertQuery = `
        INSERT INTO EAR.chat_intent_patterns (PATTERN_TYPE, PATTERN_VALUE, RESPONSE_MESSAGE, INTENT_CATEGORY, IS_ACTIVE, PRIORITY, DISPLAY_TYPE, COMPANY_CODE)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
    }
    
    const params = [
      pattern_type,
      pattern_value,
      response_message,
      intent_category || null,
      is_active !== undefined ? is_active : true,
      priority || 0,
      display_type || 'inline',
      companyCode
    ];
    
    if (DB_TYPE === 'postgres') {
      const result = await query(insertQuery, params);
      res.json({ pattern: (result as any).rows[0] });
    } else {
      await query(insertQuery, params);
      // HANA: 최근 생성된 레코드 조회
      const selectResult = await query(`
        SELECT TOP 1 ID as id, PATTERN_TYPE as pattern_type, PATTERN_VALUE as pattern_value,
               RESPONSE_MESSAGE as response_message, INTENT_CATEGORY as intent_category,
               IS_ACTIVE as is_active, PRIORITY as priority, DISPLAY_TYPE as display_type,
               COMPANY_CODE as company_code, CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.chat_intent_patterns
        ORDER BY ID DESC
      `);
      res.json({ pattern: ((selectResult as any).rows || selectResult)[0] });
    }
  } catch (error) {
    console.error('Create intent pattern API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 의도 패턴 수정
router.put('/patterns/:id', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    
    const { id } = req.params;
    const { pattern_type, pattern_value, response_message, intent_category, is_active, priority, display_type, company_code } = req.body;
    
    // 고객사 구분코드 검증 (SKN, SKT, SKI, SKAX만 허용)
    const validCompanyCodes = ['SKN', 'SKT', 'SKI', 'SKAX'];
    const companyCode = company_code && validCompanyCodes.includes(company_code) ? company_code : (user?.companyCode || 'SKN');
    
    // 기존 패턴의 company_code 확인 (수정 권한 체크)
    let existingPatternQuery;
    if (DB_TYPE === 'postgres') {
      existingPatternQuery = 'SELECT company_code FROM chat_intent_patterns WHERE id = $1';
    } else {
      existingPatternQuery = 'SELECT COMPANY_CODE as company_code FROM EAR.chat_intent_patterns WHERE ID = ?';
    }
    const existingPattern = await query(existingPatternQuery, [id]);
    const existingCompanyCode = ((existingPattern as any).rows || existingPattern)[0]?.company_code;
    
    // 기존 패턴의 company_code와 사용자의 company_code가 일치하는지 확인
    if (existingCompanyCode && existingCompanyCode !== user?.companyCode) {
      return res.status(403).json({ error: '다른 고객사의 패턴을 수정할 수 없습니다.' });
    }
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE chat_intent_patterns
        SET pattern_type = $1, pattern_value = $2, response_message = $3, 
            intent_category = $4, is_active = $5, priority = $6, display_type = $7, company_code = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND company_code = $10
        RETURNING id, pattern_type, pattern_value, response_message, intent_category, is_active, priority, display_type, company_code, created_at, updated_at
      `;
    } else {
      updateQuery = `
        UPDATE EAR.chat_intent_patterns
        SET PATTERN_TYPE = ?, PATTERN_VALUE = ?, RESPONSE_MESSAGE = ?,
            INTENT_CATEGORY = ?, IS_ACTIVE = ?, PRIORITY = ?, DISPLAY_TYPE = ?, COMPANY_CODE = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ? AND COMPANY_CODE = ?
      `;
    }
    
    const params = [
      pattern_type,
      pattern_value,
      response_message,
      intent_category || null,
      is_active !== undefined ? is_active : true,
      priority || 0,
      display_type || 'inline',
      companyCode,
      id,
      existingCompanyCode || companyCode
    ];
    
    if (DB_TYPE === 'postgres') {
      const result = await query(updateQuery, params);
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: 'Pattern not found' });
      }
      res.json({ pattern: (result as any).rows[0] });
    } else {
      await query(updateQuery, params);
      const selectResult = await query(`
        SELECT ID as id, PATTERN_TYPE as pattern_type, PATTERN_VALUE as pattern_value,
               RESPONSE_MESSAGE as response_message, INTENT_CATEGORY as intent_category,
               IS_ACTIVE as is_active, PRIORITY as priority, DISPLAY_TYPE as display_type,
               COMPANY_CODE as company_code, CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.chat_intent_patterns
        WHERE ID = ? AND COMPANY_CODE = ?
      `, [id, companyCode]);
      const pattern = ((selectResult as any).rows || selectResult)[0];
      if (!pattern) {
        return res.status(404).json({ error: 'Pattern not found' });
      }
      res.json({ pattern });
    }
  } catch (error) {
    console.error('Update intent pattern API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 의도 패턴 삭제
router.delete('/patterns/:id', authenticateToken, async (req, res) => {
  try {
    const authReq = req as any;
    const user = authReq.user;
    const companyCode = user?.companyCode || 'SKN';
    
    const { id } = req.params;
    
    let deleteQuery;
    if (DB_TYPE === 'postgres') {
      deleteQuery = 'DELETE FROM chat_intent_patterns WHERE id = $1 AND company_code = $2';
    } else {
      deleteQuery = 'DELETE FROM EAR.chat_intent_patterns WHERE ID = ? AND COMPANY_CODE = ?';
    }
    
    await query(deleteQuery, [id, companyCode]);
    res.json({ message: 'Pattern deleted successfully' });
  } catch (error) {
    console.error('Delete intent pattern API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 선택지 생성
router.post('/options', authenticateToken, async (req, res) => {
  try {
    const { intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order } = req.body;
    
    if (!intent_pattern_id || !option_title || !action_type) {
      return res.status(400).json({ error: 'intent_pattern_id, option_title, and action_type are required' });
    }
    
    let insertQuery;
    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO chat_intent_options (intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order, created_at
      `;
    } else {
      insertQuery = `
        INSERT INTO EAR.chat_intent_options (INTENT_PATTERN_ID, OPTION_TITLE, OPTION_DESCRIPTION, ACTION_TYPE, ACTION_DATA, ICON_NAME, DISPLAY_ORDER)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
    }
    
    const actionDataJson = typeof action_data === 'object' ? JSON.stringify(action_data) : action_data;
    const params = [
      intent_pattern_id,
      option_title,
      option_description || null,
      action_type,
      actionDataJson,
      icon_name || null,
      display_order || 0
    ];
    
    if (DB_TYPE === 'postgres') {
      const result = await query(insertQuery, params);
      res.json({ option: (result as any).rows[0] });
    } else {
      await query(insertQuery, params);
      const selectResult = await query(`
        SELECT TOP 1 ID as id, INTENT_PATTERN_ID as intent_pattern_id, OPTION_TITLE as option_title,
               OPTION_DESCRIPTION as option_description, ACTION_TYPE as action_type, ACTION_DATA as action_data,
               ICON_NAME as icon_name, DISPLAY_ORDER as display_order, CREATED_AT as created_at
        FROM EAR.chat_intent_options
        ORDER BY ID DESC
      `);
      res.json({ option: ((selectResult as any).rows || selectResult)[0] });
    }
  } catch (error) {
    console.error('Create intent option API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 선택지 수정
router.put('/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { option_title, option_description, action_type, action_data, icon_name, display_order } = req.body;
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE chat_intent_options
        SET option_title = $1, option_description = $2, action_type = $3, action_data = $4, icon_name = $5, display_order = $6
        WHERE id = $7
        RETURNING id, intent_pattern_id, option_title, option_description, action_type, action_data, icon_name, display_order, created_at
      `;
    } else {
      updateQuery = `
        UPDATE EAR.chat_intent_options
        SET OPTION_TITLE = ?, OPTION_DESCRIPTION = ?, ACTION_TYPE = ?, ACTION_DATA = ?, ICON_NAME = ?, DISPLAY_ORDER = ?
        WHERE ID = ?
      `;
    }
    
    const actionDataJson = typeof action_data === 'object' ? JSON.stringify(action_data) : action_data;
    const params = [
      option_title,
      option_description || null,
      action_type,
      actionDataJson,
      icon_name || null,
      display_order || 0,
      id
    ];
    
    if (DB_TYPE === 'postgres') {
      const result = await query(updateQuery, params);
      if ((result as any).rows.length === 0) {
        return res.status(404).json({ error: 'Option not found' });
      }
      res.json({ option: (result as any).rows[0] });
    } else {
      await query(updateQuery, params);
      const selectResult = await query(`
        SELECT ID as id, INTENT_PATTERN_ID as intent_pattern_id, OPTION_TITLE as option_title,
               OPTION_DESCRIPTION as option_description, ACTION_TYPE as action_type, ACTION_DATA as action_data,
               ICON_NAME as icon_name, DISPLAY_ORDER as display_order, CREATED_AT as created_at
        FROM EAR.chat_intent_options
        WHERE ID = ?
      `, [id]);
      const option = ((selectResult as any).rows || selectResult)[0];
      if (!option) {
        return res.status(404).json({ error: 'Option not found' });
      }
      res.json({ option });
    }
  } catch (error) {
    console.error('Update intent option API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 선택지 삭제
router.delete('/options/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let deleteQuery;
    if (DB_TYPE === 'postgres') {
      deleteQuery = 'DELETE FROM chat_intent_options WHERE id = $1';
    } else {
      deleteQuery = 'DELETE FROM EAR.chat_intent_options WHERE ID = ?';
    }
    
    await query(deleteQuery, [id]);
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    console.error('Delete intent option API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

