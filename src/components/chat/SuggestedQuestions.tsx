'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  className?: string;
  title?: string;
}

export function SuggestedQuestions({
  questions,
  onSelect,
  className,
  title,
}: SuggestedQuestionsProps) {
  if (!questions.length) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {title && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" />
          {title}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(question)}
            className="h-auto py-1.5 px-3 text-xs font-normal text-left whitespace-normal"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
