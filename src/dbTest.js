// dbTest.js - Comprehensive database test suite
import 'dotenv/config';
import pool, { query, ensureSchema } from './db.js';

async function runTests() {
  const tests = [];
  let failedTests = 0;

  function addTest(name, fn) {
    tests.push({ name, fn });
  }

  async function runTest(name, fn) {
    try {
      console.log(`\n📝 Running test: ${name}`);
      await fn();
      console.log(`✅ Passed: ${name}`);
      return true;
    } catch (err) {
      console.error(`❌ Failed: ${name}`);
      console.error(`   Error: ${err.message}`);
      failedTests++;
      return false;
    }
  }

  // Test 1: Basic Connection
  addTest('Basic Connection', async () => {
    const result = await query('SELECT NOW()');
    if (!result.rows[0].now) throw new Error('No timestamp returned');
    console.log(`   Server time: ${result.rows[0].now}`);
  });

  // Test 2: Schema Creation
  addTest('Schema Creation', async () => {
    await ensureSchema();
  });

  // Test 3: Create Test Tenant
  addTest('Create Test Tenant', async () => {
    const tenantData = {
      buyer_name: 'Test User',
      buyer_email: `test.${Date.now()}@example.com`,
      publishable_key: `pk_test_${Date.now()}`
    };
    
    const result = await query(
      'INSERT INTO tenants (buyer_name, buyer_email, publishable_key) VALUES ($1, $2, $3) RETURNING *',
      [tenantData.buyer_name, tenantData.buyer_email, tenantData.publishable_key]
    );
    
    const tenant = result.rows[0];
    console.log(`   Created tenant with ID: ${tenant.tenant_id}`);
    return tenant;
  });

  // Test 4: Create Test Lead
  addTest('Create Test Lead', async () => {
    // First get a tenant
    const tenant = await query('SELECT tenant_id, site_id FROM tenants LIMIT 1');
    if (!tenant.rows[0]) throw new Error('No tenant found for lead test');
    
    const leadData = {
      tenant_id: tenant.rows[0].tenant_id,
      site_id: tenant.rows[0].site_id || 'test-site',
      name: 'Test Lead',
      email: `lead.${Date.now()}@example.com`,
      phone: '+1234567890',
      annual_salary: '100k-150k',
      source: 'test',
      message: 'Test lead message'
    };
    
    const result = await query(
      'INSERT INTO leads (tenant_id, site_id, name, email, phone, annual_salary, source, message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [leadData.tenant_id, leadData.site_id, leadData.name, leadData.email, leadData.phone, leadData.annual_salary, leadData.source, leadData.message]
    );
    
    const lead = result.rows[0];
    console.log(`   Created lead with ID: ${lead.lead_id}`);
    return lead;
  });

  // Test 5: Query Relationships
  addTest('Query Relationships', async () => {
    const result = await query(`
      SELECT t.tenant_id, t.buyer_name, COUNT(l.lead_id) as lead_count
      FROM tenants t
      LEFT JOIN leads l ON t.tenant_id = l.tenant_id
      GROUP BY t.tenant_id, t.buyer_name
      LIMIT 5
    `);
    
    console.log('   Retrieved tenant-lead relationships:');
    result.rows.forEach(row => {
      console.log(`   - Tenant ${row.tenant_id} (${row.buyer_name}) has ${row.lead_count} leads`);
    });
  });

  // Test 6: Test Indices
  addTest('Test Indices', async () => {
    const result = await query(`
      SELECT 
        schemaname as schema,
        tablename as table,
        indexname as index,
        indexdef as definition
      FROM pg_indexes
      WHERE tablename IN ('tenants', 'leads')
      ORDER BY tablename, indexname;
    `);
    
    console.log('   Verified indices:');
    result.rows.forEach(idx => {
      console.log(`   - ${idx.table}.${idx.index}`);
    });
  });

  // Run all tests
  console.log('🚀 Starting database tests...\n');
  for (const test of tests) {
    await runTest(test.name, test.fn);
  }

  // Summary
  console.log(`\n📊 Test Summary:`);
  console.log(`   Total tests: ${tests.length}`);
  console.log(`   Passed: ${tests.length - failedTests}`);
  console.log(`   Failed: ${failedTests}`);

  // Cleanup
  await pool.end();
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the test suite
runTests().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});