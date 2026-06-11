import { MongoClient, type Db } from 'mongodb';
import { env } from './config/env';

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Connect to MongoDB once and reuse the connection. Reads MONGODB_URI (and an
 * optional DB_NAME) from the typed env — the deploy sets these. Use the native
 * driver everywhere: `getDb().collection<Task>('tasks')` (import the type from
 * ./contract for type-safe reads/writes). No schemas.
 */
export async function connectDb(): Promise<Db> {
  if (database) return database;
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — cannot connect to the database.');
  }
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  database = client.db(env.DB_NAME || undefined);
  return database;
}

/** The connected database. Throws if called before connectDb() resolves. */
export function getDb(): Db {
  if (!database) throw new Error('Database not connected yet.');
  return database;
}
