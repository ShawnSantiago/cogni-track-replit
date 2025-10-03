import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type NeonDatabase = ReturnType<typeof neonDrizzle>;
type PostgresDatabase = ReturnType<typeof pgDrizzle>;
type DrizzleDatabase = NeonDatabase | PostgresDatabase;

const isProduction = process.env.NODE_ENV === 'production';
const connectionString =
  !isProduction && process.env.LOCAL_DATABASE_URL
    ? process.env.LOCAL_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'A database connection string was not found. Set DATABASE_URL or LOCAL_DATABASE_URL before importing the Drizzle client.'
  );
}

let connectionUrl: URL | undefined;
try {
  connectionUrl = new URL(connectionString);
} catch {
  // Ignore parse errors and fall back to the Postgres driver.
}

const neonHostSuffixes = ['neon.tech', 'neondb.net'];
const hostname = connectionUrl?.hostname ?? '';
const useNeon =
  connectionUrl !== undefined &&
  neonHostSuffixes.some((suffix) => hostname.endsWith(suffix));

let db: DrizzleDatabase;

if (useNeon) {
  const sql = neon(connectionString);
  db = neonDrizzle(sql, { schema });
} else {
  const pool = new Pool({ connectionString });
  db = pgDrizzle(pool, { schema });
}

export { db };
