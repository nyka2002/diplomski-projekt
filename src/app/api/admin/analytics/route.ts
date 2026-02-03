/**
 * Admin Analytics API
 *
 * GET /api/admin/analytics
 * Returns system statistics for the admin dashboard
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cache } from '@/lib/redis';
import { getQueueStatus } from '@/services/queue';

interface SourceRow {
  source: string;
}

interface ListingTypeRow {
  listing_type: string;
}

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Fetch database statistics in parallel
    const [
      listingsCount,
      listingsBySource,
      listingsByType,
      recentListings,
      searchesCount,
      recentSearches,
    ] = await Promise.all([
      // Total listings count
      supabaseAdmin
        .from('listings')
        .select('*', { count: 'exact', head: true }),

      // Listings by source
      supabaseAdmin
        .from('listings')
        .select('source')
        .then(({ data }: { data: SourceRow[] | null }) => {
          const counts: Record<string, number> = {};
          data?.forEach((row: SourceRow) => {
            counts[row.source] = (counts[row.source] || 0) + 1;
          });
          return counts;
        }),

      // Listings by type
      supabaseAdmin
        .from('listings')
        .select('listing_type')
        .then(({ data }: { data: ListingTypeRow[] | null }) => {
          const counts: Record<string, number> = {};
          data?.forEach((row: ListingTypeRow) => {
            counts[row.listing_type] = (counts[row.listing_type] || 0) + 1;
          });
          return counts;
        }),

      // Recent listings (last 24h)
      supabaseAdmin
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Total searches count
      supabaseAdmin
        .from('user_searches')
        .select('*', { count: 'exact', head: true }),

      // Recent searches (last 24h)
      supabaseAdmin
        .from('user_searches')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Get queue status
    let queueStatus = null;
    try {
      queueStatus = await getQueueStatus();
    } catch {
      // Queue not available
    }

    // Check Redis status
    const redisConnected = cache.isAvailable();
    const redisType = cache.getClientType();

    return NextResponse.json({
      database: {
        totalListings: listingsCount.count || 0,
        listingsBySource,
        listingsByType,
        recentListings: recentListings.count || 0,
      },
      scraping: {
        queueStatus,
        lastJobTime: null, // Would need to track this separately
      },
      searches: {
        totalSearches: searchesCount.count || 0,
        recentSearches: recentSearches.count || 0,
      },
      system: {
        redisConnected,
        redisType,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
