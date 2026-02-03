/**
 * Scrape Queue
 *
 * BullMQ-based job queue for scraping operations.
 * Provides queue management and job creation utilities.
 */

import { Queue, Job, QueueEvents } from 'bullmq';
import { env } from '@/lib/env';
import { ScrapeJobData, ScrapeJobResult, QueueStats } from './types';
import { ListingType, PropertyType } from '@/types/listing';

const QUEUE_NAME = 'scrape-jobs';

// Connection configuration for BullMQ
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

// Create queue instance (lazy initialization)
let _scrapeQueue: Queue<ScrapeJobData, ScrapeJobResult> | null = null;
let _queueEvents: QueueEvents | null = null;

/**
 * Get the scrape queue instance
 */
export function getScrapeQueue(): Queue<ScrapeJobData, ScrapeJobResult> | null {
  if (_scrapeQueue) return _scrapeQueue;

  const connection = getConnection();
  if (!connection) {
    console.warn('⚠️  Redis not configured - queue disabled');
    return null;
  }

  try {
    _scrapeQueue = new Queue<ScrapeJobData, ScrapeJobResult>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute initial delay
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500, // Keep max 500 failed jobs
        },
      },
    });

    console.log('✅ Scrape queue initialized');
    return _scrapeQueue;
  } catch (error) {
    console.error('Failed to create scrape queue:', error);
    return null;
  }
}

/**
 * Get queue events for monitoring
 */
export function getQueueEvents(): QueueEvents | null {
  if (_queueEvents) return _queueEvents;

  const connection = getConnection();
  if (!connection) return null;

  try {
    _queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    return _queueEvents;
  } catch (error) {
    console.error('Failed to create queue events:', error);
    return null;
  }
}

// ============================================================================
// JOB CREATION HELPERS
// ============================================================================

/**
 * Add a full scrape job (all sources, all types)
 */
export async function addFullScrapeJob(): Promise<Job<ScrapeJobData, ScrapeJobResult> | null> {
  const queue = getScrapeQueue();
  if (!queue) return null;

  return queue.add(
    'full-scrape',
    {
      type: 'full_scrape',
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: `full-scrape-${Date.now()}`,
    }
  );
}

/**
 * Add a single source scrape job
 */
export async function addSourceScrapeJob(
  source: string,
  listingType: ListingType,
  propertyType: PropertyType = 'apartment',
  maxPages?: number
): Promise<Job<ScrapeJobData, ScrapeJobResult> | null> {
  const queue = getScrapeQueue();
  if (!queue) return null;

  return queue.add(
    `scrape-${source}-${listingType}-${propertyType}`,
    {
      type: 'single_source',
      source,
      listingType,
      propertyType,
      maxPages,
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: `${source}-${listingType}-${propertyType}-${Date.now()}`,
    }
  );
}

/**
 * Add a listing type scrape job (all sources for a listing type)
 */
export async function addListingTypeScrapeJob(
  listingType: ListingType
): Promise<Job<ScrapeJobData, ScrapeJobResult> | null> {
  const queue = getScrapeQueue();
  if (!queue) return null;

  return queue.add(
    `scrape-${listingType}`,
    {
      type: 'listing_type_scrape',
      listingType,
      triggeredBy: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: `${listingType}-scrape-${Date.now()}`,
    }
  );
}

// ============================================================================
// QUEUE STATUS HELPERS
// ============================================================================

/**
 * Get queue statistics
 */
export async function getQueueStatus(): Promise<QueueStats | null> {
  const queue = getScrapeQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get recent jobs
 */
export async function getRecentJobs(
  limit = 10
): Promise<Job<ScrapeJobData, ScrapeJobResult>[]> {
  const queue = getScrapeQueue();
  if (!queue) return [];

  const jobs = await queue.getJobs(
    ['completed', 'failed', 'active', 'waiting', 'delayed'],
    0,
    limit - 1
  );

  return jobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Get a specific job by ID
 */
export async function getJob(
  jobId: string
): Promise<Job<ScrapeJobData, ScrapeJobResult> | null> {
  const queue = getScrapeQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  return job || null;
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const queue = getScrapeQueue();
  if (!queue) return false;

  const job = await queue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'active') {
    // Can't cancel active jobs directly
    return false;
  }

  await job.remove();
  return true;
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getScrapeQueue();
  if (queue) {
    await queue.pause();
  }
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getScrapeQueue();
  if (queue) {
    await queue.resume();
  }
}

/**
 * Clean up old jobs
 */
export async function cleanQueue(grace: number = 86400000): Promise<void> {
  const queue = getScrapeQueue();
  if (queue) {
    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace * 7, 500, 'failed');
  }
}

/**
 * Close the queue connection
 */
export async function closeQueue(): Promise<void> {
  if (_queueEvents) {
    await _queueEvents.close();
    _queueEvents = null;
  }
  if (_scrapeQueue) {
    await _scrapeQueue.close();
    _scrapeQueue = null;
  }
}
