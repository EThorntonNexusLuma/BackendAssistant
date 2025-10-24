// ping.js — use the application's DB helper so it exercises the real pool
import 'dotenv/config';
import { query } from './db.js';

async function pingDB() {
  try {
    const res = await query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Server time:', res.rows[0].now);
    process.exit(0);
  } catch (err) {
    console.error('Database connection failed:', err.message || err);
    process.exit(1);
  }
}

pingDB();