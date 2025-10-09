import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type EnvLookup = Record<string, string | undefined>;

const env: EnvLookup = {
  DRIZZLE_DATABASE_URL: process.env.DRIZZLE_DATABASE_URL,
  LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

const isProduction = process.env.NODE_ENV === 'production';

const connectionString =
  env.DRIZZLE_DATABASE_URL ??
  (!isProduction && env.LOCAL_DATABASE_URL ? env.LOCAL_DATABASE_URL : env.DATABASE_URL);

if (!connectionString) {
  throw new Error(
    'A database connection string was not found. Set DRIZZLE_DATABASE_URL, LOCAL_DATABASE_URL, or DATABASE_URL before running Drizzle commands.'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
});
