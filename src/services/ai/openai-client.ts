import OpenAI from 'openai';
import { openai, MODELS } from '@/lib/openai';
import {
  OpenAIClientConfig,
  TokenUsage,
  RateLimiterState,
  ChatCompletionOptions,
  ChatCompletionResult,
  EmbeddingResult,
  BatchEmbeddingResult,
  AIServiceError,
  DEFAULT_OPENAI_CONFIG,
  OPENAI_COSTS,
} from './types';

type ChatMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export class OpenAIService {
  private client: OpenAI | null;
  private config: OpenAIClientConfig;
  private rateLimiter: RateLimiterState;
  private totalUsage: TokenUsage;

  constructor(config: Partial<OpenAIClientConfig> = {}) {
    this.client = openai;
    this.config = { ...DEFAULT_OPENAI_CONFIG, ...config };
    this.rateLimiter = {
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      minuteStartTime: Date.now(),
    };
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    };
  }

  /**
   * Check if OpenAI client is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get total token usage for this session
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Reset usage tracking
   */
  resetUsage(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    };
  }

  /**
   * Chat completion with GPT-4o-mini
   */
  async chatCompletion(
    messages: ChatMessageParam[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    if (!this.client) {
      throw new AIServiceError(
        'OpenAI client is not configured. Please set OPENAI_API_KEY in .env.local',
        'OPENAI_NOT_CONFIGURED',
        false
      );
    }

    await this.checkRateLimit();

    return this.withRetry(async () => {
      const response = await this.client!.chat.completions.create({
        model: MODELS.GPT4O_MINI,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1000,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      });

      const usage = response.usage;
      const tokenUsage = this.calculateTokenUsage(
        usage?.prompt_tokens ?? 0,
        usage?.completion_tokens ?? 0,
        'gpt-4o-mini'
      );

      this.trackUsage(tokenUsage);

      return {
        content: response.choices[0]?.message?.content ?? '',
        tokenUsage,
        finishReason: response.choices[0]?.finish_reason ?? 'unknown',
      };
    });
  }

  /**
   * Generate a single embedding
   */
  async createEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.client) {
      throw new AIServiceError(
        'OpenAI client is not configured. Please set OPENAI_API_KEY in .env.local',
        'OPENAI_NOT_CONFIGURED',
        false
      );
    }

    await this.checkRateLimit();

    return this.withRetry(async () => {
      const response = await this.client!.embeddings.create({
        model: MODELS.EMBEDDING,
        input: text,
      });

      const tokenCount = response.usage?.total_tokens ?? 0;
      const tokenUsage = this.calculateTokenUsage(tokenCount, 0, 'text-embedding-3-small');
      this.trackUsage(tokenUsage);

      return {
        embedding: response.data[0].embedding,
        text,
        tokenCount,
        cached: false,
      };
    });
  }

  /**
   * Generate embeddings in batch
   */
  async createBatchEmbeddings(
    items: Array<{ id: string; text: string }>
  ): Promise<BatchEmbeddingResult> {
    if (!this.client) {
      throw new AIServiceError(
        'OpenAI client is not configured. Please set OPENAI_API_KEY in .env.local',
        'OPENAI_NOT_CONFIGURED',
        false
      );
    }

    const results = new Map<string, number[]>();
    const failedIds: string[] = [];
    let totalTokens = 0;

    // OpenAI embeddings API supports batch input
    const texts = items.map((item) => item.text);

    await this.checkRateLimit();

    try {
      const response = await this.withRetry(async () => {
        return this.client!.embeddings.create({
          model: MODELS.EMBEDDING,
          input: texts,
        });
      });

      totalTokens = response.usage?.total_tokens ?? 0;

      // Map embeddings back to IDs
      response.data.forEach((embedding, index) => {
        results.set(items[index].id, embedding.embedding);
      });

      const tokenUsage = this.calculateTokenUsage(totalTokens, 0, 'text-embedding-3-small');
      this.trackUsage(tokenUsage);
    } catch (error) {
      // If batch fails, try individual items
      console.warn('Batch embedding failed, trying individual items:', error);

      for (const item of items) {
        try {
          const result = await this.createEmbedding(item.text);
          results.set(item.id, result.embedding);
          totalTokens += result.tokenCount;
        } catch (itemError) {
          console.error(`Failed to embed item ${item.id}:`, itemError);
          failedIds.push(item.id);
        }
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
   * Calculate token usage and cost
   */
  private calculateTokenUsage(
    promptTokens: number,
    completionTokens: number,
    model: 'gpt-4o-mini' | 'text-embedding-3-small'
  ): TokenUsage {
    const costs = OPENAI_COSTS[model];
    const estimatedCostUSD =
      promptTokens * costs.input + completionTokens * costs.output;

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUSD,
    };
  }

  /**
   * Track usage for session totals
   */
  private trackUsage(usage: TokenUsage): void {
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
    this.totalUsage.estimatedCostUSD += usage.estimatedCostUSD;

    // Update rate limiter
    this.rateLimiter.requestsThisMinute++;
    this.rateLimiter.tokensThisMinute += usage.totalTokens;
  }

  /**
   * Check and wait for rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const minuteElapsed = now - this.rateLimiter.minuteStartTime;

    // Reset counters if minute has passed
    if (minuteElapsed >= 60000) {
      this.rateLimiter = {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        minuteStartTime: now,
      };
      return;
    }

    // Check if we're approaching limits
    const requestsRemaining = this.config.rateLimitRPM - this.rateLimiter.requestsThisMinute;
    const tokensRemaining = this.config.rateLimitTPM - this.rateLimiter.tokensThisMinute;

    if (requestsRemaining <= 5 || tokensRemaining <= 1000) {
      // Wait for the remainder of the minute
      const waitTime = 60000 - minuteElapsed + 100; // Add 100ms buffer
      console.log(`Rate limit approaching, waiting ${waitTime}ms...`);
      await this.delay(waitTime);

      // Reset counters
      this.rateLimiter = {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        minuteStartTime: Date.now(),
      };
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryableError(error)) {
          throw this.wrapError(error);
        }

        const delay = this.getBackoffDelay(attempt, error);
        console.warn(
          `OpenAI API error (attempt ${attempt + 1}/${this.config.maxRetries}), retrying in ${delay}ms:`,
          (error as Error).message
        );
        await this.delay(delay);
      }
    }

    throw this.wrapError(lastError!);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof OpenAI.APIError) {
      // Retry on rate limits and server errors
      return (
        error.status === 429 || // Rate limit
        error.status === 500 || // Internal server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504 // Gateway timeout
      );
    }

    // Retry on network errors
    if (error instanceof Error) {
      return (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('network')
      );
    }

    return false;
  }

  /**
   * Calculate backoff delay
   */
  private getBackoffDelay(attempt: number, error: unknown): number {
    // Check for Retry-After header
    if (error instanceof OpenAI.APIError && error.headers) {
      const retryAfter = error.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
    }

    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
    return Math.min(baseDelay + jitter, this.config.maxRetryDelayMs);
  }

  /**
   * Wrap error in AIServiceError
   */
  private wrapError(error: unknown): AIServiceError {
    if (error instanceof AIServiceError) {
      return error;
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return new AIServiceError(
          'OpenAI rate limit exceeded',
          'RATE_LIMITED',
          true,
          error
        );
      }
      return new AIServiceError(
        `OpenAI API error: ${error.message}`,
        'API_ERROR',
        this.isRetryableError(error),
        error
      );
    }

    return new AIServiceError(
      `Unexpected error: ${(error as Error).message}`,
      'API_ERROR',
      false,
      error as Error
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();
