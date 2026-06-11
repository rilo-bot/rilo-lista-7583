import 'dotenv/config';

/**
 * Infrastructure configuration, read once from the environment. The deploy sets
 * these (locally they come from .env). Import `env` and read typed fields —
 * don't scatter process.env reads through the codebase.
 */
export const env = {
  /** MongoDB connection string. The deploy sets this; empty locally until you do. */
  MONGODB_URI: process.env.MONGODB_URI ?? '',
  /** Optional database name (the driver uses the URI's default when empty). */
  DB_NAME: process.env.DB_NAME ?? '',
  /** HTTP port — the host injects this; falls back to 8080 locally. */
  PORT: Number(process.env.PORT) || 8080,
  /** Secret used to sign + verify auth tokens (only if the app has accounts). */
  JWT_SECRET: process.env.JWT_SECRET ?? '',
};
