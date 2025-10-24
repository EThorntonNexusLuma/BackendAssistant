// dbTestRailway.js - Test internal Railway PostgreSQL connection
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Internal Railway PostgreSQL connection string
const internalUrl = 'postgresql://postgres:NjqNILmeTXpjkeDTwlJFjSHqnyGzrXcW@postgres.railway.internal:5432/railway';

async function testRailwayInternal() {
  console.log('\n🔍 Testing Railway Internal Connection:');
  console.log('Host: postgres.railway.internal');
  console.log('Port: 5432');
  console.log('SSL: disabled (internal network)\n');

  const pool = new Pool({
    connectionString: internalUrl,
    ssl: false, // No SSL needed for internal Railway network
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('🔄 Attempting connection...');
    const client = await pool.connect();
    
    try {
      // Test 1: Basic Connection
      const result = await client.query('SELECT NOW() as time, current_database() as db, version() as version');
      console.log('✅ Basic connection successful!');
      console.log('Details:');
      console.log(`- Time: ${result.rows[0].time}`);
      console.log(`- Database: ${result.rows[0].db}`);
      console.log(`- Version: ${result.rows[0].version}\n`);

      // Test 2: Check Tables
      console.log('🔍 Checking database tables...');
      const tables = await client.query(`
        SELECT table_name, 
               (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      if (tables.rows.length === 0) {
        console.log('ℹ️ No tables found in public schema');
      } else {
        console.log('📋 Tables found:');
        tables.rows.forEach(table => {
          console.log(`- ${table.table_name} (${table.column_count} columns)`);
        });
      }

      // Test 3: Check Tenant Count
      try {
        const tenantCount = await client.query('SELECT COUNT(*) as count FROM tenants');
        console.log(`\n📊 Tenant count: ${tenantCount.rows[0].count}`);
      } catch (err) {
        console.log('\n⚠️ Could not count tenants:', err.message);
      }

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Connection failed:');
    console.error(`- Error: ${err.message}`);
    if (err.code) console.error(`- Code: ${err.code}`);
  } finally {
    await pool.end();
  }
}

// Run the test
testRailwayInternal().catch(console.error);