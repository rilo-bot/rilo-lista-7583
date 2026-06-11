import type { Request, Response, NextFunction } from 'express';

/**
 * Throw this for an EXPECTED, user-facing failure and the API returns its
 * status with `{ error: message }`:
 *   if (!task) throw new HttpError(404, 'That item no longer exists.');
 * express-async-errors forwards throws from async handlers here automatically,
 * so you rarely need try/catch just to send an error.
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * The single error handler for the whole API. An HttpError becomes its status +
 * message; anything unexpected becomes a generic 500 (the real error is logged,
 * never sent to the client). The body is always `{ error: string }` — the key
 * the frontend reads.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
