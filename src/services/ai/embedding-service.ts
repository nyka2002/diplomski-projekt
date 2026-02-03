import crypto from 'crypto';
import redis from '@/lib/redis';
import { Listing } from '@/types/listing';
import { OpenAIService } from './openai-client';
import { EmbeddingResult, BatchEmbeddingResult, AIServiceError } from './types';

// Cache TTL constants
const CACHE_TTL_QUERY = 86400; // 24 hours for query embeddings
const CACHE_TTL_LISTING = 604800; // 7 days for listing embeddings
const BATCH_SIZE = 100; // Maximum items per batch

export class EmbeddingService {
  private openai: OpenAIService;

  constructor(openai: OpenAIService) {
    this.openai = openai;
  }

  /**
   * Generate embedding for a user search query with caching
   */
  async generateQueryEmbedding(query: string): Promise<EmbeddingResult> {
    const normalizedQuery = this.normalizeText(query);
    const cacheKey = `embedding:query:${this.hashText(normalizedQuery)}`;

    // Check cache
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return {
            embedding: JSON.parse(cached),
            text: query,
            tokenCount: 0,
            cached: true,
          };
        }
      } catch (error) {
        console.warn('Redis cache read failed:', error);
      }
    }

    // Generate embedding
    const result = await this.openai.createEmbedding(normalizedQuery);

    // Cache result
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_QUERY, JSON.stringify(result.embedding));
      } catch (error) {
        console.warn('Redis cache write failed:', error);
      }
    }

    return {
      ...result,
      text: query,
    };
  }

  /**
   * Generate embedding for a listing with caching
   */
  async generateListingEmbedding(listing: Listing): Promise<EmbeddingResult> {
    const cacheKey = `embedding:listing:${listing.id}`;

    // Check cache
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return {
            embedding: JSON.parse(cached),
            text: this.createListingText(listing),
            tokenCount: 0,
            cached: true,
          };
        }
      } catch (error) {
        console.warn('Redis cache read failed:', error);
      }
    }

    // Generate embedding
    const text = this.createListingText(listing);
    const result = await this.openai.createEmbedding(text);

    // Cache result
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_LISTING, JSON.stringify(result.embedding));
      } catch (error) {
        console.warn('Redis cache write failed:', error);
      }
    }

    return {
      ...result,
      text,
    };
  }

  /**
   * Generate embeddings for multiple listings in batch
   */
  async batchGenerateEmbeddings(listings: Listing[]): Promise<BatchEmbeddingResult> {
    const results = new Map<string, number[]>();
    const failedIds: string[] = [];
    let totalTokens = 0;

    // First, check cache for all listings
    const uncachedListings: Listing[] = [];

    for (const listing of listings) {
      if (redis) {
        try {
          const cacheKey = `embedding:listing:${listing.id}`;
          const cached = await redis.get(cacheKey);
          if (cached) {
            results.set(listing.id, JSON.parse(cached));
            continue;
          }
        } catch (error) {
          // Cache miss or error, will generate
        }
      }
      uncachedListings.push(listing);
    }

    // Process uncached listings in batches
    for (let i = 0; i < uncachedListings.length; i += BATCH_SIZE) {
      const batch = uncachedListings.slice(i, i + BATCH_SIZE);
      const items = batch.map((listing) => ({
        id: listing.id,
        text: this.createListingText(listing),
      }));

      try {
        const batchResult = await this.openai.createBatchEmbeddings(items);

        // Store results and update cache
        for (const [id, embedding] of batchResult.embeddings) {
          results.set(id, embedding);

          // Cache the embedding
          if (redis) {
            try {
              const cacheKey = `embedding:listing:${id}`;
              await redis.setex(cacheKey, CACHE_TTL_LISTING, JSON.stringify(embedding));
            } catch (error) {
              // Cache write failure is not critical
            }
          }
        }

        totalTokens += batchResult.totalTokens;
        failedIds.push(...batchResult.failedIds);
      } catch (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
        batch.forEach((listing) => failedIds.push(listing.id));
      }

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < uncachedListings.length) {
        await this.delay(100);
      }
    }

    return {
      embeddings: results,
      totalTokens,
      successCount: results.size,
      failedIds,
    };
  }

  /**
   * Invalidate cached embedding for a listing
   */
  async invalidateListingCache(listingId: string): Promise<void> {
    if (redis) {
      try {
        await redis.del(`embedding:listing:${listingId}`);
      } catch (error) {
        console.warn('Failed to invalidate embedding cache:', error);
      }
    }
  }

  /**
   * Invalidate all query embedding caches
   */
  async invalidateQueryCaches(): Promise<void> {
    if (redis) {
      try {
        // Use SCAN to find and delete query embedding keys
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            'MATCH',
            'embedding:query:*',
            'COUNT',
            100
          );
          cursor = nextCursor;

          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (error) {
        console.warn('Failed to invalidate query caches:', error);
      }
    }
  }

  /**
   * Create text representation of a listing for embedding
   * Combines relevant fields to capture semantic meaning
   */
  private createListingText(listing: Listing): string {
    const parts: string[] = [];

    // Title is most important
    if (listing.title) {
      parts.push(listing.title);
    }

    // Property and listing type
    const typeText = this.getTypeText(listing);
    if (typeText) {
      parts.push(typeText);
    }

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
      const priceText = listing.listing_type === 'rent'
        ? `${listing.price}€ mjesečno`
        : `${listing.price}€`;
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

    // Description (truncated to avoid token limits)
    if (listing.description) {
      const truncatedDesc = listing.description.slice(0, 500);
      parts.push(truncatedDesc);
    }

    return parts.join('. ');
  }

  /**
   * Get Croatian text for property and listing type
   */
  private getTypeText(listing: Listing): string {
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

    return `${propertyType} za ${listingType}`;
  }

  /**
   * Normalize text for consistent embedding and caching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Collapse whitespace
  }

  /**
   * Create hash of text for cache key
   */
  private hashText(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory function to create embedding service
export function createEmbeddingService(openai: OpenAIService): EmbeddingService {
  return new EmbeddingService(openai);
}
