/**
 * Test Script for Normalizers
 *
 * Run with: npx tsx scripts/test-normalizers.ts
 *
 * This doesn't require Redis or browser - tests the normalization logic only.
 */

import { PriceNormalizer } from '../src/services/scraping/normalizers/price-normalizer';
import { LocationNormalizer } from '../src/services/scraping/normalizers/location-normalizer';
import { AmenityMapper } from '../src/services/scraping/normalizers/amenity-mapper';

console.log('🧪 Testing Normalizers\n');

// ============================================================================
// Test Price Normalizer
// ============================================================================
console.log('💰 Price Normalizer Tests:');
const priceNormalizer = new PriceNormalizer();

const priceTests = [
  { input: '850 €/mj', type: 'rent' as const },
  { input: '125.000 €', type: 'sale' as const },
  { input: '1.500 EUR mjesečno', type: 'rent' as const },
  { input: '95000 kn', type: 'sale' as const },  // Legacy HRK
  { input: '750€', type: 'rent' as const },
  { input: '1,250.00 EUR', type: 'sale' as const },
];

priceTests.forEach(({ input, type }) => {
  const result = priceNormalizer.normalize(input, type);
  console.log(`  "${input}" (${type}) → ${result.price} ${result.currency}${result.isMonthly ? '/month' : ''}`);
});

// ============================================================================
// Test Location Normalizer
// ============================================================================
console.log('\n📍 Location Normalizer Tests:');
const locationNormalizer = new LocationNormalizer();

const locationTests = [
  'Zagreb, Trešnjevka - sjever',
  'Split, Bačvice',
  'Grad Zagreb, Maksimir',
  'Rijeka',
  'ZG, Dubrava',
  'Pula, Centar',
  'Dubrovnik, Lapad',
];

locationTests.forEach((input) => {
  const result = locationNormalizer.normalize(input);
  console.log(`  "${input}" → City: "${result.city}", Address: "${result.address}"`);
});

// ============================================================================
// Test Amenity Mapper
// ============================================================================
console.log('\n🏠 Amenity Mapper Tests:');
const amenityMapper = new AmenityMapper();

const amenityTests = [
  ['parking', 'balkon', 'klima', 'lift'],
  ['garaža', 'potpuno namješteno', 'centralno grijanje'],
  ['internet', 'perilica rublja', 'podno grijanje'],
  ['nenamješteno', 'bazen', 'vrt'],
];

amenityTests.forEach((input) => {
  const result = amenityMapper.mapAmenities(input);
  console.log(`  [${input.join(', ')}]`);
  console.log(`    → parking: ${result.has_parking}, balcony: ${result.has_balcony}, garage: ${result.has_garage}, furnished: ${result.is_furnished}`);
  if (Object.keys(result.additional).length > 0) {
    console.log(`    → additional: ${Object.keys(result.additional).join(', ')}`);
  }
});

console.log('\n✅ All normalizer tests complete!');
