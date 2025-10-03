import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

type NeonDatabase = ReturnType<typeof neonDrizzle>;
type PostgresDatabase = ReturnType<typeof pgDrizzle>;
type DrizzleInstance = NeonDatabase | PostgresDatabase;

const globalForDb = globalThis as typeof globalThis & {
  __drizzleDb__?: DrizzleInstance;
  __drizzlePool__?: Pool;
};

function resolveConnectionString() {
  const isProduction = process.env.NODE_ENV === 'production';
  const connectionString =
    !isProduction && process.env.LOCAL_DATABASE_URL
      ? process.env.LOCAL_DATABASE_URL
      : process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'No database connection string found. Set DATABASE_URL or LOCAL_DATABASE_URL before accessing the database.'
    );
  }

  return connectionString;
}

function shouldUseNeon(parsedUrl: URL | undefined) {
  if (!parsedUrl) {
    return false;
  }

  const neonHostSuffixes = ['neon.tech', 'neondb.net'];
  return neonHostSuffixes.some((suffix) => parsedUrl.hostname.endsWith(suffix));
}

function createDb(): DrizzleInstance {
  const connectionString = resolveConnectionString();

  let parsedUrl: URL | undefined;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    parsedUrl = undefined;
  }

  if (shouldUseNeon(parsedUrl)) {
    const sql = neon(connectionString);
    return neonDrizzle(sql, { schema });
  }

  if (!globalForDb.__drizzlePool__) {
    globalForDb.__drizzlePool__ = new Pool({ connectionString });
  }

  return pgDrizzle(globalForDb.__drizzlePool__!, { schema });
}

export function getDb() {
  if (!globalForDb.__drizzleDb__) {
    globalForDb.__drizzleDb__ = createDb();
  }

  return globalForDb.__drizzleDb__;
}

export { schema };
