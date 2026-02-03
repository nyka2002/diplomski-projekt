/**
 * Test Script for Scrapers
 *
 * Run with: npx tsx scripts/test-scraper.ts
 */

import { NjuskaloScraper } from '../src/services/scraping/scrapers/njuskalo';
import { browserPool } from '../src/services/scraping/browser';

async function testScraper() {
  console.log('🧪 Testing Njuskalo Scraper...\n');

  // Create scraper instance
  const scraper = new NjuskaloScraper('rent', 'apartment');

  console.log('Configuration:');
  console.log(scraper.getConfig());
  console.log('\n');

  // Test URL generation
  console.log('Generated URLs:');
  console.log('  Page 1:', scraper.getListingPageUrl(1));
  console.log('  Page 2:', scraper.getListingPageUrl(2));
  console.log('\n');

  // Run actual scrape (limited to 1 page)
  console.log('Running scrape (1 page only)...\n');

  try {
    // Override maxPages to 1 for testing
    const testScraper = new NjuskaloScraper('rent', 'apartment');
    // @ts-ignore - accessing protected config for testing
    testScraper['config'].maxPages = 1;

    const result = await testScraper.scrape();

    console.log('\n📊 Results:');
    console.log('  Success:', result.success);
    console.log('  Listings scraped:', result.listingsScraped);
    console.log('  Listings saved:', result.listingsSaved);
    console.log('  Duplicates:', result.listingsDuplicate);
    console.log('  Errors:', result.errors.length);
    console.log('  Duration:', Math.round(result.duration / 1000), 'seconds');

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.code}] ${err.message}`);
      });
    }
  } catch (error) {
    console.error('❌ Scrape failed:', error);
  } finally {
    // Cleanup
    await browserPool.cleanup();
  }

  console.log('\n✅ Test complete!');
}

// Run the test
testScraper().catch(console.error);
