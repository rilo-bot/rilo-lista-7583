import { Router, type Request, type Response } from 'express';
import type { Db, WithId, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import sgMail from '@sendgrid/mail';
import { HttpError } from '../middleware/error';
import { signToken, requireAuth } from '../middleware/auth';
import type { User, OtpCode } from '../contract';

// ── types stored in MongoDB (id lives as _id; we map it on the way out) ──

interface UserDoc {
  _id: ObjectId;
  email: string;
  createdAt: string;
}

interface OtpDoc {
  _id: ObjectId;
  email: string;
  code: string;
  expiresAt: string;
  createdAt: string;
}

// ── helpers ──

/** Map a MongoDB UserDoc to the contract User shape. */
function toUser(doc: WithId<Document> | UserDoc): User {
  const d = doc as UserDoc;
  return {
    id: d._id.toString(),
    email: d.email,
    createdAt: d.createdAt,
  };
}

/** Generate a random 6-digit numeric code. */
function generateCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

// ── SendGrid setup ──
// The key is read lazily at send-time so the module still loads in test envs
// where the key isn't present. Never log it.

async function sendCodeEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new HttpError(500, 'Email service is not configured.');
  }

  sgMail.setApiKey(apiKey);

  const msg = {
    to,
    from,
    subject: 'Your Lista sign-in code',
    text: `Your Lista sign-in code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `<p>Your Lista sign-in code is:</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>`,
  };

  // Short timeout wrapper: race the SendGrid call against a 8 s deadline
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('SendGrid timeout')), 8_000)
  );

  await Promise.race([sgMail.send(msg), timeout]);
}

// ── route factory ──

export function createAuthRouter(db: Db): Router {
  const router = Router();
  const users = db.collection<UserDoc>('users');
  const otps = db.collection<OtpDoc>('otp_codes');

  // ── POST /api/auth/request-code ──────────────────────────────────────────
  router.post('/request-code', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: unknown };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new HttpError(400, 'A valid email address is required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // Ensure the user record exists (upsert)
    const existing = await users.findOne({ email: normalizedEmail });
    if (!existing) {
      await users.insertOne({
        _id: new ObjectId(),
        email: normalizedEmail,
        createdAt: now.toISOString(),
      });
    }

    // Invalidate any existing unexpired codes for this email
    await otps.deleteMany({ email: normalizedEmail });

    const code = generateCode();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // +10 min

    await otps.insertOne({
      _id: new ObjectId(),
      email: normalizedEmail,
      code,
      expiresAt,
      createdAt: now.toISOString(),
    });

    try {
      await sendCodeEmail(normalizedEmail, code);
    } catch (err) {
      // Clean up the stored code so it can't be guessed later
      await otps.deleteOne({ email: normalizedEmail, code });
      console.error('Failed to send code email:', (err as Error).message);
      throw new HttpError(502, 'Could not send the code, please try again.');
    }

    const response: { ok: boolean } = { ok: true };
    res.status(200).json(response);
  });

  // ── POST /api/auth/verify-code ───────────────────────────────────────────
  router.post('/verify-code', async (req: Request, res: Response) => {
    const { email, code } = req.body as { email?: unknown; code?: unknown };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new HttpError(400, 'A valid email address is required.');
    }
    if (!code || typeof code !== 'string') {
      throw new HttpError(400, 'A verification code is required.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    const otpDoc = await otps.findOne({ email: normalizedEmail });

    if (!otpDoc) {
      throw new HttpError(400, 'No code was found for this email. Please request a new one.');
    }

    if (otpDoc.code !== trimmedCode) {
      throw new HttpError(400, 'The code you entered is incorrect. Please try again.');
    }

    if (new Date() > new Date(otpDoc.expiresAt)) {
      // Clean up the expired code
      await otps.deleteOne({ _id: otpDoc._id });
      throw new HttpError(400, 'Your code has expired. Please request a new one.');
    }

    // Invalidate the used code immediately (one-time use)
    await otps.deleteOne({ _id: otpDoc._id });

    // Look up (or create) the user — the record was created at request-code time
    // but guard against a missing record defensively
    let userDoc = await users.findOne({ email: normalizedEmail });
    if (!userDoc) {
      const now = new Date();
      const newUser: UserDoc = {
        _id: new ObjectId(),
        email: normalizedEmail,
        createdAt: now.toISOString(),
      };
      await users.insertOne(newUser);
      userDoc = newUser;
    }

    const user = toUser(userDoc);
    const token = signToken(userDoc._id.toString());

    res.status(200).json({ token, user });
  });

  // ── GET /api/auth/me  (PROTECTED) ────────────────────────────────────────
  router.get('/me', requireAuth, async (req: Request, res: Response) => {
    const userDoc = await users.findOne({ _id: new ObjectId(req.userId!) });

    if (!userDoc) {
      throw new HttpError(404, 'User not found.');
    }

    res.status(200).json(toUser(userDoc));
  });

  return router;
}
