import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatbotService, createChatbot } from '@/services/ai/chatbot';
import { OpenAIService } from '@/services/ai/openai-client';
import { QueryExtractorService } from '@/services/ai/query-extractor';
import { ChatContext } from '@/services/ai/types';

// Mock OpenAI service
const mockOpenAI = {
  chatCompletion: vi.fn(),
  createEmbedding: vi.fn(),
  createBatchEmbeddings: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  getTotalUsage: vi.fn(),
  resetUsage: vi.fn(),
} as unknown as OpenAIService;

// Mock query extractor
const mockQueryExtractor = {
  extractFilters: vi.fn(),
} as unknown as QueryExtractorService;

describe('ChatbotService', () => {
  let chatbot: ChatbotService;
  let context: ChatContext;

  const defaultTokenUsage = {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimatedCostUSD: 0.001,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chatbot = new ChatbotService(mockOpenAI, mockQueryExtractor);
    context = chatbot.createContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createContext', () => {
    it('should create a new context with empty history', () => {
      const ctx = chatbot.createContext();

      expect(ctx.conversationHistory).toEqual([]);
      expect(ctx.currentFilters).toBeUndefined();
      expect(ctx.lastSearchResults).toBeUndefined();
      expect(ctx.turnCount).toBe(0);
      expect(ctx.sessionStartTime).toBeInstanceOf(Date);
    });
  });

  describe('processMessage', () => {
    beforeEach(() => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: { listing_type: 'rent', location: 'Zagreb' },
        confidence: {
          overall: 0.85,
          listing_type: 0.9,
          price: 0.8,
          location: 0.9,
          rooms: 0.7,
          amenities: 0.6,
          ambiguousFields: [],
        },
        originalQuery: 'Stan za najam u Zagrebu',
        normalizedQuery: 'stan za najam u zagrebu',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValue({
        content: JSON.stringify({
          message: 'Tražim stanove za najam u Zagrebu.',
          suggested_questions: ['Koji vam je budžet?'],
        }),
        tokenUsage: defaultTokenUsage,
        finishReason: 'stop',
      });
    });

    it('should add user message to conversation history', async () => {
      await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(context.conversationHistory).toHaveLength(2); // user + assistant
      expect(context.conversationHistory[0].role).toBe('user');
      expect(context.conversationHistory[0].content).toBe('Stan za najam u Zagrebu');
    });

    it('should add assistant response to conversation history', async () => {
      await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(context.conversationHistory[1].role).toBe('assistant');
      expect(context.conversationHistory[1].content).toBeTruthy();
    });

    it('should increment turn count', async () => {
      expect(context.turnCount).toBe(0);

      await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(context.turnCount).toBe(1);
    });

    it('should extract and store filters in context', async () => {
      await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(context.currentFilters).toEqual({
        listing_type: 'rent',
        location: 'Zagreb',
      });
    });

    it('should return extracted filters in response', async () => {
      const response = await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(response.extractedFilters).toEqual({
        listing_type: 'rent',
        location: 'Zagreb',
      });
    });

    it('should return suggested questions', async () => {
      const response = await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(response.suggestedQuestions).toContain('Koji vam je budžet?');
    });

    it('should indicate search should be performed when confidence is high', async () => {
      const response = await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(response.shouldSearch).toBe(true);
      expect(response.clarificationNeeded).toBe(false);
    });

    it('should request clarification when confidence is low', async () => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: {},
        confidence: {
          overall: 0.4,
          listing_type: 0.3,
          price: 0.2,
          location: 0.3,
          rooms: 0.2,
          amenities: 0.2,
          ambiguousFields: ['listing_type', 'location'],
        },
        originalQuery: 'nekretnina',
        normalizedQuery: 'nekretnina',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      const response = await chatbot.processMessage('nekretnina', context);

      expect(response.clarificationNeeded).toBe(true);
    });

    it('should not search on first turn with very low confidence', async () => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: {},
        confidence: {
          overall: 0.3,
          listing_type: 0,
          price: 0,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'pozdrav',
        normalizedQuery: 'pozdrav',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      const response = await chatbot.processMessage('pozdrav', context);

      expect(response.shouldSearch).toBe(false);
    });
  });

  describe('filter merging', () => {
    beforeEach(() => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValue({
        content: JSON.stringify({
          message: 'Razumijem.',
          suggested_questions: [],
        }),
        tokenUsage: defaultTokenUsage,
        finishReason: 'stop',
      });
    });

    it('should merge new filters with existing ones', async () => {
      // First message - set initial filters
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValueOnce({
        filters: { listing_type: 'rent', location: 'Zagreb' },
        confidence: {
          overall: 0.85,
          listing_type: 0.9,
          price: 0,
          location: 0.9,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'Stan za najam u Zagrebu',
        normalizedQuery: 'stan za najam u zagrebu',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      await chatbot.processMessage('Stan za najam u Zagrebu', context);

      expect(context.currentFilters).toEqual({
        listing_type: 'rent',
        location: 'Zagreb',
      });

      // Second message - add price filter
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValueOnce({
        filters: { price_max: 700 },
        confidence: {
          overall: 0.9,
          listing_type: 0,
          price: 0.95,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'do 700 eura',
        normalizedQuery: 'do 700 eura',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      await chatbot.processMessage('do 700 eura', context);

      // Should have merged filters
      expect(context.currentFilters).toEqual({
        listing_type: 'rent',
        location: 'Zagreb',
        price_max: 700,
      });
    });

    it('should override existing filter values with new ones', async () => {
      // First message
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValueOnce({
        filters: { price_max: 500 },
        confidence: {
          overall: 0.9,
          listing_type: 0,
          price: 0.95,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'do 500 eura',
        normalizedQuery: 'do 500 eura',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      await chatbot.processMessage('do 500 eura', context);

      expect(context.currentFilters?.price_max).toBe(500);

      // Second message - update price
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValueOnce({
        filters: { price_max: 800 },
        confidence: {
          overall: 0.9,
          listing_type: 0,
          price: 0.95,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'zapravo do 800 eura',
        normalizedQuery: 'zapravo do 800 eura',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      await chatbot.processMessage('zapravo do 800 eura', context);

      expect(context.currentFilters?.price_max).toBe(800);
    });
  });

  describe('conversation history truncation', () => {
    it('should truncate history when exceeding max turns', async () => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: {},
        confidence: {
          overall: 0.7,
          listing_type: 0,
          price: 0,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'test',
        normalizedQuery: 'test',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValue({
        content: JSON.stringify({
          message: 'Razumijem.',
          suggested_questions: [],
        }),
        tokenUsage: defaultTokenUsage,
        finishReason: 'stop',
      });

      // Add many messages (MAX_HISTORY_TURNS * 2 = 20)
      for (let i = 0; i < 25; i++) {
        await chatbot.processMessage(`Message ${i}`, context);
      }

      // History should be truncated. The implementation truncates to 20 BEFORE adding
      // the assistant response, so final length is 21 (20 + assistant message)
      expect(context.conversationHistory.length).toBeLessThanOrEqual(21);
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('should suggest expanding search when no results', () => {
      const questions = chatbot.generateFollowUpQuestions({}, false, 0);

      expect(questions).toContain('Želite li proširiti pretragu?');
    });

    it('should suggest budget when price filter is missing', () => {
      const questions = chatbot.generateFollowUpQuestions(
        { listing_type: 'rent', location: 'Zagreb' },
        true,
        10
      );

      expect(questions).toContain('Koji vam je okvirni budžet?');
    });

    it('should suggest location when missing', () => {
      const questions = chatbot.generateFollowUpQuestions(
        { listing_type: 'rent' },
        true,
        10
      );

      expect(questions).toContain('U kojem gradu ili kvartu tražite?');
    });

    it('should suggest listing type when missing', () => {
      const questions = chatbot.generateFollowUpQuestions({ location: 'Zagreb' }, true, 10);

      expect(questions).toContain('Je li za najam ili kupnju?');
    });

    it('should suggest narrowing search when many results', () => {
      const questions = chatbot.generateFollowUpQuestions(
        { listing_type: 'rent', location: 'Zagreb', price_max: 700 },
        true,
        50
      );

      expect(questions).toContain('Želite li suziti pretragu?');
    });

    it('should limit to maximum 3 questions', () => {
      const questions = chatbot.generateFollowUpQuestions({}, true, 100);

      expect(questions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('should return fallback response when OpenAI fails', async () => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: { listing_type: 'rent' },
        confidence: {
          overall: 0.8,
          listing_type: 0.9,
          price: 0,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: [],
        },
        originalQuery: 'Stan za najam',
        normalizedQuery: 'stan za najam',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      vi.mocked(mockOpenAI.chatCompletion).mockRejectedValue(new Error('API Error'));

      const response = await chatbot.processMessage('Stan za najam', context);

      // Should return a fallback response instead of throwing
      expect(response.message).toBeTruthy();
      expect(response.message).toContain('Hvala na upitu');
    });

    it('should return clarification fallback when confidence is low and OpenAI fails', async () => {
      vi.mocked(mockQueryExtractor.extractFilters).mockResolvedValue({
        filters: {},
        confidence: {
          overall: 0.4,
          listing_type: 0,
          price: 0,
          location: 0,
          rooms: 0,
          amenities: 0,
          ambiguousFields: ['listing_type'],
        },
        originalQuery: 'nešto',
        normalizedQuery: 'nešto',
        language: 'hr',
        tokenUsage: defaultTokenUsage,
      });

      vi.mocked(mockOpenAI.chatCompletion).mockRejectedValue(new Error('API Error'));

      const response = await chatbot.processMessage('nešto', context);

      expect(response.message).toContain('Možete li mi dati više detalja');
      expect(response.clarificationNeeded).toBe(true);
    });
  });

  describe('processMessageWithResults', () => {
    it('should include search results in response', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValue({
        content: JSON.stringify({
          message: 'Pronašao sam 5 stanova koji odgovaraju vašim kriterijima.',
          suggested_questions: ['Želite li vidjeti više?'],
        }),
        tokenUsage: defaultTokenUsage,
        finishReason: 'stop',
      });

      const searchResults = {
        listings: [
          {
            title: 'Stan u Zagrebu',
            price: 650,
            location_city: 'Zagreb',
            rooms: 2,
            surface_area: 50,
            has_parking: true,
            has_balcony: true,
            is_furnished: true,
          },
        ],
        totalCount: 15,
      };

      const response = await chatbot.processMessageWithResults(
        'Pokaži mi rezultate',
        context,
        searchResults
      );

      expect(response.message).toBeTruthy();
      expect(response.shouldSearch).toBe(false);
    });

    it('should add messages to history', async () => {
      vi.mocked(mockOpenAI.chatCompletion).mockResolvedValue({
        content: JSON.stringify({
          message: 'Evo rezultata.',
          suggested_questions: [],
        }),
        tokenUsage: defaultTokenUsage,
        finishReason: 'stop',
      });

      const searchResults = {
        listings: [],
        totalCount: 0,
      };

      await chatbot.processMessageWithResults('Pokaži rezultate', context, searchResults);

      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('createChatbot factory', () => {
    it('should create a ChatbotService instance', () => {
      const service = createChatbot(mockOpenAI, mockQueryExtractor);

      expect(service).toBeInstanceOf(ChatbotService);
    });
  });
});
