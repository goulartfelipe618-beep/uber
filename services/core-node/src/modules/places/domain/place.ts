export type SavedPlaceType = "HOME" | "WORK" | "FAVORITE";

export interface SavedPlace {
  id: string;
  userId: string;
  placeType: SavedPlaceType;
  label: string;
  mapboxFeatureId: string | null;
  addressText: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedPlaceInput {
  userId: string;
  placeType: SavedPlaceType;
  label: string;
  mapboxFeatureId?: string | null;
  addressText: string;
  latitude: number;
  longitude: number;
}

export interface PlaceRepository {
  listByUser(userId: string): Promise<SavedPlace[]>;
  create(input: CreateSavedPlaceInput): Promise<SavedPlace>;
  softDelete(id: string, userId: string): Promise<void>;
}
