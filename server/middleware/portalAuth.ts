import express from 'express';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface PortalAuthenticatedRequest extends Omit<express.Request, 'user'> {
  portalUser?: {
    userId: number;
    userid: string;
    companyCode?: string;
    roles: string[];
    permissions: string[];
    isAdmin: boolean;
  };
}

export const authenticatePortalToken: express.RequestHandler = (req, res, next) => {
  const authReq = req as PortalAuthenticatedRequest;
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Portal 인증 토큰이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    authReq.portalUser = {
      userId: decoded.userId,
      userid: decoded.userid,
      companyCode: decoded.companyCode,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      isAdmin: !!decoded.isAdmin
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: '유효하지 않은 Portal 토큰입니다.' });
  }
};

export const requirePortalAdmin: express.RequestHandler = (req, res, next) => {
  const authReq = req as PortalAuthenticatedRequest;
  const permissions = authReq.portalUser?.permissions || [];
  if (!authReq.portalUser?.isAdmin && !permissions.includes('metrics:write')) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};
