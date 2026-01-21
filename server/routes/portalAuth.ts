import express from 'express';
import { db, DB_TYPE } from '../db';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const LOCAL_ONLY = process.env.LOCAL_ONLY === 'true';

const resolvePermissions = (rows: Array<{ permissions: any }>) => {
  const permissions: string[] = [];
  rows.forEach((row) => {
    if (!row?.permissions) {
      return;
    }
    if (Array.isArray(row.permissions)) {
      permissions.push(...row.permissions);
      return;
    }
    if (typeof row.permissions === 'string') {
      try {
        const parsed = JSON.parse(row.permissions);
        if (Array.isArray(parsed)) {
          permissions.push(...parsed);
        }
      } catch {
        // ignore invalid payload
      }
    }
  });
  return Array.from(new Set(permissions));
};

router.post('/login', async (req, res) => {
  try {
    const { userid, password } = req.body || {};
    if (!userid || (!password && !LOCAL_ONLY)) {
      return res.status(400).json({ error: '사용자ID와 비밀번호를 입력해주세요.' });
    }

    let userResult;
    if (DB_TYPE === 'postgres') {
      userResult = await db.query(
        'SELECT * FROM portal_users WHERE userid = $1 AND is_active = true',
        [userid]
      );
    } else {
      userResult = await db.query(
        'SELECT * FROM EAR.portal_users WHERE USERID = ? AND IS_ACTIVE = true',
        [userid]
      );
    }

    const userRows = userResult.rows || userResult || [];

    if (userRows.length === 0 && LOCAL_ONLY) {
      const passwordHash = await bcrypt.hash('local-dev', 10);
      if (DB_TYPE === 'postgres') {
        await db.query(
          `INSERT INTO portal_users (userid, password_hash, full_name, is_admin, is_active, company_code)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (userid) DO NOTHING`,
          [userid, passwordHash, `${userid} (local)`, true, true, 'LOCAL']
        );
        userResult = await db.query(
          'SELECT * FROM portal_users WHERE userid = $1 AND is_active = true',
          [userid]
        );
      } else {
        await db.query(
          'INSERT INTO EAR.portal_users (USERID, PASSWORD_HASH, FULL_NAME, IS_ADMIN, IS_ACTIVE, COMPANY_CODE) VALUES (?, ?, ?, ?, ?, ?)',
          [userid, passwordHash, `${userid} (local)`, true, true, 'LOCAL']
        );
        userResult = await db.query(
          'SELECT * FROM EAR.portal_users WHERE USERID = ? AND IS_ACTIVE = true',
          [userid]
        );
      }
    }

    const resolvedRows = userResult.rows || userResult || [];

    if (resolvedRows.length === 0 && !LOCAL_ONLY) {
      if (DB_TYPE === 'postgres') {
        await db.query(
          'INSERT INTO portal_login_history (userid, ip_address, user_agent, login_status, failure_reason) VALUES ($1, $2, $3, $4, $5)',
          [userid, req.ip, req.get('User-Agent') || 'unknown', 'failed', '사용자를 찾을 수 없습니다']
        );
      } else {
        await db.query(
          'INSERT INTO EAR.portal_login_history (USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS, FAILURE_REASON) VALUES (?, ?, ?, ?, ?)',
          [userid, req.ip, req.get('User-Agent') || 'unknown', 'failed', '사용자를 찾을 수 없습니다']
        );
      }
      return res.status(401).json({ error: '사용자ID 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = resolvedRows[0];
    const lockedUntil = user.locked_until || user.LOCKED_UNTIL;
    if (lockedUntil && new Date() < new Date(lockedUntil)) {
      return res.status(423).json({ error: '계정이 잠겨 있습니다. 잠시 후 다시 시도해주세요.' });
    }
    const isValidPassword = LOCAL_ONLY ? true : await bcrypt.compare(password, user.password_hash || user.PASSWORD_HASH);

    if (!isValidPassword) {
      const failedAttempts = Number(user.failed_login_attempts || user.FAILED_LOGIN_ATTEMPTS || 0) + 1;
      const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;
      if (DB_TYPE === 'postgres') {
        await db.query(
          'UPDATE portal_users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [failedAttempts, lockUntil, user.id]
        );
      } else {
        await db.query(
          'UPDATE EAR.portal_users SET FAILED_LOGIN_ATTEMPTS = ?, LOCKED_UNTIL = ? WHERE ID = ?',
          [failedAttempts, lockUntil, user.ID]
        );
      }
      if (DB_TYPE === 'postgres') {
        await db.query(
          'INSERT INTO portal_login_history (user_id, userid, ip_address, user_agent, login_status, failure_reason) VALUES ($1, $2, $3, $4, $5, $6)',
          [user.id, userid, req.ip, req.get('User-Agent') || 'unknown', 'failed', '잘못된 비밀번호']
        );
      } else {
        await db.query(
          'INSERT INTO EAR.portal_login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS, FAILURE_REASON) VALUES (?, ?, ?, ?, ?, ?)',
          [user.ID, userid, req.ip, req.get('User-Agent') || 'unknown', 'failed', '잘못된 비밀번호']
        );
      }
      return res.status(401).json({ error: '사용자ID 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (DB_TYPE === 'postgres') {
      await db.query(
        'UPDATE portal_users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      await db.query(
        'INSERT INTO portal_login_history (user_id, userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4, $5)',
        [user.id, userid, req.ip, req.get('User-Agent') || 'unknown', 'success']
      );
    } else {
      await db.query(
        'UPDATE EAR.portal_users SET FAILED_LOGIN_ATTEMPTS = 0, LOCKED_UNTIL = NULL, LAST_LOGIN = CURRENT_TIMESTAMP WHERE ID = ?',
        [user.ID]
      );
      await db.query(
        'INSERT INTO EAR.portal_login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?, ?)',
        [user.ID, userid, req.ip, req.get('User-Agent') || 'unknown', 'success']
      );
    }

    const companyCode = user.company_code || user.COMPANY_CODE || 'SKN';

    let roles: string[] = [];
    if (DB_TYPE === 'postgres') {
      const roleResult = await db.query('SELECT role_name FROM portal_user_roles WHERE user_id = $1', [user.id]);
      roles = roleResult.rows.map((row: any) => row.role_name);
    } else {
      const roleResult = await db.query('SELECT ROLE_NAME FROM EAR.portal_user_roles WHERE USER_ID = ?', [user.ID]);
      roles = (roleResult.rows || roleResult || []).map((row: any) => row.ROLE_NAME || row.role_name);
    }

    if (roles.length === 0) {
      roles = ['user'];
    }

    let permissionRows: Array<{ permissions: any }> = [];
    if (DB_TYPE === 'postgres') {
      const permissionResult = await db.query(
        'SELECT permissions FROM portal_role_matrix WHERE company_code = $1 AND role_name = ANY($2::text[])',
        [companyCode, roles]
      );
      permissionRows = permissionResult.rows;
    } else {
      const placeholders = roles.map(() => '?').join(', ');
      const permissionResult = await db.query(
        `SELECT PERMISSIONS FROM EAR.portal_role_matrix WHERE COMPANY_CODE = ? AND ROLE_NAME IN (${placeholders})`,
        [companyCode, ...roles]
      );
      permissionRows = (permissionResult.rows || permissionResult || []).map((row: any) => ({
        permissions: row.PERMISSIONS || row.permissions
      }));
    }

    const permissions = resolvePermissions(permissionRows);
    const isAdmin = roles.includes('admin');

    const token = jwt.sign(
      {
        userId: user.id || user.ID,
        userid: user.userid || user.USERID,
        fullName: user.full_name || user.FULL_NAME,
        email: user.email || user.EMAIL,
        companyCode,
        roles,
        permissions,
        isAdmin
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id || user.ID,
        userid: user.userid || user.USERID,
        fullName: user.full_name || user.FULL_NAME,
        email: user.email || user.EMAIL,
        companyCode,
        roles,
        permissions,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Portal login error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({ error: '토큰이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({
      user: {
        id: decoded.userId,
        userid: decoded.userid,
        fullName: decoded.fullName || decoded.userid,
        email: decoded.email || '',
        companyCode: decoded.companyCode,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
        isAdmin: decoded.isAdmin || false
      }
    });
  } catch (error) {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
});

export default router;
