import { ExtractedFilters } from '@/types/search';
import { OpenAIService } from './openai-client';
import { ExtractionResult, ExtractionConfidence, AIServiceError } from './types';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_TEMPLATE } from './prompts';

// Default confidence when field is not mentioned
const DEFAULT_CONFIDENCE: ExtractionConfidence = {
  overall: 0,
  listing_type: 0,
  price: 0,
  location: 0,
  rooms: 0,
  amenities: 0,
  ambiguousFields: [],
};

export class QueryExtractorService {
  private openai: OpenAIService;

  constructor(openai: OpenAIService) {
    this.openai = openai;
  }

  /**
   * Extract structured filters from a natural language query
   */
  async extractFilters(query: string): Promise<ExtractionResult> {
    if (!query.trim()) {
      return {
        filters: {},
        confidence: { ...DEFAULT_CONFIDENCE, ambiguousFields: ['all'] },
        originalQuery: query,
        normalizedQuery: '',
        language: 'hr',
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUSD: 0,
        },
      };
    }

    try {
      const response = await this.openai.chatCompletion(
        [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: EXTRACTION_USER_TEMPLATE(query) },
        ],
        {
          jsonMode: true,
          temperature: 0.1, // Low temperature for consistent extraction
          maxTokens: 800,
        }
      );

      const parsed = this.parseResponse(response.content);

      return {
        filters: this.normalizeFilters(parsed.filters),
        confidence: this.normalizeConfidence(parsed.confidence),
        originalQuery: query,
        normalizedQuery: parsed.normalized_query || this.basicNormalize(query),
        language: parsed.language || this.detectLanguage(query),
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      console.error('Query extraction failed:', error);
      throw new AIServiceError(
        'Failed to extract filters from query',
        'EXTRACTION_FAILED',
        true,
        error as Error
      );
    }
  }

  /**
   * Parse and validate JSON response from OpenAI
   */
  private parseResponse(content: string): {
    filters: Record<string, unknown>;
    confidence: Partial<ExtractionConfidence>;
    normalized_query?: string;
    language?: 'hr' | 'en' | 'mixed';
  } {
    try {
      const parsed = JSON.parse(content);
      return {
        filters: parsed.filters || {},
        confidence: parsed.confidence || {},
        normalized_query: parsed.normalized_query,
        language: parsed.language,
      };
    } catch (error) {
      console.error('Failed to parse extraction response:', content);
      return {
        filters: {},
        confidence: {},
      };
    }
  }

  /**
   * Normalize and validate extracted filters
   */
  private normalizeFilters(raw: Record<string, unknown>): ExtractedFilters {
    const filters: ExtractedFilters = {};

    // Listing type
    if (raw.listing_type === 'rent' || raw.listing_type === 'sale') {
      filters.listing_type = raw.listing_type;
    }

    // Property type
    const validPropertyTypes = ['apartment', 'house', 'office', 'land', 'other'];
    if (typeof raw.property_type === 'string' && validPropertyTypes.includes(raw.property_type)) {
      filters.property_type = raw.property_type;
    }

    // Price range
    if (typeof raw.price_min === 'number' && raw.price_min > 0) {
      filters.price_min = Math.round(raw.price_min);
    }
    if (typeof raw.price_max === 'number' && raw.price_max > 0) {
      filters.price_max = Math.round(raw.price_max);
    }

    // Location - normalize Croatian city names
    if (typeof raw.location === 'string' && raw.location.trim()) {
      filters.location = this.normalizeLocation(raw.location);
    }

    // Rooms
    if (typeof raw.rooms_min === 'number' && raw.rooms_min > 0) {
      filters.rooms_min = Math.round(raw.rooms_min);
    }
    if (typeof raw.rooms_max === 'number' && raw.rooms_max > 0) {
      filters.rooms_max = Math.round(raw.rooms_max);
    }

    // Surface area
    if (typeof raw.surface_area_min === 'number' && raw.surface_area_min > 0) {
      filters.surface_area_min = Math.round(raw.surface_area_min);
    }
    if (typeof raw.surface_area_max === 'number' && raw.surface_area_max > 0) {
      filters.surface_area_max = Math.round(raw.surface_area_max);
    }

    // Boolean amenities - only set if explicitly true
    if (raw.has_parking === true) filters.has_parking = true;
    if (raw.has_balcony === true) filters.has_balcony = true;
    if (raw.has_garage === true) filters.has_garage = true;
    if (raw.is_furnished === true) filters.is_furnished = true;

    // Additional amenities
    if (Array.isArray(raw.amenities) && raw.amenities.length > 0) {
      filters.amenities = raw.amenities.filter(
        (a): a is string => typeof a === 'string' && a.trim().length > 0
      );
    }

    return filters;
  }

  /**
   * Normalize confidence scores
   */
  private normalizeConfidence(raw: Partial<ExtractionConfidence>): ExtractionConfidence {
    return {
      overall: this.clampConfidence(raw.overall),
      listing_type: this.clampConfidence(raw.listing_type),
      price: this.clampConfidence(raw.price),
      location: this.clampConfidence(raw.location),
      rooms: this.clampConfidence(raw.rooms),
      amenities: this.clampConfidence(raw.amenities),
      ambiguousFields: Array.isArray(raw.ambiguousFields)
        ? raw.ambiguousFields.filter((f): f is string => typeof f === 'string')
        : [],
    };
  }

  /**
   * Clamp confidence to 0-1 range
   */
  private clampConfidence(value: unknown): number {
    if (typeof value !== 'number') return 0;
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Normalize Croatian location names
   */
  private normalizeLocation(location: string): string {
    const locationMap: Record<string, string> = {
      'zagreb': 'Zagreb',
      'split': 'Split',
      'rijeka': 'Rijeka',
      'osijek': 'Osijek',
      'zadar': 'Zadar',
      'pula': 'Pula',
      'dubrovnik': 'Dubrovnik',
      'slavonski brod': 'Slavonski Brod',
      'karlovac': 'Karlovac',
      'varaždin': 'Varaždin',
      'varazdin': 'Varaždin',
      'šibenik': 'Šibenik',
      'sibenik': 'Šibenik',
      // Zagreb neighborhoods
      'trešnjevka': 'Trešnjevka',
      'tresnjevka': 'Trešnjevka',
      'maksimir': 'Maksimir',
      'dubrava': 'Dubrava',
      'trnje': 'Trnje',
      'novi zagreb': 'Novi Zagreb',
      'črnomerec': 'Črnomerec',
      'crnomerec': 'Črnomerec',
      'jarun': 'Jarun',
      'špansko': 'Špansko',
      'spansko': 'Špansko',
      'sesvete': 'Sesvete',
    };

    const normalized = location.toLowerCase().trim();
    return locationMap[normalized] || location.trim();
  }

  /**
   * Basic query normalization
   */
  private basicNormalize(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[€$]/g, 'eur')
      .replace(/m²|m2|kvadrata/gi, 'm2');
  }

  /**
   * Simple language detection
   */
  private detectLanguage(query: string): 'hr' | 'en' | 'mixed' {
    const croatianWords = [
      'stan', 'kuća', 'najam', 'prodaja', 'soba', 'sobni', 'balkon',
      'parking', 'namješten', 'opremljen', 'tražim', 'trebam', 'za',
      'cijena', 'do', 'od', 'kvadrata', 'garaža',
    ];

    const englishWords = [
      'apartment', 'house', 'rent', 'sale', 'room', 'bedroom', 'balcony',
      'parking', 'furnished', 'looking', 'need', 'for', 'price', 'under',
      'over', 'sqm', 'garage',
    ];

    const words = query.toLowerCase().split(/\s+/);
    let croatianCount = 0;
    let englishCount = 0;

    for (const word of words) {
      if (croatianWords.some((cw) => word.includes(cw))) croatianCount++;
      if (englishWords.some((ew) => word.includes(ew))) englishCount++;
    }

    if (croatianCount > 0 && englishCount > 0) return 'mixed';
    if (englishCount > croatianCount) return 'en';
    return 'hr';
  }
}

// Factory function
export function createQueryExtractor(openai: OpenAIService): QueryExtractorService {
  return new QueryExtractorService(openai);
}
