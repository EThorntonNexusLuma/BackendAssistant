# Nexus Luma Backend (Railway)

This is a ready-to-deploy Node/Express API for Railway that:
- Creates/maintains tenant & Google Sheets connection
- Handles Google OAuth
- Appends leads to the buyer's Sheet
- Works with your Vite/React dashboard

## Deploy

1. Push this `server/` folder to GitHub (as a repo or subfolder) and deploy on Railway.
2. In Railway -> Variables, set the values from `.env.sample` (copy and fill).
3. Make sure your Postgres plugin is attached and `DATABASE_URL` is correct.
4. Enable Public Networking on Postgres (if you connect externally).

## Endpoints

- `GET /api/oauth/start?tenantId=...`
- `GET /api/oauth/callback`
- `PUT /api/tenant/origins` body: `{ tenantId, origins: [] }`
- `POST /api/leads` header: `X-NXL-Public-Key: pk_live_...`

## SQL Helpers

The server auto-creates required tables on boot. To create your first tenant:

```bash
curl -X POST https://YOUR_RAILWAY_API/api/tenants/create -H "Content-Type: application/json" -d '{"buyer_email":"you@example.com","buyer_name":"You"}'
```

Use the returned `tenant_id` + `publishable_key` in your dashboard URL and embed.


### Notes (Automated Fixes)
- Callback route: `/api/oauth/google/callback`
- Listening on `0.0.0.0` with `process.env.PORT`
- Forced Postgres SSL `rejectUnauthorized:false`
- Sample env updated with your Google Client ID and Railway callback URL
