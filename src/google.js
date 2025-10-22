import { google } from 'googleapis';
import { query } from './db.js';

function oauthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return client;
}

export function getAuthUrl(tenantId) {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'
  ];
  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ tenantId })
  });
  return url;
}

export async function handleOAuthCallback(code, stateRaw) {
  const state = JSON.parse(stateRaw || '{}');
  const tenantId = state.tenantId;
  if (!tenantId) throw new Error('Missing tenantId in state');

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Ensure we have a Google Sheet for this tenant
  const sheets = google.sheets({ version: 'v4', auth: client });
  const drive = google.drive({ version: 'v3', auth: client });

  // Create the sheet if not existing
  // Title includes tenantId for clarity
  const title = `Lum-X Leads (${tenantId})`;
  const file = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    },
    fields: 'id'
  });

  const sheetId = file.data.id;

  // Prepare header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1:F1',
    valueInputOption: 'RAW',
    requestBody: { values: [[
      'Name','Email','Phone','Annual Salary','Source','Created_At'
    ]]}
  });

  // Store tokens + sheetId
  await query(
    `INSERT INTO google_sheets_connections (tenant_id, sheet_id, access_token, refresh_token, token_expiry)
     VALUES ($1,$2,$3,$4, to_timestamp($5/1000))
     ON CONFLICT DO NOTHING;`,
    [
      tenantId,
      sheetId,
      tokens.access_token || null,
      tokens.refresh_token || null,
      tokens.expiry_date || 0
    ]
  );

  return { tenantId, sheetId };
}

export async function appendLeadRow({ publishableKey, name, email, phone, annualSalary, source, message }) {
  // Resolve tenant by publishable key
  const t = await query(`SELECT tenant_id FROM tenants WHERE publishable_key=$1 LIMIT 1`, [publishableKey]);
  if (t.rowCount === 0) {
    const e = new Error('Unknown publishable key');
    e.status = 401;
    throw e;
  }
  const tenantId = t.rows[0].tenant_id;

  // Fetch tokens & sheet
  const g = await query(`SELECT sheet_id, access_token, refresh_token, token_expiry 
                         FROM google_sheets_connections WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1`, [tenantId]);
  if (g.rowCount === 0) {
    const e = new Error('Google Sheets not connected');
    e.status = 400;
    throw e;
  }

  const row = g.rows[0];
  const client = oauthClient();
  client.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined
  });

  const sheets = google.sheets({ version: 'v4', auth: client });
  const values = [[
    name || '', email || '', phone || '', annualSalary || '', source || '', new Date().toISOString()
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: row.sheet_id,
    range: 'A2',
    valueInputOption: 'RAW',
    requestBody: { values }
  });

  return { ok: true };
}
