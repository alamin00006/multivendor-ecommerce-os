import { execSync } from 'node:child_process';
import pg from 'pg';

/**
 * Recreates the e2e database from migrations and seeds it once per run.
 * Uses TEST_DATABASE_URL (see vitest.config.e2e.ts) — never the development database.
 */
export default async function setup(): Promise<void> {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgresql://marketbd:marketbd@localhost:5440/marketbd_test?schema=public',
  );
  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith('_test')) throw new Error(`Refusing to reset non-test database "${dbName}"`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await db.end();

  const env = { ...process.env, DATABASE_URL: url.toString(), MULTI_VENDOR_ENABLED: 'true' };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed/index.ts', { env, stdio: 'inherit' });
}
