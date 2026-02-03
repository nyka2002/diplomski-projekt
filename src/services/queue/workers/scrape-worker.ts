/**
 * Scrape Worker
 *
 * BullMQ worker that processes scraping jobs.
 * This can be run as a separate process for production deployments.
 */

import { Worker, Job } from 'bullmq';
import { env } from '@/lib/env';
import {
  ScrapeJobData,
  ScrapeJobResult,
  JobProgress,
  SourceResult,
} from '../types';
import { browserPool } from '../../scraping/browser';
import {
  getScraperForSource,
  getAllScrapers,
  getScrapersForListingType,
  AVAILABLE_SOURCES,
} from '../../scraping/scrapers';
import { BaseScraper } from '../../scraping/base';

const QUEUE_NAME = 'scrape-jobs';

// Connection configuration
const getConnection = () => {
  if (!env.REDIS_URL) {
    return null;
  }

  return {
    host: new URL(env.REDIS_URL).hostname,
    port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
    password: new URL(env.REDIS_URL).password || undefined,
    maxRetriesPerRequest: null as null, // Required for BullMQ
  };
};

/**
 * Process a scrape job
 */
async function processJob(
  job: Job<ScrapeJobData, ScrapeJobResult>
): Promise<ScrapeJobResult> {
  const { type, source, listingType, propertyType, maxPages } = job.data;
  const startTime = Date.now();
  const sourceResults: SourceResult[] = [];

  console.log(`🚀 Starting job ${job.id}: ${type}`);

  // Initialize browser pool
  await browserPool.initialize();

  try {
    let scrapers: BaseScraper[] = [];

    // Determine which scrapers to run
    if (type === 'full_scrape') {
      scrapers = getAllScrapers();
    } else if (type === 'single_source' && source && listingType) {
      scrapers = [
        getScraperForSource({
          source: source as 'njuskalo' | 'index-oglasi',
          listingType,
          propertyType: propertyType || 'apartment',
        }),
      ];
    } else if (type === 'listing_type_scrape' && listingType) {
      scrapers = getScrapersForListingType(listingType);
    }

    // Apply maxPages override if specified
    if (maxPages) {
      scrapers = scrapers.map((scraper) => {
        const config = scraper.getConfig();
        config.maxPages = maxPages;
        return getScraperForSource({
          source: config.source as 'njuskalo' | 'index-oglasi',
          listingType: config.listingType,
          propertyType: config.propertyType,
        });
      });
    }

    console.log(`📋 Running ${scrapers.length} scraper(s)`);

    // Run each scraper
    for (let i = 0; i < scrapers.length; i++) {
      const scraper = scrapers[i];
      const config = scraper.getConfig();

      // Update job progress
      await job.updateProgress({
        currentScraper: i + 1,
        totalScrapers: scrapers.length,
        currentSource: config.source,
        currentListingType: config.listingType,
        currentPropertyType: config.propertyType || 'apartment',
        currentPage: 0,
        listingsProcessed: sourceResults.reduce((sum, r) => sum + r.listingsScraped, 0),
        status: 'running',
        message: `Scraping ${config.source} (${config.listingType} ${config.propertyType})`,
      } as JobProgress);

      try {
        const result = await scraper.scrape();

        sourceResults.push({
          source: config.source,
          listingType: config.listingType,
          propertyType: config.propertyType || 'apartment',
          listingsScraped: result.listingsScraped,
          listingsSaved: result.listingsSaved,
          duplicates: result.listingsDuplicate,
          errors: result.errors.length,
          duration: result.duration,
        });

        console.log(
          `✅ ${config.source} (${config.listingType} ${config.propertyType}): ` +
            `${result.listingsSaved} saved, ${result.listingsDuplicate} duplicates, ` +
            `${result.errors.length} errors`
        );
      } catch (error) {
        console.error(`❌ Error scraping ${config.source}:`, error);

        sourceResults.push({
          source: config.source,
          listingType: config.listingType,
          propertyType: config.propertyType || 'apartment',
          listingsScraped: 0,
          listingsSaved: 0,
          duplicates: 0,
          errors: 1,
          duration: 0,
        });
      }
    }

    // Calculate totals
    const totals = sourceResults.reduce(
      (acc, r) => ({
        scraped: acc.scraped + r.listingsScraped,
        saved: acc.saved + r.listingsSaved,
        duplicates: acc.duplicates + r.duplicates,
        errors: acc.errors + r.errors,
      }),
      { scraped: 0, saved: 0, duplicates: 0, errors: 0 }
    );

    const result: ScrapeJobResult = {
      jobId: job.id || '',
      type,
      sources: [...new Set(sourceResults.map((r) => r.source))],
      totalListingsScraped: totals.scraped,
      totalListingsSaved: totals.saved,
      totalDuplicates: totals.duplicates,
      totalErrors: totals.errors,
      sourceResults,
      duration: Date.now() - startTime,
      startedAt: job.data.triggeredAt,
      completedAt: new Date().toISOString(),
    };

    console.log(
      `🏁 Job ${job.id} completed: ` +
        `${totals.saved} saved, ${totals.duplicates} duplicates, ${totals.errors} errors`
    );

    return result;
  } finally {
    // Cleanup browser pool
    await browserPool.cleanup();
  }
}

/**
 * Create and start the worker
 */
export function createWorker(): Worker<ScrapeJobData, ScrapeJobResult> | null {
  const connection = getConnection();
  if (!connection) {
    console.warn('⚠️  Redis not configured - worker disabled');
    return null;
  }

  const worker = new Worker<ScrapeJobData, ScrapeJobResult>(
    QUEUE_NAME,
    processJob,
    {
      connection,
      concurrency: 1, // Only one scrape job at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute
      },
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job, progress) => {
    const p = progress as JobProgress;
    console.log(
      `📊 Job ${job.id} progress: ${p.currentScraper}/${p.totalScrapers} - ${p.message}`
    );
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('🔧 Scrape worker started');

  return worker;
}

/**
 * Start the worker (for standalone process)
 */
export function startWorker(): Worker<ScrapeJobData, ScrapeJobResult> | null {
  const worker = createWorker();

  if (worker) {
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, closing worker...');
      await worker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, closing worker...');
      await worker.close();
      process.exit(0);
    });
  }

  return worker;
}

// If this file is run directly, start the worker
if (require.main === module) {
  startWorker();
}
