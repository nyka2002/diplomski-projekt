/**
 * Queue Module Exports
 */

// Types
export * from './types';

// Queue management
export {
  getScrapeQueue,
  getQueueEvents,
  addFullScrapeJob,
  addSourceScrapeJob,
  addListingTypeScrapeJob,
  getQueueStatus,
  getRecentJobs,
  getJob,
  cancelJob,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  closeQueue,
} from './scrape-queue';

// Scheduler
export {
  setupScheduledJobs,
  removeScheduledJobs,
  getScheduledJobs,
} from './scheduler';

// Worker
export { createWorker, startWorker } from './workers/scrape-worker';
