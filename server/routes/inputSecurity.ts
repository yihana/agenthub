import express from 'express';
import { query, DB_TYPE } from '../db';
import { requireAdmin, authenticateToken } from '../middleware/auth';
import { validateInput } from '../utils/inputValidation';

const router = express.Router();

// 입력 검증 API (채팅 입력 시 사용)
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const validation = await validateInput(message);
    
    if (validation.blocked) {
      return res.status(400).json({
        success: false,
        blocked: true,
        violations: validation.violations
      });
    }
    
    res.json({
      success: true,
      blocked: false
    });
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 입력보안 설정 목록 조회 (관리자만)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, setting_type, setting_key, setting_name, is_enabled, pattern, created_at, updated_at
        FROM input_security_settings
        ORDER BY setting_type, setting_key
      `;
    } else {
      queryText = `
        SELECT ID as id, SETTING_TYPE as setting_type, SETTING_KEY as setting_key,
               SETTING_NAME as setting_name, IS_ENABLED as is_enabled, PATTERN as pattern,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.input_security_settings
        ORDER BY SETTING_TYPE, SETTING_KEY
      `;
    }
    
    const result = await query(queryText);
    const settings = (result as any).rows || result;
    
    res.json({ settings });
  } catch (error) {
    console.error('Settings API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 입력보안 설정 업데이트 (관리자만)
router.put('/settings/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_enabled, setting_name, pattern } = req.body;
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE input_security_settings
        SET is_enabled = $1, setting_name = $2, pattern = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, setting_type, setting_key, setting_name, is_enabled, pattern
      `;
    } else {
      updateQuery = `
        UPDATE EAR.input_security_settings
        SET IS_ENABLED = ?, SETTING_NAME = ?, PATTERN = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      await query(updateQuery, [is_enabled, setting_name, pattern, id]);
    } else {
      await query(updateQuery, [is_enabled, setting_name, pattern, id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 개인정보 차단 설정 추가 (관리자만)
router.post('/settings/personal-info', requireAdmin, async (req, res) => {
  try {
    const { setting_key, setting_name, pattern } = req.body;
    const userId = (req as any).user?.userid || 'admin';
    
    if (!setting_key || !setting_name || !pattern) {
      return res.status(400).json({ error: 'setting_key, setting_name, pattern are required' });
    }
    
    let insertQuery;
    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO input_security_settings (setting_type, setting_key, setting_name, is_enabled, pattern)
        VALUES ('personal_info', $1, $2, true, $3)
        ON CONFLICT (setting_type, setting_key)
        DO UPDATE SET setting_name = EXCLUDED.setting_name, pattern = EXCLUDED.pattern
        RETURNING id, setting_type, setting_key, setting_name, is_enabled, pattern
      `;
    } else {
      insertQuery = `
        MERGE INTO EAR.input_security_settings AS target
        USING (
          SELECT 'personal_info' AS SETTING_TYPE, ? AS SETTING_KEY, ? AS SETTING_NAME, true AS IS_ENABLED, ? AS PATTERN
          FROM DUMMY
        ) AS source
        ON target.SETTING_TYPE = source.SETTING_TYPE AND target.SETTING_KEY = source.SETTING_KEY
        WHEN MATCHED THEN
          UPDATE SET SETTING_NAME = source.SETTING_NAME, PATTERN = source.PATTERN
        WHEN NOT MATCHED THEN
          INSERT (SETTING_TYPE, SETTING_KEY, SETTING_NAME, IS_ENABLED, PATTERN)
          VALUES (source.SETTING_TYPE, source.SETTING_KEY, source.SETTING_NAME, source.IS_ENABLED, source.PATTERN)
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      await query(insertQuery, [setting_key, setting_name, pattern]);
    } else {
      await query(insertQuery, [setting_key, setting_name, pattern]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add personal info setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 개인정보 차단 설정 수정 (관리자만)
router.put('/settings/personal-info/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { setting_name, pattern } = req.body;
    
    if (!setting_name || !pattern) {
      return res.status(400).json({ error: 'setting_name and pattern are required' });
    }
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE input_security_settings
        SET setting_name = $1, pattern = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND setting_type = 'personal_info'
        RETURNING id, setting_type, setting_key, setting_name, is_enabled, pattern
      `;
    } else {
      updateQuery = `
        UPDATE EAR.input_security_settings
        SET SETTING_NAME = ?, PATTERN = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ? AND SETTING_TYPE = 'personal_info'
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(updateQuery, [setting_name, pattern, id]);
      res.json({ success: true, setting: (result as any).rows[0] });
    } else {
      await query(updateQuery, [setting_name, pattern, id]);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Update personal info setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 개인정보 차단 설정 삭제 (관리자만)
router.delete('/settings/personal-info/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 주민등록번호(ssn)는 기본 설정이므로 삭제 방지
    let checkQuery;
    if (DB_TYPE === 'postgres') {
      checkQuery = 'SELECT setting_key FROM input_security_settings WHERE id = $1';
    } else {
      checkQuery = 'SELECT SETTING_KEY as setting_key FROM EAR.input_security_settings WHERE ID = ?';
    }
    
    const checkResult = await query(checkQuery, [id]);
    const setting = (checkResult as any).rows?.[0] || checkResult?.[0];
    
    if (setting && setting.setting_key === 'ssn') {
      return res.status(400).json({ error: '주민등록번호 설정은 삭제할 수 없습니다.' });
    }
    
    let deleteQuery;
    if (DB_TYPE === 'postgres') {
      deleteQuery = 'DELETE FROM input_security_settings WHERE id = $1 AND setting_type = \'personal_info\'';
    } else {
      deleteQuery = 'DELETE FROM EAR.input_security_settings WHERE ID = ? AND SETTING_TYPE = \'personal_info\'';
    }
    
    await query(deleteQuery, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete personal info setting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 욕설 패턴 목록 조회 (관리자만)
router.get('/profanity-patterns', requireAdmin, async (req, res) => {
  try {
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, pattern, description, is_active, created_by, created_at, updated_at
        FROM profanity_patterns
        ORDER BY created_at DESC
      `;
    } else {
      queryText = `
        SELECT ID as id, PATTERN as pattern, DESCRIPTION as description,
               IS_ACTIVE as is_active, CREATED_BY as created_by,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.profanity_patterns
        ORDER BY CREATED_AT DESC
      `;
    }
    
    const result = await query(queryText);
    const patterns = (result as any).rows || result;
    
    res.json({ patterns });
  } catch (error) {
    console.error('Profanity patterns API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 욕설 패턴 추가 (관리자만)
router.post('/profanity-patterns', requireAdmin, async (req, res) => {
  try {
    const { pattern, description } = req.body;
    const userId = (req as any).user?.userid || 'admin';
    
    if (!pattern) {
      return res.status(400).json({ error: 'pattern is required' });
    }
    
    let insertQuery;
    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO profanity_patterns (pattern, description, is_active, created_by)
        VALUES ($1, $2, true, $3)
        RETURNING id, pattern, description, is_active, created_by, created_at
      `;
    } else {
      insertQuery = `
        INSERT INTO EAR.profanity_patterns (PATTERN, DESCRIPTION, IS_ACTIVE, CREATED_BY)
        VALUES (?, ?, true, ?)
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(insertQuery, [pattern, description || null, userId]);
      res.json({ success: true, pattern: (result as any).rows[0] });
    } else {
      await query(insertQuery, [pattern, description || null, userId]);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Add profanity pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 욕설 패턴 업데이트 (관리자만)
router.put('/profanity-patterns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { pattern, description, is_active } = req.body;
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE profanity_patterns
        SET pattern = $1, description = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, pattern, description, is_active
      `;
    } else {
      updateQuery = `
        UPDATE EAR.profanity_patterns
        SET PATTERN = ?, DESCRIPTION = ?, IS_ACTIVE = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(updateQuery, [pattern, description || null, is_active, id]);
      res.json({ success: true, pattern: (result as any).rows[0] });
    } else {
      await query(updateQuery, [pattern, description || null, is_active, id]);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Update profanity pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 욕설 패턴 삭제 (관리자만)
router.delete('/profanity-patterns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    let deleteQuery;
    if (DB_TYPE === 'postgres') {
      deleteQuery = 'DELETE FROM profanity_patterns WHERE id = $1';
    } else {
      deleteQuery = 'DELETE FROM EAR.profanity_patterns WHERE ID = ?';
    }
    
    await query(deleteQuery, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete profanity pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

