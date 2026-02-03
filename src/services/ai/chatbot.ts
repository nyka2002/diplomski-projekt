import { ChatMessage } from '@/types/api';
import { ExtractedFilters } from '@/types/search';
import { OpenAIService } from './openai-client';
import { QueryExtractorService } from './query-extractor';
import { ChatContext, ChatbotResponse, AIServiceError } from './types';
import {
  CHATBOT_SYSTEM_PROMPT,
  CHATBOT_USER_TEMPLATE,
  CHATBOT_RESULT_SUMMARY_TEMPLATE,
} from './prompts';

const MAX_HISTORY_TURNS = 10;
const CLARIFICATION_THRESHOLD = 0.6;

export class ChatbotService {
  private openai: OpenAIService;
  private queryExtractor: QueryExtractorService;

  constructor(openai: OpenAIService, queryExtractor: QueryExtractorService) {
    this.openai = openai;
    this.queryExtractor = queryExtractor;
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    userMessage: string,
    context: ChatContext
  ): Promise<ChatbotResponse> {
    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });
    context.turnCount++;

    // Truncate history if too long
    this.truncateHistory(context);

    // Extract filters from the new message
    const extraction = await this.queryExtractor.extractFilters(userMessage);

    // Merge with existing context filters
    const mergedFilters = this.mergeFilters(context.currentFilters, extraction.filters);
    context.currentFilters = mergedFilters;

    // Determine if we need clarification
    const needsClarification =
      extraction.confidence.overall < CLARIFICATION_THRESHOLD ||
      extraction.confidence.ambiguousFields.length > 0;

    // Determine if we should search
    const shouldSearch = this.shouldPerformSearch(extraction, context);

    // Generate chatbot response
    const response = await this.generateResponse(
      context,
      extraction,
      needsClarification,
      shouldSearch
    );

    // Add assistant response to history
    context.conversationHistory.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Generate response with search results
   */
  async processMessageWithResults(
    userMessage: string,
    context: ChatContext,
    searchResults: {
      listings: Array<{
        title: string;
        price: number;
        location_city: string;
        rooms?: number;
        surface_area?: number;
        has_parking: boolean;
        has_balcony: boolean;
        is_furnished: boolean;
      }>;
      totalCount: number;
    }
  ): Promise<ChatbotResponse> {
    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });
    context.turnCount++;

    this.truncateHistory(context);

    // Generate result summary
    const resultSummary = CHATBOT_RESULT_SUMMARY_TEMPLATE(
      searchResults.listings.map((l) => ({
        ...l,
        location: l.location_city,
      })),
      searchResults.totalCount,
      Math.min(5, searchResults.listings.length)
    );

    // Generate response with results context
    const response = await this.generateResponseWithResults(context, resultSummary);

    // Add assistant response to history
    context.conversationHistory.push({
      role: 'assistant',
      content: response.message,
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Create a new chat context
   */
  createContext(): ChatContext {
    return {
      conversationHistory: [],
      currentFilters: undefined,
      lastSearchResults: undefined,
      sessionStartTime: new Date(),
      turnCount: 0,
    };
  }

  /**
   * Generate follow-up questions based on current context
   */
  generateFollowUpQuestions(
    filters: ExtractedFilters,
    hasResults: boolean,
    resultCount: number
  ): string[] {
    const questions: string[] = [];

    if (!hasResults || resultCount === 0) {
      questions.push('Želite li proširiti pretragu?');
      questions.push('Mogu li predložiti alternativne kriterije?');
      return questions;
    }

    // Suggest refinements based on missing filters
    if (!filters.listing_type) {
      questions.push('Je li za najam ili kupnju?');
    }

    if (!filters.location) {
      questions.push('U kojem gradu ili kvartu tražite?');
    }

    if (!filters.price_max && !filters.price_min) {
      questions.push('Koji vam je okvirni budžet?');
    }

    if (!filters.rooms_min && !filters.rooms_max) {
      questions.push('Koliko soba vam treba?');
    }

    // Suggest viewing options
    if (resultCount > 5) {
      questions.push('Želite li suziti pretragu?');
    }

    if (questions.length === 0) {
      questions.push('Želite li vidjeti više detalja o nekom stanu?');
      questions.push('Mogu li pomoći s nečim drugim?');
    }

    return questions.slice(0, 3);
  }

  /**
   * Generate chatbot response
   */
  private async generateResponse(
    context: ChatContext,
    extraction: Awaited<ReturnType<QueryExtractorService['extractFilters']>>,
    needsClarification: boolean,
    shouldSearch: boolean
  ): Promise<ChatbotResponse> {
    const messages = this.buildMessages(context, extraction, false, undefined);

    try {
      const response = await this.openai.chatCompletion(messages, {
        jsonMode: true,
        temperature: 0.7,
        maxTokens: 500,
      });

      const parsed = this.parseResponse(response.content);

      return {
        message: parsed.message,
        extractedFilters: context.currentFilters,
        suggestedQuestions:
          parsed.suggested_questions ||
          this.generateFollowUpQuestions(context.currentFilters || {}, false, 0),
        shouldSearch: shouldSearch && !needsClarification,
        clarificationNeeded: needsClarification,
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      console.error('Chatbot response generation failed:', error);

      // Return a graceful fallback response
      return this.createFallbackResponse(context, needsClarification, extraction.tokenUsage);
    }
  }

  /**
   * Generate response with search results context
   */
  private async generateResponseWithResults(
    context: ChatContext,
    resultSummary: string
  ): Promise<ChatbotResponse> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
    ];

    // Add conversation history
    for (const msg of context.conversationHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add result context
    messages.push({
      role: 'system',
      content: `Rezultati pretrage:\n${resultSummary}\n\nSažmi rezultate korisniku i predloži sljedeće korake.`,
    });

    try {
      const response = await this.openai.chatCompletion(messages, {
        jsonMode: true,
        temperature: 0.7,
        maxTokens: 600,
      });

      const parsed = this.parseResponse(response.content);
      const resultCount = parseInt(resultSummary.match(/Pronađeno (\d+)/)?.[1] || '0', 10);

      return {
        message: parsed.message,
        extractedFilters: context.currentFilters,
        suggestedQuestions:
          parsed.suggested_questions ||
          this.generateFollowUpQuestions(context.currentFilters || {}, true, resultCount),
        shouldSearch: false,
        clarificationNeeded: false,
        tokenUsage: response.tokenUsage,
      };
    } catch (error) {
      console.error('Chatbot result response generation failed:', error);
      return this.createResultFallbackResponse(context, resultSummary);
    }
  }

  /**
   * Build messages for OpenAI API
   */
  private buildMessages(
    context: ChatContext,
    extraction: Awaited<ReturnType<QueryExtractorService['extractFilters']>>,
    hasResults: boolean,
    resultCount?: number
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
    ];

    // Add conversation history (excluding last user message as we'll format it specially)
    const history = context.conversationHistory.slice(0, -1);
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add the latest user message with context
    const lastUserMessage = context.conversationHistory[context.conversationHistory.length - 1];
    if (lastUserMessage) {
      const userContext = CHATBOT_USER_TEMPLATE(
        lastUserMessage.content,
        JSON.stringify(context.currentFilters || {}),
        hasResults,
        resultCount
      );
      messages.push({ role: 'user', content: userContext });
    }

    return messages;
  }

  /**
   * Parse JSON response from OpenAI
   */
  private parseResponse(content: string): {
    message: string;
    should_search?: boolean;
    clarification_needed?: boolean;
    suggested_questions?: string[];
  } {
    try {
      return JSON.parse(content);
    } catch {
      // If JSON parsing fails, use the content as-is
      return {
        message: content,
        suggested_questions: [],
      };
    }
  }

  /**
   * Create fallback response when AI fails
   */
  private createFallbackResponse(
    context: ChatContext,
    needsClarification: boolean,
    tokenUsage: ChatbotResponse['tokenUsage']
  ): ChatbotResponse {
    let message: string;

    if (needsClarification) {
      message =
        'Razumijem da tražite nekretninu. Možete li mi dati više detalja? Na primjer, je li za najam ili kupnju, u kojem gradu, i koji vam je okvirni budžet?';
    } else {
      message = 'Hvala na upitu! Pretragujem bazu nekretnina prema vašim kriterijima...';
    }

    return {
      message,
      extractedFilters: context.currentFilters,
      suggestedQuestions: this.generateFollowUpQuestions(
        context.currentFilters || {},
        false,
        0
      ),
      shouldSearch: !needsClarification,
      clarificationNeeded: needsClarification,
      tokenUsage,
    };
  }

  /**
   * Create fallback response for results
   */
  private createResultFallbackResponse(
    context: ChatContext,
    resultSummary: string
  ): ChatbotResponse {
    return {
      message: resultSummary,
      extractedFilters: context.currentFilters,
      suggestedQuestions: [
        'Želite li suziti pretragu?',
        'Trebate li više informacija o nekom stanu?',
      ],
      shouldSearch: false,
      clarificationNeeded: false,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUSD: 0,
      },
    };
  }

  /**
   * Truncate conversation history if too long
   */
  private truncateHistory(context: ChatContext): void {
    if (context.conversationHistory.length > MAX_HISTORY_TURNS * 2) {
      context.conversationHistory = context.conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
    }
  }

  /**
   * Merge existing filters with new filters
   */
  private mergeFilters(
    existing?: ExtractedFilters,
    newFilters?: ExtractedFilters
  ): ExtractedFilters {
    if (!existing) return newFilters || {};
    if (!newFilters) return existing;

    // New values override old ones, but preserve unmentioned fields
    const merged: ExtractedFilters = { ...existing };

    for (const [key, value] of Object.entries(newFilters)) {
      if (value !== undefined && value !== null) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }

    return merged;
  }

  /**
   * Determine if we should perform a search
   */
  private shouldPerformSearch(
    extraction: Awaited<ReturnType<QueryExtractorService['extractFilters']>>,
    context: ChatContext
  ): boolean {
    // Don't search on first message if confidence is low
    if (context.turnCount === 1 && extraction.confidence.overall < 0.5) {
      return false;
    }

    // Search if we have at least one meaningful filter
    const filters = context.currentFilters || {};
    const hasFilters =
      filters.listing_type ||
      filters.property_type ||
      filters.price_max ||
      filters.location ||
      filters.rooms_min ||
      filters.rooms_max;

    return Boolean(hasFilters);
  }
}

// Factory function
export function createChatbot(
  openai: OpenAIService,
  queryExtractor: QueryExtractorService
): ChatbotService {
  return new ChatbotService(openai, queryExtractor);
}
