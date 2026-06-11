import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Make `req.userId` available + typed on every handler that runs after
// requireAuth (it sets it from the verified token).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Issue a signed login token for a user id. Call this from signup/login after
 * the user is authenticated, and return it as `{ token, user }`:
 *   const token = signToken(user._id.toString());
 */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/**
 * Protect a route: require a valid `Authorization: Bearer <token>`. On success
 * it sets `req.userId` and continues; otherwise it responds 401 `{ error }`.
 * Put it on every endpoint the contract marks PROTECTED:
 *   router.get('/api/tasks', requireAuth, listTasks)
 * and read the signed-in user inside the handler as `req.userId`.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    if (!userId) {
      res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
      return;
    }
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
