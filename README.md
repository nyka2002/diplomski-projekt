# Real Estate Agent - AI-Powered Property Search

An AI-powered web application that aggregates real estate listings from multiple sources and enables natural language search using GPT-4o mini and semantic embeddings.

## Features

- **Natural Language Search**: Search for properties using conversational queries
- **Multi-Source Aggregation**: Scrapes and normalizes listings from multiple websites
- **AI-Powered Ranking**: Semantic search with embeddings and intelligent ranking
- **Conversational AI**: Follow-up questions and query refinement
- **User Accounts**: Save searches and favorite listings
- **Real-time Updates**: Periodic scraping for fresh listings
- **Admin Dashboard**: Monitor system health and trigger scraping

## Tech Stack

- **Frontend & Backend**: Next.js 15 with TypeScript and App Router
- **Database**: Supabase (PostgreSQL with pgvector for semantic search)
- **AI**: OpenAI GPT-4o mini and text-embedding-3-small
- **Scraping**: Playwright (runs on Railway worker)
- **Cache/Queue**: Redis (Upstash) with BullMQ
- **Monitoring**: Sentry, Vercel Analytics

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key

## Quick Start

1. **Clone the repository**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your credentials (see [SETUP_SERVICES.md](SETUP_SERVICES.md))

4. **Run database migrations**:
   ```bash
   npx supabase db push
   ```

5. **Install Playwright browsers** (for local scraping):
   ```bash
   npx playwright install chromium
   ```

6. **Run the development server**:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/
├── src/
│   ├── app/              # Next.js App Router (pages and API routes)
│   ├── components/       # React components
│   ├── lib/             # Utility functions and service clients
│   ├── types/           # TypeScript type definitions
│   └── services/        # Business logic
│       ├── scraping/    # Web scraping modules
│       ├── ai/          # AI and OpenAI services
│       ├── search/      # Semantic search logic
│       └── queue/       # Job queue management
├── worker/              # Scraping worker (Railway)
├── docs/                # Documentation
├── supabase/            # Database migrations
└── tests/               # Test files
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | TypeScript type checking |
| `npm run worker:scrape` | Run scraping worker locally |
| `npm run test` | Run all tests |
| `npm run test:e2e` | Run E2E tests |

## Current Status

**All phases complete!**

- [x] Phase 1: Project Setup & Infrastructure
- [x] Phase 2: Database Schema & Setup
- [x] Phase 3: Web Scraping Module
- [x] Phase 4: AI Integration Layer
- [x] Phase 5: Backend API Development
- [x] Phase 6: Frontend Development
- [x] Phase 7: Integration & Testing
- [x] Phase 8: Deployment & Monitoring

## Admin Dashboard

Access the admin dashboard at `/admin` to:
- View system statistics
- Monitor scraping queue
- Trigger manual scrapes
- View error rates

## Contributing

This is a thesis/seminar project. Contributions are currently not being accepted.

## License

This project is for educational purposes.
