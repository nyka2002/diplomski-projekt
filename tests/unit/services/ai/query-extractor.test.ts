import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryExtractorService } from '@/services/ai/query-extractor';
import { OpenAIService } from '@/services/ai/openai-client';
import { AIServiceError } from '@/services/ai/types';

// Mock OpenAI service
const mockOpenAI = {
  chatCompletion: vi.fn(),
  createEmbedding: vi.fn(),
  createBatchEmbeddings: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  getTotalUsage: vi.fn(),
  resetUsage: vi.fn(),
} as unknown as OpenAIService;

describe('QueryExtractorService', () => {
  let queryExtractor: QueryExtractorService;

  beforeEach(() => {
    vi.clearAllMocks();
    queryExtractor = new QueryExtractorService(mockOpenAI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractFilters', () => {
    it('should return empty filters for empty query', async () => {
      const result = await queryExtractor.extractFilters('');

      expect(result.filters).toEqual({});
      expect(result.confidence.overall).toBe(0);
      expect(result.confidence.ambiguousFields).toContain('all');
      expect(mockOpenAI.chatCompletion).not.toHaveBeenCalled();
    });

    it('should return empty filters for whitespace-only query', async () => {
      const result = await queryExtractor.extractFilters('   ');

      expect(result.filters).toEqual({});
      expect(result.confidence.overall).toBe(0);
    });

    it('should extract listing_type for rent query', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            listing_type: 'rent',
          },
          confidence: {
            overall: 0.9,
            listing_type: 0.95,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Tražim stan za najam');

      expect(result.filters.listing_type).toBe('rent');
      expect(result.confidence.listing_type).toBe(0.95);
    });

    it('should extract listing_type for sale query', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            listing_type: 'sale',
            property_type: 'house',
          },
          confidence: {
            overall: 0.9,
            listing_type: 0.95,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Kuća na prodaju');

      expect(result.filters.listing_type).toBe('sale');
      expect(result.filters.property_type).toBe('house');
    });

    it('should extract price_max correctly', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            listing_type: 'rent',
            price_max: 700,
          },
          confidence: {
            overall: 0.85,
            price: 0.9,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Stan za najam do 700€');

      expect(result.filters.price_max).toBe(700);
    });

    it('should extract rooms correctly', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            rooms_min: 2,
            rooms_max: 2,
          },
          confidence: {
            overall: 0.9,
            rooms: 0.95,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Dvosobni stan');

      expect(result.filters.rooms_min).toBe(2);
      expect(result.filters.rooms_max).toBe(2);
    });

    it('should extract location and normalize Croatian city names', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            location: 'zagreb',
          },
          confidence: {
            overall: 0.9,
            location: 0.95,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Stan u Zagrebu');

      expect(result.filters.location).toBe('Zagreb');
    });

    it('should normalize city names with diacritics', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            location: 'varazdin',
          },
          confidence: {
            overall: 0.9,
            location: 0.95,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Stan u Varaždinu');

      expect(result.filters.location).toBe('Varaždin');
    });

    it('should extract boolean amenities', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            has_parking: true,
            has_balcony: true,
            is_furnished: true,
          },
          confidence: {
            overall: 0.85,
            amenities: 0.9,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters(
        'Namješten stan s parkingom i balkonom'
      );

      expect(result.filters.has_parking).toBe(true);
      expect(result.filters.has_balcony).toBe(true);
      expect(result.filters.is_furnished).toBe(true);
    });

    it('should handle complex queries with multiple filters', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            listing_type: 'rent',
            property_type: 'apartment',
            rooms_min: 2,
            price_max: 1000,
            location: 'Zagreb',
            has_parking: true,
            has_balcony: true,
            is_furnished: true,
          },
          confidence: {
            overall: 0.8,
            listing_type: 0.95,
            price: 0.9,
            location: 0.9,
            rooms: 0.85,
            amenities: 0.8,
          },
        }),
        tokenUsage: {
          promptTokens: 150,
          completionTokens: 80,
          totalTokens: 230,
          estimatedCostUSD: 0.002,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters(
        'Tražim potpuno opremljen dvosobni stan za mjesečni najam s parkirnim mjestom i balkonom, do 1000€'
      );

      expect(result.filters.listing_type).toBe('rent');
      expect(result.filters.rooms_min).toBe(2);
      expect(result.filters.price_max).toBe(1000);
      expect(result.filters.has_parking).toBe(true);
      expect(result.filters.has_balcony).toBe(true);
      expect(result.filters.is_furnished).toBe(true);
    });

    it('should handle malformed JSON response gracefully', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: 'This is not valid JSON',
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Stan za najam');

      // Should return empty filters but not throw
      expect(result.filters).toEqual({});
    });

    it('should validate and reject invalid listing types', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            listing_type: 'invalid_type',
          },
          confidence: {
            overall: 0.5,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Test query');

      expect(result.filters.listing_type).toBeUndefined();
    });

    it('should validate and reject invalid property types', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            property_type: 'spaceship',
          },
          confidence: {
            overall: 0.5,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Test query');

      expect(result.filters.property_type).toBeUndefined();
    });

    it('should clamp negative prices to undefined', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {
            price_max: -100,
            price_min: -50,
          },
          confidence: {
            overall: 0.5,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Test query');

      expect(result.filters.price_max).toBeUndefined();
      expect(result.filters.price_min).toBeUndefined();
    });

    it('should clamp confidence scores to 0-1 range', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {},
          confidence: {
            overall: 1.5,
            listing_type: -0.5,
          },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Test query');

      expect(result.confidence.overall).toBe(1);
      expect(result.confidence.listing_type).toBe(0);
    });

    it('should detect Croatian language', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {},
          confidence: { overall: 0.5 },
          language: 'hr',
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Tražim stan za najam');

      expect(result.language).toBe('hr');
    });

    it('should detect English language', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {},
          confidence: { overall: 0.5 },
          language: 'en',
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters(
        'Looking for an apartment for rent'
      );

      expect(result.language).toBe('en');
    });

    it('should throw AIServiceError when OpenAI fails', async () => {
      const error = new AIServiceError('API Error', 'API_ERROR', false);
      vi.mocked(mockOpenAI.chatCompletion).mockRejectedValueOnce(error);

      await expect(queryExtractor.extractFilters('Test query')).rejects.toThrow(
        AIServiceError
      );
    });

    it('should wrap non-AIServiceError errors', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockRejectedValueOnce(
        new Error('Unknown error')
      );

      await expect(queryExtractor.extractFilters('Test query')).rejects.toThrow(
        AIServiceError
      );
    });

    it('should include original query in result', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {},
          confidence: { overall: 0.5 },
        }),
        tokenUsage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUSD: 0.001,
        },
        finishReason: 'stop',
      });

      const query = 'Tražim dvosobni stan';
      const result = await queryExtractor.extractFilters(query);

      expect(result.originalQuery).toBe(query);
    });

    it('should track token usage', async () => {
      const expectedTokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostUSD: 0.001,
      };

      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          filters: {},
          confidence: { overall: 0.5 },
        }),
        tokenUsage: expectedTokenUsage,
        finishReason: 'stop',
      });

      const result = await queryExtractor.extractFilters('Test query');

      expect(result.tokenUsage).toEqual(expectedTokenUsage);
    });
  });
});
