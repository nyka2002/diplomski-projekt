'use client';

import { useQuery } from '@tanstack/react-query';
import type { Listing } from '@/types/listing';

interface ListingFilters {
  listing_type?: 'rent' | 'sale';
  property_type?: string;
  city?: string;
  price_min?: number;
  price_max?: number;
  rooms_min?: number;
  rooms_max?: number;
  has_parking?: boolean;
  has_balcony?: boolean;
  is_furnished?: boolean;
  page?: number;
  limit?: number;
}

interface ListingsResponse {
  success: boolean;
  data: Listing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ListingDetailResponse {
  success: boolean;
  data: {
    listing: Listing;
    is_saved: boolean;
    similar_listings: Array<Listing & { similarity: number }>;
  };
}

export function useListings(filters?: ListingFilters) {
  return useQuery({
    queryKey: ['listings', filters],
    queryFn: async (): Promise<ListingsResponse> => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const response = await fetch(`/api/listings?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }

      return response.json();
    },
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async (): Promise<ListingDetailResponse> => {
      const response = await fetch(`/api/listings/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Listing not found');
        }
        throw new Error('Failed to fetch listing');
      }

      return response.json();
    },
    enabled: !!id,
  });
}
