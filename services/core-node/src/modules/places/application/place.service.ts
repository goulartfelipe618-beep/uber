import { CreateSavedPlaceInput, PlaceRepository, SavedPlace, SavedPlaceType } from "../domain/place";

export class PlaceService {
  constructor(private readonly repository: PlaceRepository) {}

  public listByUser(userId: string): Promise<SavedPlace[]> {
    if (!userId) {
      throw new Error("userId is required");
    }
    return this.repository.listByUser(userId);
  }

  public create(input: CreateSavedPlaceInput): Promise<SavedPlace> {
    return this.repository.create({
      userId: requireText(input.userId, "userId"),
      placeType: normalizePlaceType(input.placeType),
      label: requireText(input.label, "label"),
      mapboxFeatureId: input.mapboxFeatureId ?? null,
      addressText: requireText(input.addressText, "addressText"),
      latitude: requireCoordinate(input.latitude, "latitude"),
      longitude: requireCoordinate(input.longitude, "longitude"),
    });
  }

  public delete(id: string, userId: string): Promise<void> {
    if (!id) {
      throw new Error("id is required");
    }
    return this.repository.softDelete(id, userId);
  }
}

function normalizePlaceType(value: SavedPlaceType): SavedPlaceType {
  if (value !== "HOME" && value !== "WORK" && value !== "FAVORITE") {
    throw new Error("placeType must be HOME, WORK or FAVORITE");
  }
  return value;
}

function requireText(value: string, field: string): string {
  const text = (value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function requireCoordinate(value: number, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field} must be a number`);
  }
  return num;
}
