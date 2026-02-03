import { ExtractedFilters } from '@/types/search';

/**
 * Test queries for AI quality testing
 * Each query has expected extracted filters and minimum confidence threshold
 */
export interface QualityTestQuery {
  query: string;
  expected: Partial<ExtractedFilters>;
  minConfidence: number;
  description: string;
}

export const qualityTestQueries: QualityTestQuery[] = [
  // Basic rent queries
  {
    query: 'Tražim stan za najam u Zagrebu',
    expected: {
      listing_type: 'rent',
      location: 'Zagreb',
    },
    minConfidence: 0.85,
    description: 'Basic rent query with city',
  },
  {
    query: 'Tražim dvosobni stan za najam do 700€',
    expected: {
      listing_type: 'rent',
      rooms_min: 2,
      rooms_max: 2,
      price_max: 700,
    },
    minConfidence: 0.85,
    description: 'Rent with specific rooms and price',
  },
  {
    query: 'Tražim potpuno opremljen dvosobni stan za mjesečni najam s parkirnim mjestom i balkonom, do 1000€',
    expected: {
      listing_type: 'rent',
      rooms_min: 2,
      is_furnished: true,
      has_parking: true,
      has_balcony: true,
      price_max: 1000,
    },
    minConfidence: 0.8,
    description: 'Complex rent query with multiple amenities',
  },

  // Sale queries
  {
    query: 'Kuća na prodaju',
    expected: {
      listing_type: 'sale',
      property_type: 'house',
    },
    minConfidence: 0.9,
    description: 'Simple house for sale',
  },
  {
    query: 'Stan na prodaju u Splitu do 200000€',
    expected: {
      listing_type: 'sale',
      property_type: 'apartment',
      location: 'Split',
      price_max: 200000,
    },
    minConfidence: 0.85,
    description: 'Apartment for sale with location and price',
  },

  // Location-specific queries
  {
    query: 'Najam stana na Trešnjevci',
    expected: {
      listing_type: 'rent',
      location: 'Trešnjevka',
    },
    minConfidence: 0.85,
    description: 'Rent in specific Zagreb neighborhood',
  },
  {
    query: 'Stan u Dubrovniku blizu mora',
    expected: {
      location: 'Dubrovnik',
    },
    minConfidence: 0.8,
    description: 'Location with semantic descriptor',
  },
  {
    query: 'Tražim stan u Varaždinu',
    expected: {
      location: 'Varaždin',
    },
    minConfidence: 0.9,
    description: 'City with diacritics - Varaždin',
  },
  {
    query: 'Nekretnina u Šibeniku',
    expected: {
      location: 'Šibenik',
    },
    minConfidence: 0.9,
    description: 'City with diacritics - Šibenik',
  },

  // Room specifications
  {
    query: 'Garsonijera za najam',
    expected: {
      listing_type: 'rent',
      rooms_max: 1,
    },
    minConfidence: 0.85,
    description: 'Studio apartment',
  },
  {
    query: 'Trosobni stan',
    expected: {
      rooms_min: 3,
      rooms_max: 3,
    },
    minConfidence: 0.9,
    description: 'Three-room apartment',
  },
  {
    query: 'Stan s 4 ili više soba',
    expected: {
      rooms_min: 4,
    },
    minConfidence: 0.85,
    description: 'Minimum room count',
  },
  {
    query: 'Stan do 3 sobe',
    expected: {
      rooms_max: 3,
    },
    minConfidence: 0.85,
    description: 'Maximum room count',
  },

  // Price ranges
  {
    query: 'Stan za najam od 500 do 800 eura',
    expected: {
      listing_type: 'rent',
      price_min: 500,
      price_max: 800,
    },
    minConfidence: 0.85,
    description: 'Price range specification',
  },
  {
    query: 'Kuća iznad 300000€',
    expected: {
      property_type: 'house',
      price_min: 300000,
    },
    minConfidence: 0.85,
    description: 'Minimum price only',
  },

  // Amenity queries
  {
    query: 'Stan s parkingom',
    expected: {
      has_parking: true,
    },
    minConfidence: 0.9,
    description: 'Parking requirement',
  },
  {
    query: 'Namješten stan',
    expected: {
      is_furnished: true,
    },
    minConfidence: 0.9,
    description: 'Furnished requirement',
  },
  {
    query: 'Stan s balkonom i garažom',
    expected: {
      has_balcony: true,
      has_garage: true,
    },
    minConfidence: 0.85,
    description: 'Multiple amenities',
  },
  {
    query: 'Opremljen stan s parkingom i balkonom',
    expected: {
      is_furnished: true,
      has_parking: true,
      has_balcony: true,
    },
    minConfidence: 0.85,
    description: 'Furnished with amenities',
  },

  // Surface area queries
  {
    query: 'Stan od 60 kvadrata',
    expected: {
      surface_area_min: 60,
    },
    minConfidence: 0.85,
    description: 'Minimum surface area',
  },
  {
    query: 'Stan do 50m²',
    expected: {
      surface_area_max: 50,
    },
    minConfidence: 0.85,
    description: 'Maximum surface area',
  },
  {
    query: 'Stan između 50 i 80 kvadrata',
    expected: {
      surface_area_min: 50,
      surface_area_max: 80,
    },
    minConfidence: 0.8,
    description: 'Surface area range',
  },

  // Complex combined queries
  {
    query: 'Tražim trosobni namješten stan za najam u Zagrebu, Maksimir, do 900€, s parkingom',
    expected: {
      listing_type: 'rent',
      rooms_min: 3,
      rooms_max: 3,
      is_furnished: true,
      location: 'Maksimir',
      price_max: 900,
      has_parking: true,
    },
    minConfidence: 0.75,
    description: 'Complex query with all filter types',
  },
  {
    query: 'Kuća na prodaju u Samoboru, minimalno 4 sobe, s vrtom i garažom, do 350000 eura',
    expected: {
      listing_type: 'sale',
      property_type: 'house',
      location: 'Samobor',
      rooms_min: 4,
      has_garage: true,
      price_max: 350000,
    },
    minConfidence: 0.75,
    description: 'Complex house sale query',
  },

  // Informal/conversational queries
  {
    query: 'Trebam stan, jeftiniji od 600€',
    expected: {
      price_max: 600,
    },
    minConfidence: 0.8,
    description: 'Informal price request',
  },
  {
    query: 'Ima li kakav stan za studente u Zagrebu?',
    expected: {
      location: 'Zagreb',
    },
    minConfidence: 0.7,
    description: 'Question format query',
  },
  {
    query: 'Želim kupiti manji stan u centru Rijeke',
    expected: {
      listing_type: 'sale',
      location: 'Rijeka',
    },
    minConfidence: 0.8,
    description: 'Purchase intent informal',
  },

  // Edge cases
  {
    query: 'Stan',
    expected: {
      property_type: 'apartment',
    },
    minConfidence: 0.5,
    description: 'Minimal query - just property type',
  },
  {
    query: '',
    expected: {},
    minConfidence: 0,
    description: 'Empty query',
  },
  {
    query: 'asdfghjkl qwerty',
    expected: {},
    minConfidence: 0,
    description: 'Nonsense query',
  },

  // English queries (mixed support)
  {
    query: 'Looking for a two bedroom apartment in Zagreb',
    expected: {
      rooms_min: 2,
      location: 'Zagreb',
    },
    minConfidence: 0.7,
    description: 'English query',
  },
  {
    query: 'House for sale with garden',
    expected: {
      listing_type: 'sale',
      property_type: 'house',
    },
    minConfidence: 0.7,
    description: 'English sale query',
  },

  // Property type variations
  {
    query: 'Poslovni prostor za najam',
    expected: {
      listing_type: 'rent',
      property_type: 'office',
    },
    minConfidence: 0.85,
    description: 'Office space',
  },
  {
    query: 'Zemljište na prodaju',
    expected: {
      listing_type: 'sale',
      property_type: 'land',
    },
    minConfidence: 0.85,
    description: 'Land for sale',
  },

  // Additional Croatian variations
  {
    query: 'Iznajmljivanje stana Zagreb',
    expected: {
      listing_type: 'rent',
      location: 'Zagreb',
    },
    minConfidence: 0.85,
    description: 'Alternative rent wording',
  },
  {
    query: 'Kupnja kuće Istra',
    expected: {
      listing_type: 'sale',
      property_type: 'house',
    },
    minConfidence: 0.8,
    description: 'Alternative sale wording with region',
  },
  {
    query: 'Potreban mi je stan sa 2 spavaće sobe',
    expected: {
      rooms_min: 2,
    },
    minConfidence: 0.8,
    description: 'Bedrooms specification',
  },

  // Price in different formats
  {
    query: 'Stan do 150 tisuća eura',
    expected: {
      price_max: 150000,
    },
    minConfidence: 0.8,
    description: 'Price in thousands',
  },
  {
    query: 'Najam do 1000 kuna mjesečno',
    expected: {
      listing_type: 'rent',
      price_max: 133, // ~1000 HRK in EUR
    },
    minConfidence: 0.7,
    description: 'Price in HRK (should convert)',
  },
];

/**
 * Subset of queries for quick validation tests
 */
export const quickTestQueries = qualityTestQueries.filter(
  (q) =>
    q.description.includes('Basic') ||
    q.description.includes('Simple') ||
    q.description === 'Empty query'
);
