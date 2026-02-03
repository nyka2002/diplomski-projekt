export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatRequest {
  query: string;
  conversation_history?: ChatMessage[];
  user_id?: string;
}

export interface ChatResponse extends ApiResponse {
  data: {
    message: string;
    extracted_filters?: any;
    listings?: any[];
    follow_up_questions?: string[];
  };
}
