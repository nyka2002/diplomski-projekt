/**
 * Script to generate embeddings for all listings in the database
 *
 * Usage: npx tsx scripts/generate-embeddings.ts
 *
 * Options:
 *   --batch-size <number>  Number of listings to process per batch (default: 100)
 *   --force                Regenerate embeddings even for listings that already have them
 *   --dry-run              Show what would be done without making changes
 */

// Load .env.local first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Configuration
const DEFAULT_BATCH_SIZE = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const DELAY_BETWEEN_BATCHES_MS = 200;

// Parse command line arguments
const args = process.argv.slice(2);
const batchSize = parseInt(
  args.find((_, i, arr) => arr[i - 1] === '--batch-size') || String(DEFAULT_BATCH_SIZE),
  10
);
const forceRegenerate = args.includes('--force');
const dryRun = args.includes('--dry-run');

interface Listing {
  id: string;
  title: string;
  description: string;
  property_type: string;
  listing_type: string;
  location_city: string;
  location_address: string;
  rooms: number | null;
  surface_area: number | null;
  price: number;
  has_parking: boolean;
  has_balcony: boolean;
  has_garage: boolean;
  is_furnished: boolean;
  embedding: number[] | null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Embedding Generation Script');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  Batch size: ${batchSize}`);
  console.log(`  Force regenerate: ${forceRegenerate}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log('');

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY must be set');
    process.exit(1);
  }

  // Initialize clients
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Get count of listings to process
  let query = supabase.from('listings').select('*', { count: 'exact', head: true });

  if (!forceRegenerate) {
    query = query.is('embedding', null);
  }

  const { count, error: countError } = await query;

  if (countError) {
    console.error('Error getting listing count:', countError);
    process.exit(1);
  }

  console.log(`Found ${count} listings to process`);

  if (count === 0) {
    console.log('No listings need embedding generation. Exiting.');
    return;
  }

  if (dryRun) {
    console.log('Dry run mode - no changes will be made');
    return;
  }

  // Process listings in batches
  let processed = 0;
  let errors = 0;
  let totalTokens = 0;
  const startTime = Date.now();

  while (processed < count!) {
    // Fetch batch of listings
    let fetchQuery = supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: true })
      .range(processed, processed + batchSize - 1);

    if (!forceRegenerate) {
      fetchQuery = fetchQuery.is('embedding', null);
    }

    const { data: listings, error: fetchError } = await fetchQuery;

    if (fetchError) {
      console.error('Error fetching listings:', fetchError);
      errors++;
      processed += batchSize;
      continue;
    }

    if (!listings || listings.length === 0) {
      break;
    }

    // Generate embeddings for batch
    const texts = listings.map((l: Listing) => createListingText(l));

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
      });

      totalTokens += response.usage?.total_tokens || 0;

      // Update each listing with its embedding
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        const embedding = response.data[i].embedding;

        const { error: updateError } = await supabase.rpc('update_listing_embedding', {
          listing_id: listing.id,
          new_embedding: embedding,
        });

        if (updateError) {
          console.error(`Error updating listing ${listing.id}:`, updateError);
          errors++;
        } else {
          processed++;
        }
      }
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      errors += listings.length;
      processed += listings.length;

      // Check if rate limited
      if ((apiError as Error).message?.includes('rate')) {
        console.log('Rate limited, waiting 60 seconds...');
        await delay(60000);
      }
    }

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = count! - processed;
    const eta = remaining / rate;

    const progressPercent = ((processed / count!) * 100).toFixed(1);
    const costEstimate = (totalTokens * 0.00000002).toFixed(4); // $0.02 per 1M tokens

    console.log(
      `Progress: ${processed}/${count} (${progressPercent}%) | ` +
        `Errors: ${errors} | ` +
        `Tokens: ${totalTokens} (~$${costEstimate}) | ` +
        `ETA: ${formatTime(eta)}`
    );

    // Delay between batches to respect rate limits
    await delay(DELAY_BETWEEN_BATCHES_MS);
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const finalCost = (totalTokens * 0.00000002).toFixed(4);

  console.log('');
  console.log('='.repeat(60));
  console.log('Embedding Generation Complete');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Total errors: ${errors}`);
  console.log(`Total tokens used: ${totalTokens}`);
  console.log(`Estimated cost: $${finalCost}`);
  console.log(`Total time: ${formatTime(totalTime)}`);
  console.log(`Average rate: ${(processed / totalTime).toFixed(1)} listings/second`);
}

/**
 * Create text representation of a listing for embedding
 */
function createListingText(listing: Listing): string {
  const parts: string[] = [];

  if (listing.title) {
    parts.push(listing.title);
  }

  // Property and listing type
  const propertyTypes: Record<string, string> = {
    apartment: 'Stan',
    house: 'Kuća',
    office: 'Poslovni prostor',
    land: 'Zemljište',
    other: 'Nekretnina',
  };

  const listingTypes: Record<string, string> = {
    rent: 'najam',
    sale: 'prodaja',
  };

  const propertyType = propertyTypes[listing.property_type] || 'Nekretnina';
  const listingType = listingTypes[listing.listing_type] || '';
  parts.push(`${propertyType} za ${listingType}`);

  // Location
  if (listing.location_city) {
    const locationParts = [listing.location_city];
    if (listing.location_address) {
      locationParts.push(listing.location_address);
    }
    parts.push(`Lokacija: ${locationParts.join(', ')}`);
  }

  // Key features
  const features: string[] = [];
  if (listing.rooms) {
    features.push(`${listing.rooms} ${listing.rooms === 1 ? 'soba' : listing.rooms < 5 ? 'sobe' : 'soba'}`);
  }
  if (listing.surface_area) {
    features.push(`${listing.surface_area}m²`);
  }
  if (listing.price) {
    const priceText =
      listing.listing_type === 'rent' ? `${listing.price}€ mjesečno` : `${listing.price}€`;
    features.push(priceText);
  }
  if (features.length > 0) {
    parts.push(features.join(', '));
  }

  // Amenities
  const amenities: string[] = [];
  if (listing.has_parking) amenities.push('parking');
  if (listing.has_balcony) amenities.push('balkon');
  if (listing.has_garage) amenities.push('garaža');
  if (listing.is_furnished) amenities.push('namješteno');
  if (amenities.length > 0) {
    parts.push(`Pogodnosti: ${amenities.join(', ')}`);
  }

  // Description (truncated)
  if (listing.description) {
    const truncatedDesc = listing.description.slice(0, 500);
    parts.push(truncatedDesc);
  }

  return parts.join('. ');
}

/**
 * Format seconds into human readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
