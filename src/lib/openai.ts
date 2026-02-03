import OpenAI from 'openai';
import { env } from './env';

export const openai = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

// Model names for easy reference
export const MODELS = {
  GPT4O_MINI: 'gpt-4o-mini',
  EMBEDDING: 'text-embedding-3-small',
} as const;
