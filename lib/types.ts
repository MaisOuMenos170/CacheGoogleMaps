export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  business_status?: string;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
    url?: string;
  }>;
  editorial_summary?: {
    overview?: string;
  };
  added_at?: string;
  [key: string]: unknown;
}

export interface CatalogItem extends PlaceDetails {
  added_at: string;
}

export interface GitHubCatalogResponse {
  sha: string | null;
  items: CatalogItem[];
  path: string;
  branch: string;
}
