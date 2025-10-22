import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL)?.includes('railway') ? { rejectUnauthorized: false } : false
});

export async function query(sql, params=[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await query(`CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT gen_random_uuid(),
    buyer_email TEXT,
    buyer_name TEXT,
    publishable_key TEXT UNIQUE NOT NULL,
    allowed_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    plan TEXT DEFAULT 'entry',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`);

  await query(`CREATE TABLE IF NOT EXISTS google_sheets_connections (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sheet_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`);
}
