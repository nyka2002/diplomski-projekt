export type ListingType = 'rent' | 'sale';
export type PropertyType = 'apartment' | 'house' | 'office' | 'land' | 'other';

export interface Listing {
  id: string;
  source: string;
  external_id: string;
  title: string;
  description: string;
  price: number;
  price_currency: string;
  listing_type: ListingType;
  property_type: PropertyType;
  location_city: string;
  location_address: string;
  location_coordinates?: {
    lat: number;
    lng: number;
  };
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  surface_area?: number;
  has_parking: boolean;
  has_balcony: boolean;
  has_garage: boolean;
  is_furnished: boolean;
  amenities: Record<string, any>;
  images: string[];
  url: string;
  scraped_at: Date;
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
}

export interface NormalizedListing {
  source: string;
  external_id: string;
  title: string;
  description: string;
  price: number;
  price_currency: string;
  listing_type: ListingType;
  property_type: PropertyType;
  location_city: string;
  location_address: string;
  location_coordinates?: {
    lat: number;
    lng: number;
  };
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  surface_area?: number;
  has_parking: boolean;
  has_balcony: boolean;
  has_garage: boolean;
  is_furnished: boolean;
  amenities: Record<string, any>;
  images: string[];
  url: string;
}
