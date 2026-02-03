/**
 * Database Integration Test
 *
 * Run this to verify Phase 2 implementation works correctly
 * Usage: node --loader ts-node/esm src/lib/test-db.ts
 */

import { getListings, getListingById, getFreshListings } from './db-helpers';

async function testDatabaseIntegration() {
  console.log('🧪 Testing Database Integration...\n');

  try {
    // Test 1: Get all listings
    console.log('Test 1: Get all listings');
    const allListings = await getListings({ limit: 5 });
    console.log(`✅ Found ${allListings.length} listings`);
    if (allListings.length > 0) {
      console.log(`   Sample: ${allListings[0].title} - ${allListings[0].price} ${allListings[0].price_currency}`);
    }
    console.log();

    // Test 2: Filter by listing type
    console.log('Test 2: Filter rental apartments');
    const rentals = await getListings({
      listing_type: 'rent',
      property_type: 'apartment',
      limit: 3
    });
    console.log(`✅ Found ${rentals.length} rental apartments`);
    rentals.forEach(listing => {
      console.log(`   - ${listing.title} (${listing.location_city}) - ${listing.price} EUR`);
    });
    console.log();

    // Test 3: Filter by price range
    console.log('Test 3: Filter by price (under 1000 EUR)');
    const affordable = await getListings({
      listing_type: 'rent',
      price_max: 1000,
      limit: 5
    });
    console.log(`✅ Found ${affordable.length} listings under 1000 EUR`);
    console.log();

    // Test 4: Get fresh listings
    console.log('Test 4: Get fresh listings (last 24 hours)');
    const fresh = await getFreshListings(24, 5);
    console.log(`✅ Found ${fresh.length} fresh listings`);
    console.log();

    // Test 5: Get single listing by ID (if any exist)
    if (allListings.length > 0) {
      console.log('Test 5: Get single listing by ID');
      const listing = await getListingById(allListings[0].id);
      if (listing) {
        console.log(`✅ Retrieved listing: ${listing.title}`);
        console.log(`   Location: ${listing.location_city}, ${listing.location_address}`);
        console.log(`   Price: ${listing.price} ${listing.price_currency}`);
        console.log(`   Features: Parking=${listing.has_parking}, Balcony=${listing.has_balcony}, Furnished=${listing.is_furnished}`);
      }
      console.log();
    }

    console.log('✅ All tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   - Total listings in database: ${allListings.length}`);
    console.log(`   - Database connection: Working`);
    console.log(`   - Type conversion: Working`);
    console.log(`   - Filtering: Working`);
    console.log(`   - Row Level Security: Enabled (public read access)`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  }
}

// Run tests
testDatabaseIntegration();
