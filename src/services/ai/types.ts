import { ExtractedFilters } from '@/types/search';
import { ChatMessage } from '@/types/api';

// OpenAI client configuration
export interface OpenAIClientConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  rateLimitRPM: number; // Requests per minute
  rateLimitTPM: number; // Tokens per minute
}

// Token usage tracking
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

// Rate limiter state
export interface RateLimiterState {
  requestsThisMinute: number;
  tokensThisMinute: number;
  minuteStartTime: number;
}

// Chat completion options
export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// Chat completion result
export interface ChatCompletionResult {
  content: string;
  tokenUsage: TokenUsage;
  finishReason: string;
}

// Embedding result
export interface EmbeddingResult {
  embedding: number[];
  text: string;
  tokenCount: number;
  cached: boolean;
}

// Batch embedding result
export interface BatchEmbeddingResult {
  embeddings: Map<string, number[]>; // id -> embedding
  totalTokens: number;
  successCount: number;
  failedIds: string[];
}

// Query extraction confidence scores
export interface ExtractionConfidence {
  overall: number; // 0-1
  listing_type: number;
  price: number;
  location: number;
  rooms: number;
  amenities: number;
  ambiguousFields: string[]; // Fields that need clarification
}

// Query extraction result
export interface ExtractionResult {
  filters: ExtractedFilters;
  confidence: ExtractionConfidence;
  originalQuery: string;
  normalizedQuery: string;
  language: 'hr' | 'en' | 'mixed';
  tokenUsage: TokenUsage;
}

// Chatbot context for conversation management
export interface ChatContext {
  conversationHistory: ChatMessage[];
  currentFilters?: ExtractedFilters;
  lastSearchResults?: string[]; // Listing IDs
  sessionStartTime: Date;
  turnCount: number;
}

// Chatbot response
export interface ChatbotResponse {
  message: string;
  extractedFilters?: ExtractedFilters;
  suggestedQuestions: string[];
  shouldSearch: boolean;
  clarificationNeeded: boolean;
  tokenUsage: TokenUsage;
}

// AI Service error types
export type AIErrorCode =
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'API_ERROR'
  | 'EMBEDDING_FAILED'
  | 'EXTRACTION_FAILED'
  | 'SEARCH_FAILED'
  | 'OPENAI_NOT_CONFIGURED';

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public retryable: boolean,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Default configuration
export const DEFAULT_OPENAI_CONFIG: OpenAIClientConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 10000,
  rateLimitRPM: 500, // GPT-4o-mini Tier 1 limit
  rateLimitTPM: 200000, // GPT-4o-mini Tier 1 limit
};

// Cost per token (as of 2024)
export const OPENAI_COSTS = {
  'gpt-4o-mini': {
    input: 0.00000015, // $0.15 per 1M tokens
    output: 0.0000006, // $0.60 per 1M tokens
  },
  'text-embedding-3-small': {
    input: 0.00000002, // $0.02 per 1M tokens
    output: 0,
  },
};
