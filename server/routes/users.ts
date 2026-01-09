import express from 'express';
const bcrypt = require('bcrypt');
import { db, DB_TYPE } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// 관리자 권한 확인 미들웨어는 공통 미들웨어 사용

// 사용자 목록 조회 (관리자만)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT id, userid, email, full_name, department, position, 
             phone, employee_id, is_active, is_admin, 
             failed_login_attempts, last_login, created_at, updated_at
      FROM users
    `;
    let params: any[] = [];
    let paramCount = 0;

    if (search) {
      query += ` WHERE (userid ILIKE $${++paramCount} OR full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(Number(limit), offset);

    const result = await db.query(query, params);

    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM users';
    let countParams: any[] = [];
    
    if (search) {
      countQuery += ` WHERE (userid ILIKE $1 OR full_name ILIKE $1 OR email ILIKE $1)`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 상세 조회 (관리자만)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, userid, email, full_name, department, position, 
              phone, employee_id, is_active, is_admin, 
              failed_login_attempts, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('사용자 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 생성 (관리자만)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { 
      userid, 
      password, 
      email, 
      fullName, 
      department, 
      position, 
      phone, 
      employeeId, 
      isActive = true, 
      isAdmin = false 
    } = req.body;

    if (!userid || !password) {
      return res.status(400).json({ error: '사용자ID와 비밀번호는 필수입니다.' });
    }

    // 사용자ID 중복 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE userid = $1',
      [userid]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '이미 존재하는 사용자ID입니다.' });
    }

    // 비밀번호 해시화
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 사용자 생성
    if (DB_TYPE === 'postgres') {
      // PostgreSQL - RETURNING 지원
      const result = await db.query(
        `INSERT INTO users (userid, password_hash, email, full_name, department, position, 
                           phone, employee_id, is_active, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, userid, email, full_name, department, position, 
                   phone, employee_id, is_active, is_admin, created_at`,
        [userid, passwordHash, email, fullName, department, position, 
         phone, employeeId, isActive, isAdmin]
      );

      res.status(201).json({ 
        success: true, 
        user: result.rows[0],
        message: '사용자가 생성되었습니다.' 
      });
    } else {
      // HANA - RETURNING 지원 안함, 별도 SELECT 필요
      await db.query(
        `INSERT INTO EAR.users (USERID, PASSWORD_HASH, EMAIL, FULL_NAME, DEPARTMENT, POSITION, 
                               PHONE, EMPLOYEE_ID, IS_ACTIVE, IS_ADMIN)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userid, passwordHash, email, fullName, department, position, 
         phone, employeeId, isActive, isAdmin]
      );

      // 생성된 사용자 정보 조회
      const result = await db.query(
        `SELECT ID, USERID, EMAIL, FULL_NAME, DEPARTMENT, POSITION, 
                PHONE, EMPLOYEE_ID, IS_ACTIVE, IS_ADMIN, CREATED_AT
         FROM EAR.users 
         WHERE USERID = ?`,
        [userid]
      );

      res.status(201).json({ 
        success: true, 
        user: result.rows[0],
        message: '사용자가 생성되었습니다.' 
      });
    }

  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 수정 (관리자만)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      email, 
      fullName, 
      department, 
      position, 
      phone, 
      employeeId, 
      isActive, 
      isAdmin 
    } = req.body;

    // 사용자 존재 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 사용자 정보 업데이트
    if (DB_TYPE === 'postgres') {
      // PostgreSQL - RETURNING 지원
      const result = await db.query(
        `UPDATE users 
         SET email = $1, full_name = $2, department = $3, position = $4, 
             phone = $5, employee_id = $6, is_active = $7, is_admin = $8, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING id, userid, email, full_name, department, position, 
                   phone, employee_id, is_active, is_admin, updated_at`,
        [email, fullName, department, position, phone, employeeId, isActive, isAdmin, id]
      );

      res.json({ 
        success: true, 
        user: result.rows[0],
        message: '사용자 정보가 수정되었습니다.' 
      });
    } else {
      // HANA - RETURNING 지원 안함, 별도 SELECT 필요
      await db.query(
        `UPDATE EAR.users 
         SET EMAIL = ?, FULL_NAME = ?, DEPARTMENT = ?, POSITION = ?, 
             PHONE = ?, EMPLOYEE_ID = ?, IS_ACTIVE = ?, IS_ADMIN = ?, 
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE ID = ?`,
        [email, fullName, department, position, phone, employeeId, isActive, isAdmin, id]
      );

      // 업데이트된 사용자 정보 조회
      const result = await db.query(
        `SELECT ID, USERID, EMAIL, FULL_NAME, DEPARTMENT, POSITION, 
                PHONE, EMPLOYEE_ID, IS_ACTIVE, IS_ADMIN, UPDATED_AT
         FROM EAR.users 
         WHERE ID = ?`,
        [id]
      );

      res.json({ 
        success: true, 
        user: result.rows[0],
        message: '사용자 정보가 수정되었습니다.' 
      });
    }

  } catch (error) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 비밀번호 초기화 (관리자만)
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: '새 비밀번호를 입력해주세요.' });
    }

    // 사용자 존재 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 새 비밀번호 해시화
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트 및 실패 횟수 초기화
    await db.query(
      'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );

    res.json({ 
      success: true, 
      message: '비밀번호가 초기화되었습니다.' 
    });

  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 삭제 (관리자만)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 자기 자신 삭제 방지
    const currentUserId = (req as any).user?.userId;
    if (currentUserId === parseInt(id)) {
      return res.status(400).json({ error: '자기 자신을 삭제할 수 없습니다.' });
    }

    // 사용자 존재 확인
    const existingUser = await db.query(
      'SELECT id, userid FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 사용자 삭제
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ 
      success: true, 
      message: '사용자가 삭제되었습니다.' 
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 계정 잠금 해제 (관리자만)
router.post('/:id/unlock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 사용자 존재 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 계정 잠금 해제
    await db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ 
      success: true, 
      message: '계정 잠금이 해제되었습니다.' 
    });

  } catch (error) {
    console.error('계정 잠금 해제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
