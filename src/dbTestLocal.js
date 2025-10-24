// dbTestLocal.js - Database connection test with detailed diagnostics
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function testConnection() {
  // Parse the connection URL to show diagnostics
  const url = new URL(process.env.DATABASE_URL);
  console.log('\n🔍 Connection Details:');
  console.log(`Host: ${url.hostname}`);
  console.log(`Port: ${url.port}`);
  console.log(`Database: ${url.pathname.slice(1)}`);
  console.log(`SSL Mode: ${url.searchParams.get('sslmode') || 'not specified'}`);
  
  // Try different SSL configurations
  const sslConfigs = [
    { name: 'No SSL', config: false },
    { name: 'Basic SSL', config: true },
    { name: 'Permissive SSL', config: { rejectUnauthorized: false } },
    { name: 'SSL with CA verification disabled', config: { rejectUnauthorized: false, ca: null } }
  ];

  for (const { name, config } of sslConfigs) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: config
    });

    try {
      console.log(`\n🔄 Trying ${name}...`);
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT NOW() as time, current_database() as db, version() as version');
        console.log('✅ Connection successful!');
        console.log('Details:');
        console.log(`- Time: ${result.rows[0].time}`);
        console.log(`- Database: ${result.rows[0].db}`);
        console.log(`- Version: ${result.rows[0].version}`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.log(`❌ ${name} failed:`);
      console.log(`- Error: ${err.message}`);
      if (err.code) console.log(`- Code: ${err.code}`);
    } finally {
      await pool.end();
    }
  }
}

testConnection().catch(console.error);