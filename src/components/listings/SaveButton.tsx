'use client';

import { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers';

interface SaveButtonProps {
  listingId: string;
  isSaved?: boolean;
  onSaveChange?: (saved: boolean) => void;
  variant?: 'default' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SaveButton({
  listingId,
  isSaved = false,
  onSaveChange,
  variant = 'icon',
  size = 'md',
  className,
}: SaveButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(isSaved);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Potrebna prijava', {
        description: 'Prijavite se za spremanje oglasa.',
        action: {
          label: 'Prijava',
          onClick: () => {
            window.location.href = '/login';
          },
        },
      });
      return;
    }

    setIsLoading(true);
    try {
      const method = saved ? 'DELETE' : 'POST';
      const response = await fetch(`/api/listings/${listingId}/save`, {
        method,
      });

      if (!response.ok) {
        throw new Error('Failed to save listing');
      }

      const newSavedState = !saved;
      setSaved(newSavedState);
      onSaveChange?.(newSavedState);

      toast.success(newSavedState ? 'Oglas spremljen' : 'Oglas uklonjen', {
        description: newSavedState
          ? 'Oglas je dodan u spremljene.'
          : 'Oglas je uklonjen iz spremljenih.',
      });
    } catch {
      toast.error('Greska', {
        description: 'Nije moguce spremiti oglas. Pokusajte ponovo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          sizeClasses[size],
          'rounded-full bg-background/80 hover:bg-background',
          className
        )}
        onClick={handleToggleSave}
        disabled={isLoading}
        aria-label={saved ? 'Ukloni iz spremljenih' : 'Spremi oglas'}
      >
        {isLoading ? (
          <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
        ) : (
          <Heart
            className={cn(
              iconSizes[size],
              saved && 'fill-red-500 text-red-500'
            )}
          />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={saved ? 'default' : 'outline'}
      size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'}
      className={className}
      onClick={handleToggleSave}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn('mr-2 h-4 w-4', saved && 'fill-current')}
        />
      )}
      {saved ? 'Spremljeno' : 'Spremi'}
    </Button>
  );
}
