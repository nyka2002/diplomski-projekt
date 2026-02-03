/**
 * Amenity Mapper
 *
 * Maps Croatian amenity names to standardized English keys.
 * Features:
 * - Croatian → English translation
 * - Mapping to boolean flags (has_parking, has_balcony, etc.)
 * - Collection of additional amenities
 */

export interface MappedAmenities {
  /** Has parking spot */
  has_parking: boolean;
  /** Has balcony or terrace */
  has_balcony: boolean;
  /** Has garage */
  has_garage: boolean;
  /** Is furnished */
  is_furnished: boolean;
  /** Additional amenities as key-value pairs */
  additional: Record<string, boolean>;
}

// Primary amenity mappings to boolean flags
type PrimaryAmenity = 'has_parking' | 'has_balcony' | 'has_garage' | 'is_furnished';

// Mapping of Croatian terms to amenity keys
const AMENITY_MAPPINGS: Record<string, PrimaryAmenity | string> = {
  // Parking
  parking: 'has_parking',
  'parkirno mjesto': 'has_parking',
  parkiralište: 'has_parking',
  parkirno: 'has_parking',

  // Garage
  garaža: 'has_garage',
  garaza: 'has_garage',
  'garažno mjesto': 'has_garage',
  garazno: 'has_garage',

  // Balcony/Terrace
  balkon: 'has_balcony',
  terasa: 'has_balcony',
  lodža: 'has_balcony',
  lodza: 'has_balcony',
  logia: 'has_balcony',
  lođa: 'has_balcony',

  // Furnished
  namješteno: 'is_furnished',
  namjesteno: 'is_furnished',
  'potpuno namješteno': 'is_furnished',
  'potpuno namjesteno': 'is_furnished',
  'djelomično namješteno': 'is_furnished',
  'djelomicno namjesteno': 'is_furnished',
  polunamješteno: 'is_furnished',
  polunamjesteno: 'is_furnished',
  'opremljeno': 'is_furnished',
  furnished: 'is_furnished',

  // Air conditioning
  klima: 'air_conditioning',
  klimatizacija: 'air_conditioning',
  'klima uređaj': 'air_conditioning',
  'klima uredaj': 'air_conditioning',

  // Heating
  'centralno grijanje': 'central_heating',
  'centralno': 'central_heating',
  plin: 'gas_heating',
  'plinsko grijanje': 'gas_heating',
  'etažno grijanje': 'floor_heating',
  'etazno grijanje': 'floor_heating',
  'podno grijanje': 'floor_heating',

  // Elevator
  lift: 'elevator',
  dizalo: 'elevator',

  // Internet/TV
  internet: 'internet',
  'brzi internet': 'fiber_internet',
  'optički internet': 'fiber_internet',
  'opticki internet': 'fiber_internet',
  kabelska: 'cable_tv',
  'kabelska tv': 'cable_tv',

  // Security
  alarm: 'alarm',
  'protuprovalni alarm': 'alarm',
  'video nadzor': 'video_surveillance',
  videonadzor: 'video_surveillance',
  portafon: 'intercom',
  interfon: 'intercom',
  'blindirana vrata': 'security_door',

  // Outdoor
  bazen: 'pool',
  vrt: 'garden',
  dvorište: 'garden',
  dvoriste: 'garden',
  'okućnica': 'garden',
  okucnica: 'garden',

  // Storage
  spremište: 'storage',
  spremiste: 'storage',
  'podrumska ostava': 'basement_storage',
  podrum: 'basement',
  tavan: 'attic',

  // Appliances
  'perilica suđa': 'dishwasher',
  'perilica suda': 'dishwasher',
  'perilica rublja': 'washing_machine',
  'sušilica': 'dryer',
  susilica: 'dryer',
  'pećnica': 'oven',
  pecnica: 'oven',
  'mikrovalna': 'microwave',

  // Other
  'kamin': 'fireplace',
  'kaljeva peć': 'fireplace',
  'kaljeva pec': 'fireplace',
  'pet friendly': 'pets_allowed',
  'dozvoljeni ljubimci': 'pets_allowed',
  'kućni ljubimci': 'pets_allowed',
  'kucni ljubimci': 'pets_allowed',
  'pogled na more': 'sea_view',
  'pogled more': 'sea_view',
  'prvi red do mora': 'first_row_to_sea',
  'blizina mora': 'near_sea',
  'blizina centra': 'near_center',
  'blizina škole': 'near_school',
  'blizina skole': 'near_school',
  'blizina tramvaja': 'near_tram',
  'javni prijevoz': 'public_transport',
};

// Unfurnished indicators
const UNFURNISHED_INDICATORS = [
  'nenamješteno',
  'nenamjesteno',
  'bez namještaja',
  'bez namjestaja',
  'prazan',
  'prazno',
  'unfurnished',
];

export class AmenityMapper {
  /**
   * Map an array of raw amenity strings to structured amenities
   */
  mapAmenities(rawAmenities: string[]): MappedAmenities {
    const result: MappedAmenities = {
      has_parking: false,
      has_balcony: false,
      has_garage: false,
      is_furnished: false,
      additional: {},
    };

    for (const raw of rawAmenities) {
      const normalized = raw.toLowerCase().trim();

      // Check for unfurnished indicators first
      if (UNFURNISHED_INDICATORS.some((ind) => normalized.includes(ind))) {
        result.is_furnished = false;
        continue;
      }

      // Check against mapping
      for (const [pattern, mapping] of Object.entries(AMENITY_MAPPINGS)) {
        if (normalized.includes(pattern)) {
          if (
            mapping === 'has_parking' ||
            mapping === 'has_balcony' ||
            mapping === 'has_garage' ||
            mapping === 'is_furnished'
          ) {
            result[mapping] = true;
          } else {
            result.additional[mapping] = true;
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract amenities from a description text
   */
  extractFromDescription(description: string): Partial<MappedAmenities> {
    const words = description.toLowerCase();
    const found: Partial<MappedAmenities> = {
      additional: {},
    };

    for (const [pattern, mapping] of Object.entries(AMENITY_MAPPINGS)) {
      if (words.includes(pattern)) {
        if (
          mapping === 'has_parking' ||
          mapping === 'has_balcony' ||
          mapping === 'has_garage' ||
          mapping === 'is_furnished'
        ) {
          found[mapping] = true;
        } else if (found.additional) {
          found.additional[mapping] = true;
        }
      }
    }

    // Check for unfurnished
    if (UNFURNISHED_INDICATORS.some((ind) => words.includes(ind))) {
      found.is_furnished = false;
    }

    return found;
  }

  /**
   * Merge amenities from multiple sources
   */
  mergeAmenities(
    primary: MappedAmenities,
    secondary: Partial<MappedAmenities>
  ): MappedAmenities {
    return {
      has_parking: primary.has_parking || secondary.has_parking || false,
      has_balcony: primary.has_balcony || secondary.has_balcony || false,
      has_garage: primary.has_garage || secondary.has_garage || false,
      is_furnished: primary.is_furnished || secondary.is_furnished || false,
      additional: {
        ...primary.additional,
        ...secondary.additional,
      },
    };
  }
}
