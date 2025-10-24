import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Detect Railway environment
const isRailway = !!(
  process.env.RAILWAY_ENVIRONMENT || 
  process.env.RAILWAY_PROJECT_ID ||
  connectionString.includes('railway.internal')
);

// Determine SSL configuration
const sslConfig = isRailway || connectionString.includes('railway.internal')
  ? false // No SSL for internal Railway connections
  : { rejectUnauthorized: false }; // SSL for proxy connections

console.log('🗄️  Database Configuration:', {
  environment: isRailway ? 'Railway' : 'Local',
  host: new URL(connectionString).hostname,
  ssl: sslConfig ? 'enabled' : 'disabled',
  port: new URL(connectionString).port
});

// Configure connection pool
const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  max: isRailway ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
});

// Handle unexpected pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected pool error:', err.message);
});

// Test connection and log success
pool.on('connect', (client) => {
  console.log('✅ New database connection established');
});

// Query wrapper with error logging
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Warn on slow queries
    if (duration > 2000) {
      console.warn('⚠️  Slow query detected:', { 
        duration: `${duration}ms`, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Query error:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  }
}

// Schema initialization with proper error handling
export async function ensureSchema() {
  let client;
  
  try {
    console.log('🔄 Connecting to database...');
    client = await pool.connect();
    
    // Test connection
    const testResult = await client.query('SELECT NOW() as time, current_database() as db');
    console.log('✅ Connected to database:', {
      database: testResult.rows[0].db,
      time: testResult.rows[0].time
    });

    console.log('🔄 Initializing schema...');
    
    // Begin transaction
    await client.query('BEGIN');

    // Create tables and indices in one transaction
    await client.query(`
      -- Tenants table
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id SERIAL PRIMARY KEY,
        site_id TEXT UNIQUE NOT NULL DEFAULT ('site_' || encode(gen_random_bytes(16), 'hex')),
        buyer_name TEXT,
        buyer_email TEXT UNIQUE NOT NULL,
        publishable_key TEXT UNIQUE NOT NULL,
        google_refresh_token TEXT,
        google_sheet_id TEXT,
        google_sheet_name TEXT,
        allowed_origins TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        lead_id SERIAL PRIMARY KEY,
        tenant_id INT REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        site_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        annual_salary TEXT,
        source TEXT,
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Performance indices
      CREATE INDEX IF NOT EXISTS idx_tenants_site_id ON tenants(site_id);
      CREATE INDEX IF NOT EXISTS idx_tenants_publishable_key ON tenants(publishable_key);
      CREATE INDEX IF NOT EXISTS idx_tenants_buyer_email ON tenants(buyer_email);
      CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_leads_site_id ON leads(site_id);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ Database schema initialized successfully');

  } catch (error) {
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }
    
    console.error('❌ Schema initialization failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    throw error;
    
  } finally {
    // Always release the client
    if (client) {
      client.release();
    }
  }
}

// Graceful shutdown handlers
const shutdown = async (signal) => {
  console.log(`\n${signal} received, closing database pool...`);
  try {
    await pool.end();
    console.log('✅ Database pool closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

export default pool;