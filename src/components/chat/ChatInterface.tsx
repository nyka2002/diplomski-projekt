'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { SuggestedQuestions } from './SuggestedQuestions';
import { ExtractedFilters } from './ExtractedFilters';
import { ChatWelcome } from './ChatWelcome';
import type { Listing } from '@/types/listing';

interface ChatInterfaceProps {
  onListingsChange?: (listings: Listing[]) => void;
  className?: string;
  showFilters?: boolean;
}

export function ChatInterface({
  onListingsChange,
  className,
  showFilters = true,
}: ChatInterfaceProps) {
  const {
    messages,
    sendMessage,
    isLoading,
    error,
    listings,
    extractedFilters,
    suggestedQuestions,
    totalMatches,
    reset,
    clearError,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Notify parent about listings changes
  useEffect(() => {
    onListingsChange?.(listings);
  }, [listings, onListingsChange]);

  const hasMessages = messages.length > 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {!hasMessages ? (
          <ChatWelcome
            onExampleSelect={sendMessage}
            className="py-8"
          />
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Bottom section */}
      <div className="border-t p-4 space-y-3">
        {/* Error message */}
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-2"
              >
                Odbaci
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Extracted filters */}
        {showFilters && extractedFilters && hasMessages && (
          <ExtractedFilters filters={extractedFilters} />
        )}

        {/* Results count */}
        {hasMessages && totalMatches > 0 && (
          <p className="text-sm text-muted-foreground">
            Pronadeno <span className="font-medium">{totalMatches}</span> oglasa
          </p>
        )}

        {/* Suggested questions */}
        {suggestedQuestions.length > 0 && !isLoading && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={sendMessage}
            title="Mozete pitati:"
          />
        )}

        {/* Input */}
        <div className="flex items-center gap-2">
          {hasMessages && (
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              className="flex-shrink-0"
              title="Nova pretraga"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <ChatInput
            onSend={sendMessage}
            isLoading={isLoading}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
