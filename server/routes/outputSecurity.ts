import express from 'express';
import { query, DB_TYPE } from '../db';
import { requireAdmin, authenticateToken } from '../middleware/auth';

const router = express.Router();

// 출력보안 설정 조회 (관리자만)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, setting_type, setting_key, setting_name, is_enabled, created_at, updated_at
        FROM output_security_settings
        WHERE setting_type = 'output_security'
        LIMIT 1
      `;
    } else {
      queryText = `
        SELECT ID as id, SETTING_TYPE as setting_type, SETTING_KEY as setting_key,
               SETTING_NAME as setting_name, IS_ENABLED as is_enabled,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.output_security_settings
        WHERE SETTING_TYPE = 'output_security'
        LIMIT 1
      `;
    }
    
    const result = await query(queryText);
    const settings = (result as any).rows || result;
    
    res.json({ setting: settings[0] || null });
  } catch (error) {
    console.error('Output security settings API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 출력보안 설정 업데이트 (관리자만)
router.put('/settings/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_enabled, setting_name } = req.body;
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE output_security_settings
        SET is_enabled = $1, setting_name = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, setting_type, setting_key, setting_name, is_enabled
      `;
    } else {
      updateQuery = `
        UPDATE EAR.output_security_settings
        SET IS_ENABLED = ?, SETTING_NAME = ?, UPDATED_AT = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(updateQuery, [is_enabled, setting_name, id]);
      res.json({ success: true, setting: (result as any).rows[0] });
    } else {
      await query(updateQuery, [is_enabled, setting_name, id]);
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Update output security settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 출력보안 패턴 목록 조회 (관리자만)
router.get('/patterns', requireAdmin, async (req, res) => {
  try {
    let queryText;
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, pattern, description, is_active, created_by, created_at, updated_at
        FROM output_security_patterns
        ORDER BY created_at DESC
      `;
    } else {
      queryText = `
        SELECT ID as id, PATTERN as pattern, DESCRIPTION as description,
               IS_ACTIVE as is_active, CREATED_BY as created_by,
               CREATED_AT as created_at, UPDATED_AT as updated_at
        FROM EAR.output_security_patterns
        ORDER BY CREATED_AT DESC
      `;
    }
    
    const result = await query(queryText);
    const patterns = (result as any).rows || result;
    
    res.json({ patterns });
  } catch (error) {
    console.error('Output security patterns API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 출력보안 패턴 추가 (관리자만)
router.post('/patterns', requireAdmin, async (req, res) => {
  try {
    const { pattern, description } = req.body;
    const userId = (req as any).user?.userid || 'admin';
    
    if (!pattern) {
      return res.status(400).json({ error: 'pattern is required' });
    }
    
    let insertQuery;
    if (DB_TYPE === 'postgres') {
      insertQuery = `
        INSERT INTO output_security_patterns (pattern, description, is_active, created_by)
        VALUES ($1, $2, true, $3)
        RETURNING id, pattern, description, is_active, created_by, created_at
      `;
    } else {
      insertQuery = `
        INSERT INTO EAR.output_security_patterns (PATTERN, DESCRIPTION, IS_ACTIVE, CREATED_BY)
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
    console.error('Add output security pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 출력보안 패턴 업데이트 (관리자만)
router.put('/patterns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { pattern, description, is_active } = req.body;
    
    let updateQuery;
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE output_security_patterns
        SET pattern = $1, description = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, pattern, description, is_active
      `;
    } else {
      updateQuery = `
        UPDATE EAR.output_security_patterns
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
    console.error('Update output security pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 출력보안 패턴 삭제 (관리자만)
router.delete('/patterns/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    let deleteQuery;
    if (DB_TYPE === 'postgres') {
      deleteQuery = 'DELETE FROM output_security_patterns WHERE id = $1';
    } else {
      deleteQuery = 'DELETE FROM EAR.output_security_patterns WHERE ID = ?';
    }
    
    await query(deleteQuery, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete output security pattern error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

