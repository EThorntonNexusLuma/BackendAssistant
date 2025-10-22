# Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL
- Git

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/EThorntonNexusLuma/AIAssistantBackend.git
   cd AIAssistantBackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.sample .env
   # Edit .env with your actual values
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database (if using local PostgreSQL)
   createdb nexus_luma
   
   # Or use a cloud database service like:
   # - Neon (https://neon.tech/)
   # - Supabase (https://supabase.com/)
   # - Railway (https://railway.app/)
   ```

5. **Google OAuth Setup**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Sheets API
   - Create OAuth 2.0 credentials
   - Add your redirect URI: `http://localhost:3000/api/oauth/callback` (for local dev)

6. **Run the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

## Deployment Options

### Railway (Recommended)
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Vercel
1. Connect GitHub repository  
2. Configure for Node.js
3. Set environment variables

## Environment Variables

Required variables (copy from `.env.sample` and fill in real values):

- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `GOOGLE_REDIRECT_URI` - Your OAuth callback URL
- `DASHBOARD_URL` - Frontend application URL
- `CORS_ORIGINS` - Comma-separated allowed origins
- `JWT_SECRET` - Random secret string

## API Endpoints

- `GET /api/ping` - Health check
- `GET /api/oauth/start?tenantId=...` - Start OAuth flow
- `GET /api/oauth/callback` - OAuth callback
- `PUT /api/tenant/origins` - Update allowed origins
- `POST /api/leads` - Submit lead data
- `POST /api/tenants/create` - Create new tenant

## Testing

Once deployed, test the API:

```bash
# Health check
curl https://your-api-domain.com/api/ping

# Should return: {"ok": true}
```