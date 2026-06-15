export type GeocodingSource = "local" | "mapbox";

export interface GeocodingSuggestion {
  mapboxFeatureId: string | null;
  placeName: string;
  addressText: string;
  latitude: number;
  longitude: number;
  score: number;
  source: GeocodingSource;
}

export interface GeocodingSearchInput {
  query: string;
  latitude?: number;
  longitude?: number;
  userId?: string;
  limit?: number;
}

export interface GeocodingRepository {
  searchLocal(input: GeocodingSearchInput): Promise<GeocodingSuggestion[]>;
  upsertPlaceCache(item: GeocodingSuggestion): Promise<void>;
  recordHistory(userId: string | undefined, item: GeocodingSuggestion): Promise<void>;
}
