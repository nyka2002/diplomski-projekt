// Types
export * from './types';

// Services
export { OpenAIService, openaiService } from './openai-client';
export { EmbeddingService, createEmbeddingService } from './embedding-service';
export { QueryExtractorService, createQueryExtractor } from './query-extractor';
export { ChatbotService, createChatbot } from './chatbot';

// Prompts
export {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_TEMPLATE,
  CHATBOT_SYSTEM_PROMPT,
  CHATBOT_USER_TEMPLATE,
  CHATBOT_RESULT_SUMMARY_TEMPLATE,
} from './prompts';

// Factory function to create all AI services
import { OpenAIService } from './openai-client';
import { createEmbeddingService } from './embedding-service';
import { createQueryExtractor } from './query-extractor';
import { createChatbot } from './chatbot';

export interface AIServices {
  openai: OpenAIService;
  embedding: ReturnType<typeof createEmbeddingService>;
  queryExtractor: ReturnType<typeof createQueryExtractor>;
  chatbot: ReturnType<typeof createChatbot>;
}

/**
 * Create all AI services with shared OpenAI client
 */
export function createAIServices(): AIServices {
  const openai = new OpenAIService();
  const embedding = createEmbeddingService(openai);
  const queryExtractor = createQueryExtractor(openai);
  const chatbot = createChatbot(openai, queryExtractor);

  return {
    openai,
    embedding,
    queryExtractor,
    chatbot,
  };
}
