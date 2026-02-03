# Scraper Documentation

This document describes the web scraping system used to collect real estate listings.

## Overview

The scraping system uses Playwright to extract listings from multiple Croatian real estate websites. It runs as a separate worker process to avoid Vercel's serverless limitations.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Vercel Cron    │────▶│  Redis Queue    │────▶│ Railway Worker  │
│  (Triggers)     │     │  (BullMQ)       │     │  (Playwright)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │    Supabase     │
                                                │   (Database)    │
                                                └─────────────────┘
```

## Supported Sources

### 1. Njuškalo (`njuskalo`)

- **URL**: [njuskalo.hr](https://www.njuskalo.hr)
- **Coverage**: Apartments and houses for rent and sale
- **Location**: Croatia-wide

### 2. Index Oglasi (`index-oglasi`)

- **URL**: [index.hr/oglasi](https://www.index.hr/oglasi)
- **Coverage**: Apartments and houses for rent and sale
- **Location**: Croatia-wide

---

## Scraper Configuration

### File Structure

```
src/services/scraping/
├── base/
│   ├── index.ts           # Base scraper class
│   ├── rate-limiter.ts    # Request throttling
│   └── retry-handler.ts   # Retry logic
├── browser/
│   └── index.ts           # Browser pool management
├── scrapers/
│   ├── index.ts           # Scraper registry
│   ├── njuskalo/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   └── parser.ts
│   └── index-oglasi/
│       ├── index.ts
│       ├── config.ts
│       └── parser.ts
└── normalizers/
    ├── price-normalizer.ts
    ├── location-normalizer.ts
    └── amenity-mapper.ts
```

### Rate Limiting

Each scraper respects rate limits to avoid IP bans:

```typescript
const RATE_LIMITS = {
  njuskalo: {
    requestsPerMinute: 20,
    delayBetweenPages: 2000, // ms
  },
  'index-oglasi': {
    requestsPerMinute: 30,
    delayBetweenPages: 1500,
  },
};
```

### Retry Configuration

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};
```

---

## Adding a New Scraper

### Step 1: Create Scraper Directory

```bash
mkdir -p src/services/scraping/scrapers/new-source
```

### Step 2: Create Configuration

```typescript
// src/services/scraping/scrapers/new-source/config.ts
export const CONFIG = {
  name: 'new-source',
  baseUrl: 'https://example.com',
  listingTypes: ['rent', 'sale'],
  propertyTypes: ['apartment', 'house'],
  selectors: {
    listingContainer: '.listing-item',
    title: '.listing-title',
    price: '.listing-price',
    location: '.listing-location',
    details: '.listing-details',
    nextPage: '.pagination-next',
  },
  rateLimit: {
    requestsPerMinute: 20,
    delayBetweenPages: 2000,
  },
};
```

### Step 3: Implement Parser

```typescript
// src/services/scraping/scrapers/new-source/parser.ts
import { Page } from 'playwright';
import { RawListing } from '@/types/listing';

export async function parseListingPage(page: Page): Promise<RawListing[]> {
  const listings: RawListing[] = [];

  const items = await page.$$('.listing-item');

  for (const item of items) {
    const title = await item.$eval('.title', (el) => el.textContent);
    const price = await item.$eval('.price', (el) => el.textContent);
    // ... extract other fields

    listings.push({
      title,
      price,
      // ...
    });
  }

  return listings;
}
```

### Step 4: Create Scraper Class

```typescript
// src/services/scraping/scrapers/new-source/index.ts
import { BaseScraper } from '../../base';
import { CONFIG } from './config';
import { parseListingPage } from './parser';

export class NewSourceScraper extends BaseScraper {
  constructor(listingType: 'rent' | 'sale', propertyType: 'apartment' | 'house') {
    super({
      source: 'new-source',
      listingType,
      propertyType,
      ...CONFIG,
    });
  }

  protected async parseListings(page: Page): Promise<RawListing[]> {
    return parseListingPage(page);
  }

  protected buildUrl(page: number): string {
    return `${CONFIG.baseUrl}/listings?page=${page}`;
  }
}
```

### Step 5: Register Scraper

```typescript
// src/services/scraping/scrapers/index.ts
import { NewSourceScraper } from './new-source';

export const AVAILABLE_SOURCES = ['njuskalo', 'index-oglasi', 'new-source'] as const;

export function getScraperForSource(config: ScraperConfig): BaseScraper {
  switch (config.source) {
    case 'new-source':
      return new NewSourceScraper(config.listingType, config.propertyType);
    // ...
  }
}
```

---

## Data Normalization

### Price Normalization

Prices are normalized to EUR:

```typescript
// HRK to EUR conversion (historical rate before EUR adoption)
const HRK_TO_EUR = 7.5345;

function normalizePrice(price: string, currency: string): number {
  const numericPrice = parseFloat(price.replace(/[^\d.]/g, ''));

  if (currency === 'HRK' || currency === 'kn') {
    return Math.round(numericPrice / HRK_TO_EUR);
  }

  return numericPrice;
}
```

### Location Normalization

City names are standardized:

```typescript
const CITY_ALIASES = {
  'zg': 'Zagreb',
  'zagreb': 'Zagreb',
  'st': 'Split',
  'split': 'Split',
  // ...
};
```

### Amenity Mapping

Amenities are mapped to standard keys:

```typescript
const AMENITY_MAPPINGS = {
  'parking': ['parking', 'parkirno mjesto', 'garaža'],
  'balcony': ['balkon', 'terasa', 'lođa'],
  'furnished': ['namješteno', 'opremljeno'],
  // ...
};
```

---

## Job Queue

### Job Types

1. **full_scrape**: Scrape all sources, all listing types
2. **single_source**: Scrape specific source and listing type
3. **listing_type_scrape**: Scrape all sources for a listing type

### Creating Jobs

```typescript
import { addFullScrapeJob, addSourceScrapeJob } from '@/services/queue';

// Full scrape
await addFullScrapeJob();

// Single source
await addSourceScrapeJob('njuskalo', 'rent', 'apartment', 5);

// Listing type
await addListingTypeScrapeJob('rent');
```

### Scheduled Jobs

Configured in the scheduler:

```typescript
// Full scrape every 6 hours
{ cron: '0 */6 * * *', type: 'full_scrape' }

// Rental listings every 2 hours
{ cron: '0 */2 * * *', type: 'listing_type_scrape', listingType: 'rent' }
```

---

## Running the Worker

### Local Development

```bash
# Start Redis (if not using Upstash)
docker run -p 6379:6379 redis

# Run the worker
npm run worker:scrape
```

### Production (Railway)

The worker runs automatically via the Dockerfile:

```dockerfile
CMD ["npx", "tsx", "src/services/queue/workers/scrape-worker.ts"]
```

---

## Monitoring

### Logs

The worker outputs detailed logs:

```
🚀 Starting job job-123: full_scrape
📋 Running 4 scraper(s)
✅ njuskalo (rent apartment): 45 saved, 12 duplicates, 0 errors
✅ njuskalo (sale apartment): 38 saved, 8 duplicates, 1 errors
✅ index-oglasi (rent apartment): 32 saved, 5 duplicates, 0 errors
✅ index-oglasi (sale apartment): 28 saved, 3 duplicates, 0 errors
🏁 Job job-123 completed: 143 saved, 28 duplicates, 1 errors
```

### Admin Dashboard

View scraping status at `/admin`:
- Queue status (waiting, active, completed, failed)
- Listings by source
- Manual trigger controls

### Sentry

Errors are automatically reported to Sentry (if configured).

---

## Troubleshooting

### Website Structure Changed

If a website changes its HTML structure:

1. Update selectors in the scraper's `config.ts`
2. Test locally with a small batch
3. Deploy updated worker

### IP Blocked

If getting blocked:

1. Increase delays in rate limiter
2. Consider using proxy rotation
3. Check if user-agent needs updating

### Playwright Issues

Browser launch failures:

```bash
# Reinstall browsers
npx playwright install chromium --with-deps
```

### Memory Issues

If worker runs out of memory:

1. Reduce concurrent scrapers
2. Increase Railway memory allocation
3. Process smaller batches

---

## Best Practices

1. **Respect robots.txt**: Check allowed paths
2. **Use delays**: Don't hammer servers
3. **Handle errors gracefully**: Log and continue
4. **Validate data**: Check for required fields
5. **Deduplicate**: Use external_id to avoid duplicates
6. **Monitor**: Watch for failures and data quality
