'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserSearch } from '@/types/search';

interface SearchHistoryResponse {
  success: boolean;
  data: {
    searches: UserSearch[];
    total: number;
    stats?: {
      total_searches: number;
      most_common_city: string | null;
      avg_price_max: number | null;
      most_searched_listing_type: 'rent' | 'sale' | null;
    };
  };
}

export function useSearchHistory(includeStats = false) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['search-history', includeStats],
    queryFn: async (): Promise<SearchHistoryResponse> => {
      const params = new URLSearchParams();
      if (includeStats) {
        params.set('include_stats', 'true');
      }
      const response = await fetch(`/api/searches?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch search history');
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const response = await fetch(`/api/searches/${searchId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete search');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] });
    },
  });

  return {
    searches: data?.data?.searches || [],
    total: data?.data?.total || 0,
    stats: data?.data?.stats,
    isLoading,
    error,
    deleteSearch: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
