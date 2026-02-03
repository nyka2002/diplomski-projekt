export interface SearchQuery {
  query_text: string;
  extracted_filters?: ExtractedFilters;
}

export interface ExtractedFilters {
  listing_type?: 'rent' | 'sale';
  property_type?: string;
  price_min?: number;
  price_max?: number;
  location?: string;
  rooms_min?: number;
  rooms_max?: number;
  surface_area_min?: number;
  surface_area_max?: number;
  has_parking?: boolean;
  has_balcony?: boolean;
  has_garage?: boolean;
  is_furnished?: boolean;
  amenities?: string[];
}

export interface UserSearch {
  id: string;
  user_id: string;
  query_text: string;
  extracted_filters: ExtractedFilters;
  query_embedding?: number[];
  created_at: Date;
}

export interface RankedListing {
  listing_id: string;
  relevance_score: number;
  filter_match_score: number;
  semantic_similarity_score: number;
  combined_score: number;
}
