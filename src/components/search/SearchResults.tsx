'use client';

import { cn } from '@/lib/utils';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { EmptyResults } from './EmptyResults';
import type { Listing } from '@/types/listing';

interface SearchResultsProps {
  listings: Listing[];
  savedListingIds?: string[];
  onSaveChange?: (listingId: string, saved: boolean) => void;
  isLoading?: boolean;
  onReset?: () => void;
  showSaveButton?: boolean;
  className?: string;
}

export function SearchResults({
  listings,
  savedListingIds = [],
  onSaveChange,
  isLoading = false,
  onReset,
  showSaveButton = true,
  className,
}: SearchResultsProps) {
  if (!isLoading && listings.length === 0) {
    return <EmptyResults onReset={onReset} className={className} />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <ListingGrid
        listings={listings}
        savedListingIds={savedListingIds}
        onSaveChange={onSaveChange}
        showSaveButton={showSaveButton}
        isLoading={isLoading}
      />
    </div>
  );
}
