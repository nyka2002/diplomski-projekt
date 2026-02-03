/**
 * Job Scheduler
 *
 * Sets up repeatable jobs for periodic scraping.
 */

import { getScrapeQueue } from './scrape-queue';

/**
 * Schedule configuration
 */
const SCHEDULES = {
  // Full scrape every 6 hours
  fullScrape: {
    cron: '0 */6 * * *', // At minute 0 of every 6th hour
    jobId: 'scheduled-full-scrape',
  },
  // Rental listings every 2 hours (more frequent for time-sensitive)
  rentalScrape: {
    cron: '0 */2 * * *', // At minute 0 of every 2nd hour
    jobId: 'scheduled-rental-scrape',
  },
} as const;

/**
 * Set up all scheduled jobs
 */
export async function setupScheduledJobs(): Promise<void> {
  const queue = getScrapeQueue();
  if (!queue) {
    console.warn('⚠️  Queue not available - scheduling disabled');
    return;
  }

  try {
    // Remove existing repeatable jobs first (to allow updates)
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    // Add full scrape job
    await queue.add(
      'scheduled-full-scrape',
      {
        type: 'full_scrape',
        triggeredBy: 'scheduler',
        triggeredAt: new Date().toISOString(),
      },
      {
        repeat: { pattern: SCHEDULES.fullScrape.cron },
        jobId: SCHEDULES.fullScrape.jobId,
      }
    );

    // Add rental scrape job (more frequent)
    await queue.add(
      'scheduled-rental-scrape',
      {
        type: 'listing_type_scrape',
        listingType: 'rent',
        triggeredBy: 'scheduler',
        triggeredAt: new Date().toISOString(),
      },
      {
        repeat: { pattern: SCHEDULES.rentalScrape.cron },
        jobId: SCHEDULES.rentalScrape.jobId,
      }
    );

    console.log('📅 Scheduled jobs configured:');
    console.log(`   - Full scrape: ${SCHEDULES.fullScrape.cron}`);
    console.log(`   - Rental scrape: ${SCHEDULES.rentalScrape.cron}`);
  } catch (error) {
    console.error('Failed to setup scheduled jobs:', error);
  }
}

/**
 * Remove all scheduled jobs
 */
export async function removeScheduledJobs(): Promise<void> {
  const queue = getScrapeQueue();
  if (!queue) return;

  try {
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }
    console.log('📅 All scheduled jobs removed');
  } catch (error) {
    console.error('Failed to remove scheduled jobs:', error);
  }
}

/**
 * Get current scheduled jobs
 */
export async function getScheduledJobs(): Promise<
  Array<{
    key: string;
    name: string;
    cron: string;
    next: Date;
  }>
> {
  const queue = getScrapeQueue();
  if (!queue) return [];

  try {
    const jobs = await queue.getRepeatableJobs();
    return jobs.map((job) => ({
      key: job.key,
      name: job.name || 'Unknown',
      cron: job.pattern || '',
      next: new Date(job.next || 0),
    }));
  } catch (error) {
    console.error('Failed to get scheduled jobs:', error);
    return [];
  }
}
