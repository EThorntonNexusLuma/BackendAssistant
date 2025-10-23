import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query, ensureSchema } from './db.js';
import { getAuthUrl, handleOAuthCallback, appendLeadRow } from './google.js';

const app = express();
app.use(express.json());

// ---- CORS (safer) ----
const allowlist = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Add specific frontend URLs for production environments
const defaultOrigins = [
  'https://zpiv36uxydrdx5ypatb0ckb9tr6a-oci3--5173--9643543b.local-credentialless.webcontainer-api.io',
  'https://nexus-luma-ai-assist-3hps.bolt.host',
  'http://localhost:5173',
  'https://localhost:5173'
];

// Combine environment origins with default ones
const finalOrigins = allowlist.length > 0 ? allowlist : defaultOrigins;

app.use((req, res, next) => {
  // Always answer preflight quickly
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-NXL-Public-Key');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({
  origin: [
    'https://zpiv36uxydrdx5ypatb0ckb9tr6a-oci3--5173--9643543b.local-credentialless.webcontainer-api.io',
    'https://nexus-luma-ai-assist-3hps.bolt.host',
    'http://localhost:5173',
    'https://localhost:5173',
    ...finalOrigins
  ],
  credentials: true
}));

// ---- Health & ping ----
app.get('/api/health', (_req, res) => res.status(200).send('ok'));
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// ---- Log important envs at boot (helps diagnose crashes) ----
console.log('ENV CHECK', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasRedirect: !!process.env.GOOGLE_REDIRECT_URI,
  hasDashboardUrl: !!process.env.DASHBOARD_URL,
  corsOrigins: finalOrigins
});

// ---- Routes ----

// Create a tenant quickly (for testing)
app.post('/api/tenants/create', async (req, res, next) => {
  try {
    const { buyer_email, buyer_name } = req.body || {};
    const r = await query(
      `INSERT INTO tenants (buyer_email, buyer_name, publishable_key)
       VALUES ($1, $2, 'pk_live_' || encode(gen_random_bytes(16), 'hex'))
       RETURNING tenant_id, publishable_key`,
      [buyer_email || null, buyer_name || null]
    );
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

// Allow origins update
app.put('/api/tenant/origins', async (req, res, next) => {
  try {
    const { tenantId, origins } = req.body || {};
    if (!tenantId || !Array.isArray(origins)) {
      return res.status(400).json({ error: 'tenantId and origins[] required' });
    }
    await query(`UPDATE tenants SET allowed_origins=$2 WHERE tenant_id=$1`, [tenantId, origins]);
    res.status(204).end();
  } catch (e) { next(e); }
});

// Start Google OAuth
app.get('/api/oauth/start', async (req, res, next) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).send('Missing tenantId');
    const url = getAuthUrl(tenantId);
    res.redirect(url);
  } catch (e) { next(e); }
});

// OAuth callback
app.get('/api/oauth/google/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const { tenantId, sheetId } = await handleOAuthCallback(code, state);

    // Guard against missing DASHBOARD_URL
    const dash = process.env.DASHBOARD_URL || 'https://example.com/dashboard';
    const redirect = new URL(dash);
    redirect.searchParams.set('tenant', tenantId);
    res.redirect(redirect.toString());
  } catch (e) { next(e); }
});

// Leads endpoint
app.post('/api/leads', async (req, res, next) => {
  try {
    const publishableKey = req.header('X-NXL-Public-Key');
    if (!publishableKey) return res.status(401).json({ error: 'Missing X-NXL-Public-Key' });
    const { name, email, phone, annualSalary, source, message } = req.body || {};
    await appendLeadRow({ publishableKey, name, email, phone, annualSalary, source, message });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ---- Start server AFTER schema (with fallback) ----
const PORT = process.env.PORT || 3000;

async function boot() {
  const start = Date.now();
  try {
    const schemaPromise = ensureSchema().then(() => {
      console.log('✅ Schema ready');
    }).catch(err => {
      console.error('Schema error (continuing to listen):', err);
    });

    // Fallback: if schema takes too long, we still start listening
    const timeout = new Promise(resolve => {
      setTimeout(resolve, 20000); // 20s
    });

    await Promise.race([schemaPromise, timeout]);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API listening on ${PORT} (started in ${Date.now() - start}ms)`);
    });
  } catch (e) {
    console.error('FATAL: could not start server', e);
    process.exit(1);
  }
}

boot();
