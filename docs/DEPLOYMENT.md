# Deployment Guide

This guide covers deploying the Real Estate Agent application to production using Vercel (frontend/API) and Railway (scraping worker).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Next.js    │  │   API Routes │  │ Vercel Cron  │       │
│  │   Frontend   │  │   /api/*     │  │ (triggers)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
           │                  │                 │
           ▼                  ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│     Supabase     │  │  Upstash Redis   │  │     Railway      │
│  PostgreSQL +    │  │  Cache + Queue   │  │  Scrape Worker   │
│  pgvector + Auth │  │                  │  │  (Playwright)    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Prerequisites

Before deploying, you need accounts with:

1. **Vercel** - [vercel.com](https://vercel.com) (free tier available)
2. **Supabase** - [supabase.com](https://supabase.com) (free tier available)
3. **Upstash** - [upstash.com](https://upstash.com) (free tier available)
4. **Railway** - [railway.app](https://railway.app) (for scraping worker)
5. **OpenAI** - [platform.openai.com](https://platform.openai.com) (API access)
6. **Sentry** (optional) - [sentry.io](https://sentry.io) (error tracking)

---

## Step 1: Set Up Supabase

Your Supabase project should already be configured from development. Verify:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Project Settings > API
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Run Migrations (if not already done)

```bash
# Connect to your Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
npx supabase db push
```

---

## Step 2: Set Up Upstash Redis

1. Go to [Upstash Console](https://console.upstash.com)
2. Create a new Redis database
   - Select a region close to your Vercel deployment (e.g., Frankfurt for `fra1`)
   - Enable TLS
3. Get your credentials:
   - **REST URL** → `UPSTASH_REDIS_REST_URL`
   - **REST Token** → `UPSTASH_REDIS_REST_TOKEN`
   - **Redis URL** (ioredis format) → `REDIS_URL`
     - Format: `rediss://default:PASSWORD@ENDPOINT:6379`

---

## Step 3: Set Up Sentry (Optional)

1. Go to [Sentry](https://sentry.io) and create a new project
2. Select Next.js as the platform
3. Get your credentials:
   - **DSN** → `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
   - **Organization** → `SENTRY_ORG`
   - **Project** → `SENTRY_PROJECT`
4. Create an auth token at Settings > Auth Tokens → `SENTRY_AUTH_TOKEN`

---

## Step 4: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Redis (Upstash)
REDIS_URL=rediss://default:...@....upstash.io:6379
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
ADMIN_API_KEY=your-secure-random-key
CRON_SECRET=your-cron-secret

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=sntrys_...

# Version
NEXT_PUBLIC_APP_VERSION=1.0.0
```

5. Click "Deploy"

### Option B: Via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Configure Custom Domain (Optional)

1. In Vercel Dashboard, go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS at your domain registrar
4. Update `NEXT_PUBLIC_APP_URL` to your domain

---

## Step 5: Deploy Scraping Worker to Railway

The scraping worker runs Playwright and cannot run on Vercel's serverless environment.

### Setup Railway

1. Go to [Railway](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Configure the deployment:
   - **Build Command**: Use Dockerfile at `worker/Dockerfile`
   - Or select "Docker" and point to `worker/Dockerfile`

### Configure Environment Variables

In Railway, add these environment variables:

```env
# Redis (same as Vercel)
REDIS_URL=rediss://default:...@....upstash.io:6379

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Environment
NODE_ENV=production

# Sentry (optional)
SENTRY_DSN=https://...@sentry.io/...
```

### Deploy

1. Railway will automatically build and deploy using the Dockerfile
2. Monitor the logs to ensure the worker starts correctly
3. You should see: `🔧 Scrape worker started`

---

## Step 6: Verify Deployment

### Check Application

1. Visit your Vercel URL
2. Test the chat functionality
3. Test user authentication

### Check Worker

1. Go to Railway logs
2. Verify worker is running and connected to Redis
3. Trigger a manual scrape from the admin dashboard (`/admin`)

### Check Cron Jobs

Vercel cron jobs are configured in `vercel.json`:
- Full scrape: Every 6 hours
- Rental scrape: Every 2 hours

View cron status in Vercel Dashboard > Project > Settings > Cron Jobs

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `REDIS_URL` | Yes | Redis connection URL (ioredis format) |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash REST API token |
| `NEXT_PUBLIC_APP_URL` | Yes | Application public URL |
| `ADMIN_API_KEY` | Yes | API key for admin endpoints |
| `CRON_SECRET` | Yes | Secret for Vercel cron jobs |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN (client) |
| `SENTRY_DSN` | No | Sentry DSN (server) |
| `SENTRY_ORG` | No | Sentry organization |
| `SENTRY_PROJECT` | No | Sentry project |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token |
| `NEXT_PUBLIC_APP_VERSION` | No | App version for tracking |

---

## Troubleshooting

### Build Fails on Vercel

- Check that all required environment variables are set
- Ensure Playwright is not imported in serverless functions
- Check build logs for specific errors

### Worker Not Processing Jobs

1. Verify Redis connection in Railway logs
2. Check that the Redis URL is the ioredis format (`rediss://...`)
3. Ensure the worker has the correct environment variables

### Cron Jobs Not Running

1. Check Vercel Dashboard > Settings > Cron Jobs
2. Verify `CRON_SECRET` is set and matches `vercel.json`
3. Check function logs for errors

### Database Connection Issues

1. Verify Supabase credentials are correct
2. Check if your IP is allowed (Supabase > Settings > Database)
3. Ensure service role key is used for admin operations

### Redis Connection Issues

1. Verify Upstash credentials
2. Check that TLS is enabled on Upstash
3. Use the correct URL format for each client:
   - ioredis: `rediss://default:PASSWORD@ENDPOINT:6379`
   - REST: `https://ENDPOINT.upstash.io`

---

## Monitoring

### Vercel Analytics

Automatically enabled. View at Vercel Dashboard > Analytics

### Sentry

If configured, view errors at [sentry.io](https://sentry.io)

### Admin Dashboard

Access at `/admin` to view:
- System status
- Listing statistics
- Queue status
- Manual scraping controls

---

## Updating the Application

### Automatic Deployments

Push to your main branch to trigger automatic deployments on Vercel.

### Manual Deployments

```bash
vercel --prod
```

### Worker Updates

Railway automatically redeploys when you push changes to the repository.

---

## Cost Considerations

### Free Tiers

- **Vercel**: Hobby plan is free for personal projects
- **Supabase**: Free tier includes 500MB database
- **Upstash**: Free tier includes 10K commands/day
- **Railway**: $5 free credits/month

### Production Costs (Estimated)

- **Vercel Pro**: ~$20/month
- **Supabase Pro**: ~$25/month
- **Upstash Pay-as-you-go**: ~$5-10/month
- **Railway**: ~$5-10/month
- **OpenAI**: Variable based on usage

### Reducing Costs

1. Enable caching to reduce API calls
2. Limit scraping frequency
3. Use smaller embedding models if possible
4. Monitor and set usage limits
