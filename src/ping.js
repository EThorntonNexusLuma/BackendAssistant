// ping.js
import pg from 'pg';
import 'dotenv/config';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing env: DATABASE_URL');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

async function pingDB() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Server time:', result.rows[0].now);
    await pool.end();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

pingDB();