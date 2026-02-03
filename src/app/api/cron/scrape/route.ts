/**
 * Vercel Cron Endpoint for Scraping
 *
 * GET /api/cron/scrape
 * Called by Vercel Cron Jobs to trigger scraping
 *
 * Query parameters:
 * - type: 'full' | 'rent' | 'sale' (default: 'full')
 *
 * Security: Vercel automatically adds CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addFullScrapeJob,
  addListingTypeScrapeJob,
} from '@/services/queue';

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronRequest(request: NextRequest): boolean {
  // In development, allow without secret
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Vercel automatically adds this header for cron jobs
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('⚠️  CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'full';

  try {
    let job;
    let message: string;

    switch (type) {
      case 'full':
        job = await addFullScrapeJob();
        message = 'Full scrape job queued via cron';
        break;

      case 'rent':
        job = await addListingTypeScrapeJob('rent');
        message = 'Rental scrape job queued via cron';
        break;

      case 'sale':
        job = await addListingTypeScrapeJob('sale');
        message = 'Sale scrape job queued via cron';
        break;

      default:
        return NextResponse.json(
          { error: `Invalid type: ${type}. Use 'full', 'rent', or 'sale'` },
          { status: 400 }
        );
    }

    if (!job) {
      console.error('Cron: Queue not available');
      return NextResponse.json(
        { error: 'Queue not available. Check Redis connection.' },
        { status: 503 }
      );
    }

    console.log(`✅ Cron triggered: ${message} (job: ${job.id})`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron scrape error:', error);

    return NextResponse.json(
      {
        error: 'Failed to queue scrape job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
