# External Services Setup Guide

This guide will help you set up the external services required for the Real Estate Agent application.

## 1. Supabase Setup

Supabase provides the PostgreSQL database with pgvector extension for semantic search and user authentication.

### Steps:

1. **Create a Supabase Account**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up for a free account

2. **Create a New Project**
   - Click "New Project"
   - Choose a project name (e.g., "real-estate-agent")
   - Set a strong database password
   - Select a region close to your users
   - Wait for project initialization (~2 minutes)

3. **Get API Credentials**
   - Navigate to Project Settings > API
   - Copy the following values:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

4. **Add to `.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

> **Note**: Database schema setup will be done in Phase 2

---

## 2. Redis Setup

Redis is used for caching search results and managing scraping job queues.

### Option A: Local Redis (Development)

**macOS**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows**:
- Download from [https://github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
- Or use WSL2 with Ubuntu instructions above

**Test Connection**:
```bash
redis-cli ping
# Should respond with: PONG
```

**Add to `.env.local`**:
```env
REDIS_URL=redis://localhost:6379
```

### Option B: Cloud Redis (Production) - Upstash

**Upstash is recommended for Vercel deployments** because it provides both persistent connections (for workers) and REST API (for serverless functions).

**Steps for Upstash**:
1. Sign up at [https://upstash.com](https://upstash.com)
2. Create a new Redis database
   - Select a region close to your Vercel deployment (e.g., Frankfurt)
   - Enable TLS
3. Get your credentials from the dashboard:
   - **Redis URL** (for ioredis/BullMQ): `rediss://default:PASSWORD@ENDPOINT:6379`
   - **REST URL**: `https://ENDPOINT.upstash.io`
   - **REST Token**: Your REST API token
4. Add to `.env.local`:
   ```env
   # For BullMQ and persistent connections (worker)
   REDIS_URL=rediss://default:your_password@your-db.upstash.io:6379

   # For serverless functions (Vercel)
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_rest_token
   ```

**Why both URLs?**
- `REDIS_URL`: Used by the Railway worker for BullMQ job queue (persistent connection)
- `UPSTASH_REDIS_REST_URL/TOKEN`: Used by Vercel serverless functions (HTTP-based, no connection pooling needed)

---

## 3. OpenAI API Setup

OpenAI provides the AI models for natural language understanding and embeddings.

### Steps:

1. **Create an OpenAI Account**
   - Go to [https://platform.openai.com](https://platform.openai.com)
   - Sign up or log in

2. **Add Billing Information**
   - Navigate to Settings > Billing
   - Add a payment method
   - Set up usage limits to control costs
   - **Recommended**: Set a monthly limit (e.g., $10-20 for development)

3. **Create an API Key**
   - Go to API Keys section
   - Click "Create new secret key"
   - Give it a name (e.g., "real-estate-dev")
   - Copy the key immediately (starts with `sk-`)
   - **Important**: You can't view the key again after creation

4. **Add to `.env.local`**:
   ```env
   OPENAI_API_KEY=sk-your_api_key_here
   ```

### Cost Considerations:

- **GPT-4o mini**: ~$0.150 per 1M input tokens, ~$0.600 per 1M output tokens
- **text-embedding-3-small**: ~$0.020 per 1M tokens
- Expected monthly costs for development: $5-15
- Expected monthly costs for production: Depends on usage

### Rate Limits:

New accounts have rate limits:
- GPT-4o mini: 200 requests/min, 40,000 tokens/min
- Embeddings: 500 requests/min

---

## 4. Verify Connections

After setting up all services, verify they're working correctly:

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Check the console** for:
   - Redis connection messages
   - No error messages about missing environment variables
   - Successful server startup on http://localhost:3000

3. **Test each service**:
   - **Supabase**: Check if the app loads without database errors
   - **Redis**: Connection log should show "Redis connected successfully"
   - **OpenAI**: Will be tested when implementing AI features

---

## 5. Security Best Practices

- ✅ Never commit `.env.local` to version control
- ✅ Never share your `SUPABASE_SERVICE_ROLE_KEY` publicly
- ✅ Never share your `OPENAI_API_KEY` publicly
- ✅ Use environment variables, never hardcode credentials
- ✅ Set usage limits on OpenAI to prevent unexpected charges
- ✅ Rotate API keys periodically
- ✅ Use separate projects/keys for development and production

---

## 6. Troubleshooting

### Supabase Connection Issues
- Verify the project URL is correct (should start with `https://`)
- Check if your IP is allowed (Supabase may restrict access)
- Ensure keys are copied correctly without extra spaces

### Redis Connection Issues
- Check if Redis is running: `redis-cli ping`
- Verify the REDIS_URL format
- For local: `redis://localhost:6379`
- For TLS: `rediss://...` (note the double 's')

### OpenAI API Issues
- Verify API key starts with `sk-`
- Check billing is set up and has funds
- Verify rate limits haven't been exceeded
- Check OpenAI status page: [https://status.openai.com](https://status.openai.com)

---

## 7. Environment Variables Summary

After completing all steps, your `.env.local` should look like this:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI Configuration
OPENAI_API_KEY=sk-your_api_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379  # or your cloud Redis URL

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 8. Sentry Setup (Production Monitoring)

Sentry provides error tracking and performance monitoring for production.

### Steps:

1. **Create a Sentry Account**
   - Go to [https://sentry.io](https://sentry.io)
   - Sign up for a free account

2. **Create a New Project**
   - Select "Next.js" as the platform
   - Follow the setup wizard

3. **Get Credentials**
   - **DSN**: Found in Project Settings > Client Keys (DSN)
   - **Organization**: Your Sentry organization slug
   - **Project**: Your project name
   - **Auth Token**: Settings > Auth Tokens > Create New Token

4. **Add to `.env.local`**:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_ORG=your-organization
   SENTRY_PROJECT=your-project
   SENTRY_AUTH_TOKEN=sntrys_xxx
   ```

> **Note**: Sentry is optional but highly recommended for production deployments.

---

## 9. Production Environment Variables Summary

For production deployment, your environment should include:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=sk-your_api_key

# Redis (Upstash)
REDIS_URL=rediss://default:password@endpoint.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_rest_token

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
ADMIN_API_KEY=your-secure-random-key
CRON_SECRET=your-cron-secret

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=sntrys_xxx

# Version
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## Next Steps

Once all services are configured:
1. Restart your development server
2. For local development, see the main README.md
3. For production deployment, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

If you encounter any issues, check the troubleshooting section or the main README.md for support resources.
