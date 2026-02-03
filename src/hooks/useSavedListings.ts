'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Listing } from '@/types/listing';

interface SavedListingItem {
  listing: Listing;
  saved_at: string;
}

interface SavedListingsResponse {
  success: boolean;
  data: {
    listings: SavedListingItem[];
    total: number;
  };
}

export function useSavedListings() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['saved-listings'],
    queryFn: async (): Promise<SavedListingsResponse> => {
      const response = await fetch('/api/listings/saved');
      if (!response.ok) {
        throw new Error('Failed to fetch saved listings');
      }
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/listings/${listingId}/save`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to save listing');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-listings'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/listings/${listingId}/save`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove listing');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-listings'] });
    },
  });

  return {
    savedListings: data?.data?.listings || [],
    total: data?.data?.total || 0,
    isLoading,
    error,
    saveListing: saveMutation.mutate,
    removeListing: removeMutation.mutate,
    isSaving: saveMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
