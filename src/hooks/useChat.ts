'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { ChatMessage } from '@/types/api';
import type { ExtractedFilters } from '@/types/search';
import type { Listing } from '@/types/listing';

interface ChatResponseData {
  message: string;
  extracted_filters?: ExtractedFilters;
  listings?: Listing[];
  follow_up_questions?: string[];
  total_matches?: number;
  session_id?: string;
  cached?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (query: string) => void;
  isLoading: boolean;
  error: string | null;
  listings: Listing[];
  extractedFilters: ExtractedFilters | null;
  suggestedQuestions: string[];
  totalMatches: number;
  sessionId: string | null;
  reset: () => void;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [extractedFilters, setExtractedFilters] =
    useState<ExtractedFilters | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const chatMutation = useMutation({
    mutationFn: async (query: string): Promise<ChatResponseData> => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          session_id: sessionId,
          conversation_history: messages.slice(-10), // Keep last 10 messages
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 'Doslo je do greske. Pokusajte ponovo.'
        );
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Doslo je do greske.');
      }

      return data.data;
    },
    onMutate: (query) => {
      // Optimistic update - add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: query,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);
    },
    onSuccess: (data) => {
      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update state with response data
      if (data.session_id) {
        setSessionId(data.session_id);
      }
      if (data.listings) {
        setListings(data.listings);
      }
      if (data.extracted_filters) {
        setExtractedFilters(data.extracted_filters);
      }
      if (data.follow_up_questions) {
        setSuggestedQuestions(data.follow_up_questions);
      }
      if (data.total_matches !== undefined) {
        setTotalMatches(data.total_matches);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      // Remove the optimistically added user message on error
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const sendMessage = useCallback(
    (query: string) => {
      if (!query.trim() || chatMutation.isPending) return;
      chatMutation.mutate(query.trim());
    },
    [chatMutation]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setListings([]);
    setExtractedFilters(null);
    setSuggestedQuestions([]);
    setTotalMatches(0);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading: chatMutation.isPending,
    error,
    listings,
    extractedFilters,
    suggestedQuestions,
    totalMatches,
    sessionId,
    reset,
    clearError,
  };
}
