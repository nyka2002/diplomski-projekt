/**
 * Scraping Status API
 *
 * GET /api/admin/scraping/status
 * Get queue status and recent jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQueueStatus,
  getRecentJobs,
  getScheduledJobs,
} from '@/services/queue';

export async function GET(request: NextRequest) {
  try {
    // Get queue statistics
    const queueStatus = await getQueueStatus();

    if (!queueStatus) {
      return NextResponse.json(
        {
          error: 'Queue not available. Check Redis connection.',
          queueAvailable: false,
        },
        { status: 503 }
      );
    }

    // Get recent jobs
    const recentJobs = await getRecentJobs(10);

    // Get scheduled jobs
    const scheduledJobs = await getScheduledJobs();

    // Format job data for response
    const formattedJobs = await Promise.all(
      recentJobs.map(async (job) => {
        const state = await job.getState();
        const progress = job.progress as Record<string, unknown> | undefined;

        return {
          id: job.id,
          name: job.name,
          state,
          progress,
          data: {
            type: job.data.type,
            source: job.data.source,
            listingType: job.data.listingType,
            propertyType: job.data.propertyType,
            triggeredBy: job.data.triggeredBy,
          },
          result: job.returnvalue
            ? {
                totalListingsScraped: job.returnvalue.totalListingsScraped,
                totalListingsSaved: job.returnvalue.totalListingsSaved,
                totalDuplicates: job.returnvalue.totalDuplicates,
                totalErrors: job.returnvalue.totalErrors,
                duration: job.returnvalue.duration,
              }
            : null,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        };
      })
    );

    return NextResponse.json({
      queueAvailable: true,
      queue: queueStatus,
      scheduledJobs: scheduledJobs.map((job) => ({
        name: job.name,
        cron: job.cron,
        nextRun: job.next.toISOString(),
      })),
      recentJobs: formattedJobs,
    });
  } catch (error) {
    console.error('Error fetching scraping status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
