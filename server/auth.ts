import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { StaffPermissions, UserAccount, UserRole } from '../shared/types.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserAccount;
  tokenPayload?: TokenPayload;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const original = Buffer.from(originalHex, 'hex');
    if (derived.length !== original.length) return false;
    return crypto.timingSafeEqual(derived, original);
  } catch {
    return false;
  }
}

export function verifyEnvAdminPasscode(inputPasscode: string): boolean {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (!envPass) return false;
  const a = Buffer.from(inputPasscode, 'utf8');
  const b = Buffer.from(envPass, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signToken(user: Pick<UserAccount, 'id' | 'role' | 'email'>): string {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.sub || !parsed.role || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createAuthMiddleware(getUserById: (id: string) => UserAccount | undefined) {
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    const user = getUserById(payload.sub);
    if (!user || !user.active) {
      return res.status(403).json({ error: 'Account is inactive or unavailable' });
    }
    req.authUser = user;
    req.tokenPayload = payload;
    next();
  };

  const requireRoles = (roles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!roles.includes(req.authUser.role)) {
        return res.status(403).json({ error: 'Insufficient role permissions' });
      }
      next();
    };
  };

  const requirePermission = (permission: keyof StaffPermissions) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (req.authUser.role === 'admin') {
        return next();
      }
      if (req.authUser.role === 'staff' && req.authUser.permissions[permission]) {
        return next();
      }
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    };
  };

  return { requireAuth, requireRoles, requirePermission };
}
