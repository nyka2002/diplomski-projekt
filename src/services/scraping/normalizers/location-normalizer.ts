/**
 * Location Normalizer
 *
 * Normalizes location data from Croatian real estate websites.
 * Features:
 * - City name standardization
 * - District recognition (especially Zagreb)
 * - Address parsing
 */

export interface NormalizedLocation {
  /** Standardized city name */
  city: string;
  /** Address or district */
  address: string;
  /** Region/county (optional) */
  region?: string;
}

// Croatian city name mappings (common variations and abbreviations)
const CITY_MAPPINGS: Record<string, string> = {
  // Zagreb variations
  zg: 'Zagreb',
  zagreb: 'Zagreb',
  'grad zagreb': 'Zagreb',
  'city of zagreb': 'Zagreb',

  // Split variations
  st: 'Split',
  split: 'Split',
  'grad split': 'Split',

  // Rijeka variations
  ri: 'Rijeka',
  rijeka: 'Rijeka',
  'grad rijeka': 'Rijeka',

  // Osijek variations
  os: 'Osijek',
  osijek: 'Osijek',
  'grad osijek': 'Osijek',

  // Other major cities
  zadar: 'Zadar',
  dubrovnik: 'Dubrovnik',
  pula: 'Pula',
  karlovac: 'Karlovac',
  sisak: 'Sisak',
  varaždin: 'Varaždin',
  varazdin: 'Varaždin',
  slavonski: 'Slavonski Brod',
  'slavonski brod': 'Slavonski Brod',
  vukovar: 'Vukovar',
  šibenik: 'Šibenik',
  sibenik: 'Šibenik',
  koprivnica: 'Koprivnica',
  bjelovar: 'Bjelovar',
  čakovec: 'Čakovec',
  cakovec: 'Čakovec',
  virovitica: 'Virovitica',
  požega: 'Požega',
  pozega: 'Požega',
  'velika gorica': 'Velika Gorica',
  samobor: 'Samobor',
  vinkovci: 'Vinkovci',
  kaštela: 'Kaštela',
  kastela: 'Kaštela',
  solin: 'Solin',
  'makarska': 'Makarska',
  'omiš': 'Omiš',
  'omis': 'Omiš',
  rovinj: 'Rovinj',
  poreč: 'Poreč',
  porec: 'Poreč',
  umag: 'Umag',
  opatija: 'Opatija',
  crikvenica: 'Crikvenica',
  mali: 'Mali Lošinj',
  'mali lošinj': 'Mali Lošinj',
  'mali losinj': 'Mali Lošinj',
  rab: 'Rab',
  krk: 'Krk',
  senj: 'Senj',
  gospić: 'Gospić',
  gospic: 'Gospić',
  'biograd na moru': 'Biograd na Moru',
  biograd: 'Biograd na Moru',
  nin: 'Nin',
  vodice: 'Vodice',
  primošten: 'Primošten',
  primosten: 'Primošten',
  trogir: 'Trogir',
  korčula: 'Korčula',
  korcula: 'Korčula',
  hvar: 'Hvar',
  vis: 'Vis',
  bol: 'Bol',
  supetar: 'Supetar',
  metković: 'Metković',
  metkovic: 'Metković',
  ploče: 'Ploče',
  ploce: 'Ploče',
  cavtat: 'Cavtat',
  'mlini': 'Mlini',
};

// Zagreb districts for better address parsing
const ZAGREB_DISTRICTS = [
  'Trešnjevka',
  'Tresnjevka',
  'Maksimir',
  'Dubrava',
  'Sesvete',
  'Novi Zagreb',
  'Trnje',
  'Centar',
  'Gornji Grad',
  'Donji Grad',
  'Peščenica',
  'Pescenica',
  'Žitnjak',
  'Zitnjak',
  'Jarun',
  'Vrapče',
  'Vrapce',
  'Špansko',
  'Spansko',
  'Stenjevec',
  'Podsused',
  'Črnomerec',
  'Crnomerec',
  'Medveščak',
  'Medvescak',
  'Zapruđe',
  'Zaprude',
  'Travno',
  'Siget',
  'Savica',
  'Borongaj',
  'Voltino',
  'Gajnice',
  'Malešnica',
  'Malesnica',
  'Prečko',
  'Precko',
  'Knežija',
  'Knezija',
  'Rudeš',
  'Rudes',
  'Kajzerica',
  'Sloboština',
  'Slobostina',
  'Utrina',
  'Sopot',
  'Kozari bok',
  'Kozari Bok',
  'Lanište',
  'Laniste',
  'Botinec',
  'Remetinec',
  'Bundek',
  'Folnegovićevo',
  'Folnegovicevo',
];

// Split districts
const SPLIT_DISTRICTS = [
  'Bačvice',
  'Bacvice',
  'Firule',
  'Bol',
  'Manuš',
  'Manus',
  'Meje',
  'Gripe',
  'Lučac',
  'Lucac',
  'Varoš',
  'Varos',
  'Spinut',
  'Trstenik',
  'Marjan',
  'Mertojak',
  'Ravne njive',
  'Žnjan',
  'Znjan',
  'Stobreč',
  'Stobrec',
  'Kamen',
  'Sirobuja',
  'Visoka',
  'Mejaši',
  'Mejasi',
  'Pujanke',
  'Sućidar',
  'Sucidar',
  'Kman',
  'Lokve',
  'Kopilica',
  'Split 3',
  'Pazdigrad',
  'Brda',
  'Lovret',
  'Lovrinac',
];

export class LocationNormalizer {
  /**
   * Normalize a location string to structured location data
   */
  normalize(rawLocation: string): NormalizedLocation {
    const cleaned = rawLocation.trim();

    // Common format: "Zagreb, Trešnjevka - sjever"
    // Or: "Split, Bol"
    // Or just: "Zagreb"
    // Or: "Grad Zagreb, Trešnjevka"

    const parts = cleaned
      .split(/[,\-–]/)
      .map((p) => p.trim())
      .filter(Boolean);

    let city = '';
    let address = '';
    let region: string | undefined;

    if (parts.length === 0) {
      return { city: 'Unknown', address: '' };
    }

    // Try to identify the city from the first parts
    for (let i = 0; i < Math.min(parts.length, 2); i++) {
      const normalizedCity = this.normalizeCity(parts[i]);
      if (normalizedCity !== parts[i]) {
        // Found a known city
        city = normalizedCity;
        // Everything else is address
        address = parts
          .filter((_, idx) => idx !== i)
          .join(', ');
        break;
      }
    }

    // If no known city found, use the first part as city
    if (!city) {
      city = this.normalizeCity(parts[0]);
      address = parts.slice(1).join(', ');
    }

    // Check if any part is a known district
    if (city === 'Zagreb') {
      for (const part of parts) {
        if (this.isZagrebDistrict(part)) {
          address = parts.slice(1).join(', ');
          break;
        }
      }
    } else if (city === 'Split') {
      for (const part of parts) {
        if (this.isSplitDistrict(part)) {
          address = parts.slice(1).join(', ');
          break;
        }
      }
    }

    return { city, address, region };
  }

  /**
   * Normalize a city name to standard format
   */
  private normalizeCity(raw: string): string {
    const lower = raw.toLowerCase().trim();

    // Remove common prefixes
    const withoutPrefix = lower
      .replace(/^grad\s+/, '')
      .replace(/^općina\s+/, '')
      .replace(/^city of\s+/, '');

    // Check direct mapping
    if (CITY_MAPPINGS[withoutPrefix]) {
      return CITY_MAPPINGS[withoutPrefix];
    }

    // Check if it's a known city with different casing
    for (const [key, value] of Object.entries(CITY_MAPPINGS)) {
      if (withoutPrefix.includes(key)) {
        return value;
      }
    }

    // Capitalize first letter of each word
    return raw
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Check if a string is a known Zagreb district
   */
  private isZagrebDistrict(value: string): boolean {
    const lower = value.toLowerCase();
    return ZAGREB_DISTRICTS.some((d) => lower.includes(d.toLowerCase()));
  }

  /**
   * Check if a string is a known Split district
   */
  private isSplitDistrict(value: string): boolean {
    const lower = value.toLowerCase();
    return SPLIT_DISTRICTS.some((d) => lower.includes(d.toLowerCase()));
  }

  /**
   * Extract district from address if possible
   */
  extractDistrict(address: string, city: string): string | undefined {
    const lower = address.toLowerCase();

    if (city === 'Zagreb') {
      for (const district of ZAGREB_DISTRICTS) {
        if (lower.includes(district.toLowerCase())) {
          return district;
        }
      }
    } else if (city === 'Split') {
      for (const district of SPLIT_DISTRICTS) {
        if (lower.includes(district.toLowerCase())) {
          return district;
        }
      }
    }

    return undefined;
  }
}
