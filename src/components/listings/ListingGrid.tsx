'use client';

import { cn } from '@/lib/utils';
import { ListingCard } from './ListingCard';
import { ListingCardSkeleton } from './ListingCardSkeleton';
import type { Listing } from '@/types/listing';

interface ListingGridProps {
  listings: Listing[];
  savedListingIds?: string[];
  onSaveChange?: (listingId: string, saved: boolean) => void;
  showSaveButton?: boolean;
  isLoading?: boolean;
  skeletonCount?: number;
  variant?: 'default' | 'compact';
  className?: string;
}

export function ListingGrid({
  listings,
  savedListingIds = [],
  onSaveChange,
  showSaveButton = true,
  isLoading = false,
  skeletonCount = 8,
  variant = 'default',
  className,
}: ListingGridProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'grid gap-4 md:gap-6',
          variant === 'compact'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ListingCardSkeleton key={index} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4 md:gap-6',
        variant === 'compact'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          isSaved={savedListingIds.includes(listing.id)}
          onSaveChange={(saved) => onSaveChange?.(listing.id, saved)}
          showSaveButton={showSaveButton}
          variant={variant}
        />
      ))}
    </div>
  );
}
