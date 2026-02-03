/**
 * Scraping Trigger API
 *
 * POST /api/admin/scraping/trigger
 * Manually trigger a scraping job
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addFullScrapeJob,
  addSourceScrapeJob,
  addListingTypeScrapeJob,
} from '@/services/queue';
import { ListingType, PropertyType } from '@/types/listing';

/**
 * Check if request is authorized via API key
 */
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.warn('⚠️  ADMIN_API_KEY not configured - admin endpoints disabled');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedKey = authHeader.slice(7); // Remove 'Bearer ' prefix
  return providedKey === expectedKey;
}

/**
 * Request body for trigger endpoint
 */
interface TriggerRequest {
  /** Type of scrape: 'full', 'single', 'listing_type' */
  type: 'full' | 'single' | 'listing_type';
  /** Source (required for 'single' type) */
  source?: string;
  /** Listing type (required for 'single' and 'listing_type') */
  listingType?: ListingType;
  /** Property type (optional for 'single') */
  propertyType?: PropertyType;
  /** Max pages to scrape (optional) */
  maxPages?: number;
}

export async function POST(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide valid Bearer token.' },
      { status: 401 }
    );
  }

  try {
    const body: TriggerRequest = await request.json();
    const { type, source, listingType, propertyType, maxPages } = body;

    let job;
    let message: string;

    switch (type) {
      case 'full':
        job = await addFullScrapeJob();
        message = 'Full scrape job queued';
        break;

      case 'single':
        if (!source || !listingType) {
          return NextResponse.json(
            {
              error: 'Missing required fields for single scrape',
              required: ['source', 'listingType'],
            },
            { status: 400 }
          );
        }
        job = await addSourceScrapeJob(
          source,
          listingType,
          propertyType || 'apartment',
          maxPages
        );
        message = `Single source scrape job queued: ${source} (${listingType} ${propertyType || 'apartment'})`;
        break;

      case 'listing_type':
        if (!listingType) {
          return NextResponse.json(
            {
              error: 'Missing required field: listingType',
            },
            { status: 400 }
          );
        }
        job = await addListingTypeScrapeJob(listingType);
        message = `Listing type scrape job queued: ${listingType}`;
        break;

      default:
        return NextResponse.json(
          {
            error: 'Invalid type. Must be: full, single, or listing_type',
          },
          { status: 400 }
        );
    }

    if (!job) {
      return NextResponse.json(
        {
          error: 'Queue not available. Check Redis connection.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message,
      data: job.data,
    });
  } catch (error) {
    console.error('Error triggering scrape:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to show usage information
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'POST /api/admin/scraping/trigger',
    description: 'Trigger a scraping job',
    authentication: 'Bearer token (ADMIN_API_KEY)',
    body: {
      type: {
        required: true,
        values: ['full', 'single', 'listing_type'],
        description: 'Type of scrape job to run',
      },
      source: {
        required: 'for single type',
        values: ['njuskalo', 'index-oglasi'],
        description: 'Source website to scrape',
      },
      listingType: {
        required: 'for single and listing_type',
        values: ['rent', 'sale'],
        description: 'Type of listings',
      },
      propertyType: {
        required: false,
        values: ['apartment', 'house'],
        default: 'apartment',
        description: 'Type of property',
      },
      maxPages: {
        required: false,
        type: 'number',
        description: 'Maximum pages to scrape per source',
      },
    },
    examples: [
      {
        description: 'Full scrape (all sources, all types)',
        body: { type: 'full' },
      },
      {
        description: 'Single source scrape',
        body: {
          type: 'single',
          source: 'njuskalo',
          listingType: 'rent',
          propertyType: 'apartment',
        },
      },
      {
        description: 'All rental listings',
        body: { type: 'listing_type', listingType: 'rent' },
      },
    ],
  });
}
