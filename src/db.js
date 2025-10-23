// src/db.js
import pg from 'pg';
const { Pool } = pg;

// 1) Use the single DATABASE_URL, not PGHOST/PGPORT/PGUSER/etc.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing env: DATABASE_URL');
}

// 2) Handle SSL for different environments
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

// Small helper so the rest of your code can use `query(...)`
export const query = (text, params) => pool.query(text, params);

// Optional: create tables on boot
export async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_email TEXT,
      buyer_name TEXT,
      publishable_key TEXT UNIQUE NOT NULL,
      allowed_origins TEXT[],
      sheet_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS google_sheets_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
      sheet_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_scope TEXT,
      token_expiry TIMESTAMPTZ,
      provider_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
