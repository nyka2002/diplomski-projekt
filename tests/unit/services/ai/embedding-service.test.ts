import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmbeddingService, createEmbeddingService } from '@/services/ai/embedding-service';
import { OpenAIService } from '@/services/ai/openai-client';
import { Listing } from '@/types/listing';
import { createMockListing } from '../../../fixtures/listings';

// Mock Redis
vi.mock('@/lib/redis', () => ({
  default: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
}));

import redis from '@/lib/redis';

// Mock OpenAI service
const mockOpenAI = {
  chatCompletion: vi.fn(),
  createEmbedding: vi.fn(),
  createBatchEmbeddings: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  getTotalUsage: vi.fn(),
  resetUsage: vi.fn(),
} as unknown as OpenAIService;

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;

  const mockEmbedding = Array(1536).fill(0.1);

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService = new EmbeddingService(mockOpenAI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateQueryEmbedding', () => {
    it('should return cached embedding if available', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(JSON.stringify(mockEmbedding));

      const result = await embeddingService.generateQueryEmbedding('Stan za najam');

      expect(result.cached).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.createEmbedding).not.toHaveBeenCalled();
    });

    it('should generate and cache embedding on cache miss', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'stan za najam',
        tokenCount: 5,
        cached: false,
      });

      const result = await embeddingService.generateQueryEmbedding('Stan za najam');

      expect(result.cached).toBe(false);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.createEmbedding).toHaveBeenCalled();
      expect(redis!.setex).toHaveBeenCalled();
    });

    it('should normalize query text for caching', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'stan za najam',
        tokenCount: 5,
        cached: false,
      });

      await embeddingService.generateQueryEmbedding('  STAN   za  NAJAM  ');

      // The embedding call should receive normalized text
      expect(mockOpenAI.createEmbedding).toHaveBeenCalledWith('stan za najam');
    });

    it('should handle Redis cache read failure gracefully', async () => {
      vi.mocked(redis!.get).mockRejectedValueOnce(new Error('Redis connection error'));
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'test query',
        tokenCount: 5,
        cached: false,
      });

      const result = await embeddingService.generateQueryEmbedding('test query');

      // Should continue and generate embedding
      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.createEmbedding).toHaveBeenCalled();
    });

    it('should handle Redis cache write failure gracefully', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'test query',
        tokenCount: 5,
        cached: false,
      });
      vi.mocked(redis!.setex).mockRejectedValueOnce(new Error('Redis write error'));

      // Should not throw
      const result = await embeddingService.generateQueryEmbedding('test query');

      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should preserve original query text in result', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'normalized text',
        tokenCount: 5,
        cached: false,
      });

      const originalQuery = 'Stan za najam u Zagrebu';
      const result = await embeddingService.generateQueryEmbedding(originalQuery);

      expect(result.text).toBe(originalQuery);
    });
  });

  describe('generateListingEmbedding', () => {
    const mockListing = createMockListing({
      id: 'listing-123',
      title: 'Dvosobni stan',
      description: 'Lijep stan u centru',
      location_city: 'Zagreb',
      rooms: 2,
      surface_area: 50,
      price: 650,
      listing_type: 'rent',
      has_parking: true,
    });

    it('should return cached embedding if available', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(JSON.stringify(mockEmbedding));

      const result = await embeddingService.generateListingEmbedding(mockListing);

      expect(result.cached).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(mockOpenAI.createEmbedding).not.toHaveBeenCalled();
    });

    it('should generate embedding with listing text on cache miss', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'listing text',
        tokenCount: 20,
        cached: false,
      });

      const result = await embeddingService.generateListingEmbedding(mockListing);

      expect(result.cached).toBe(false);
      expect(result.embedding).toEqual(mockEmbedding);

      // Check that the embedding call includes listing details
      const callArg = vi.mocked(mockOpenAI.createEmbedding).mock.calls[0][0];
      expect(callArg).toContain('Dvosobni stan');
      expect(callArg).toContain('Zagreb');
    });

    it('should cache embedding with listing ID key', async () => {
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: 'listing text',
        tokenCount: 20,
        cached: false,
      });

      await embeddingService.generateListingEmbedding(mockListing);

      expect(redis!.setex).toHaveBeenCalledWith(
        `embedding:listing:${mockListing.id}`,
        expect.any(Number),
        JSON.stringify(mockEmbedding)
      );
    });
  });

  describe('batchGenerateEmbeddings', () => {
    const mockListings = [
      createMockListing({ id: 'listing-1', title: 'Stan 1' }),
      createMockListing({ id: 'listing-2', title: 'Stan 2' }),
      createMockListing({ id: 'listing-3', title: 'Stan 3' }),
    ];

    it('should check cache for all listings first', async () => {
      // All cached
      vi.mocked(redis!.get)
        .mockResolvedValueOnce(JSON.stringify(mockEmbedding))
        .mockResolvedValueOnce(JSON.stringify(mockEmbedding))
        .mockResolvedValueOnce(JSON.stringify(mockEmbedding));

      const result = await embeddingService.batchGenerateEmbeddings(mockListings);

      expect(result.successCount).toBe(3);
      expect(mockOpenAI.createBatchEmbeddings).not.toHaveBeenCalled();
    });

    it('should only generate embeddings for uncached listings', async () => {
      // First two cached, third not
      vi.mocked(redis!.get)
        .mockResolvedValueOnce(JSON.stringify(mockEmbedding))
        .mockResolvedValueOnce(JSON.stringify(mockEmbedding))
        .mockResolvedValueOnce(null);

      const batchResult = {
        embeddings: new Map([['listing-3', mockEmbedding]]),
        totalTokens: 10,
        successCount: 1,
        failedIds: [],
      };
      vi.mocked(mockOpenAI.createBatchEmbeddings).mockResolvedValueOnce(batchResult);

      const result = await embeddingService.batchGenerateEmbeddings(mockListings);

      expect(result.successCount).toBe(3);
      expect(mockOpenAI.createBatchEmbeddings).toHaveBeenCalledTimes(1);

      // Check that only uncached listing was sent for embedding
      const callArg = vi.mocked(mockOpenAI.createBatchEmbeddings).mock.calls[0][0];
      expect(callArg).toHaveLength(1);
      expect(callArg[0].id).toBe('listing-3');
    });

    it('should cache newly generated embeddings', async () => {
      vi.mocked(redis!.get).mockResolvedValue(null);

      const batchResult = {
        embeddings: new Map([
          ['listing-1', mockEmbedding],
          ['listing-2', mockEmbedding],
          ['listing-3', mockEmbedding],
        ]),
        totalTokens: 30,
        successCount: 3,
        failedIds: [],
      };
      vi.mocked(mockOpenAI.createBatchEmbeddings).mockResolvedValueOnce(batchResult);

      await embeddingService.batchGenerateEmbeddings(mockListings);

      // Should cache each embedding
      expect(redis!.setex).toHaveBeenCalledTimes(3);
    });

    it('should track failed IDs', async () => {
      vi.mocked(redis!.get).mockResolvedValue(null);

      const batchResult = {
        embeddings: new Map([['listing-1', mockEmbedding]]),
        totalTokens: 10,
        successCount: 1,
        failedIds: ['listing-2', 'listing-3'],
      };
      vi.mocked(mockOpenAI.createBatchEmbeddings).mockResolvedValueOnce(batchResult);

      const result = await embeddingService.batchGenerateEmbeddings(mockListings);

      expect(result.failedIds).toContain('listing-2');
      expect(result.failedIds).toContain('listing-3');
    });

    it('should handle batch failure and add all IDs to failed', async () => {
      vi.mocked(redis!.get).mockResolvedValue(null);
      vi.mocked(mockOpenAI.createBatchEmbeddings).mockRejectedValueOnce(
        new Error('Batch failed')
      );

      const result = await embeddingService.batchGenerateEmbeddings(mockListings);

      expect(result.failedIds).toHaveLength(3);
    });
  });

  describe('invalidateListingCache', () => {
    it('should delete the cached embedding', async () => {
      await embeddingService.invalidateListingCache('listing-123');

      expect(redis!.del).toHaveBeenCalledWith('embedding:listing:listing-123');
    });

    it('should handle Redis deletion failure gracefully', async () => {
      vi.mocked(redis!.del).mockRejectedValueOnce(new Error('Delete failed'));

      // Should not throw
      await expect(
        embeddingService.invalidateListingCache('listing-123')
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateQueryCaches', () => {
    it('should scan and delete all query embedding keys', async () => {
      vi.mocked(redis!.scan)
        .mockResolvedValueOnce(['1', ['embedding:query:abc', 'embedding:query:def']])
        .mockResolvedValueOnce(['0', ['embedding:query:ghi']]);

      await embeddingService.invalidateQueryCaches();

      expect(redis!.scan).toHaveBeenCalled();
      expect(redis!.del).toHaveBeenCalledTimes(2);
    });

    it('should handle scan failure gracefully', async () => {
      vi.mocked(redis!.scan).mockRejectedValueOnce(new Error('Scan failed'));

      // Should not throw
      await expect(embeddingService.invalidateQueryCaches()).resolves.not.toThrow();
    });
  });

  describe('listing text generation', () => {
    it('should include title in listing text', async () => {
      const listing = createMockListing({ title: 'Prekrasan dvosobni stan' });
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: '',
        tokenCount: 10,
        cached: false,
      });

      await embeddingService.generateListingEmbedding(listing);

      const callArg = vi.mocked(mockOpenAI.createEmbedding).mock.calls[0][0];
      expect(callArg).toContain('Prekrasan dvosobni stan');
    });

    it('should include location in listing text', async () => {
      const listing = createMockListing({
        location_city: 'Zagreb',
        location_address: 'Trešnjevka',
      });
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: '',
        tokenCount: 10,
        cached: false,
      });

      await embeddingService.generateListingEmbedding(listing);

      const callArg = vi.mocked(mockOpenAI.createEmbedding).mock.calls[0][0];
      expect(callArg).toContain('Zagreb');
      expect(callArg).toContain('Trešnjevka');
    });

    it('should include amenities in listing text', async () => {
      const listing = createMockListing({
        has_parking: true,
        has_balcony: true,
        is_furnished: true,
      });
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: '',
        tokenCount: 10,
        cached: false,
      });

      await embeddingService.generateListingEmbedding(listing);

      const callArg = vi.mocked(mockOpenAI.createEmbedding).mock.calls[0][0];
      expect(callArg).toContain('parking');
      expect(callArg).toContain('balkon');
      expect(callArg).toContain('namješteno');
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(1000);
      const listing = createMockListing({ description: longDescription });
      vi.mocked(redis!.get).mockResolvedValueOnce(null);
      vi.mocked(mockOpenAI.createEmbedding).mockResolvedValueOnce({
        embedding: mockEmbedding,
        text: '',
        tokenCount: 10,
        cached: false,
      });

      await embeddingService.generateListingEmbedding(listing);

      const callArg = vi.mocked(mockOpenAI.createEmbedding).mock.calls[0][0];
      // Description should be truncated to 500 chars
      expect(callArg.length).toBeLessThan(1000 + 200); // Plus other fields
    });
  });

  describe('createEmbeddingService factory', () => {
    it('should create an EmbeddingService instance', () => {
      const service = createEmbeddingService(mockOpenAI);

      expect(service).toBeInstanceOf(EmbeddingService);
    });
  });
});
