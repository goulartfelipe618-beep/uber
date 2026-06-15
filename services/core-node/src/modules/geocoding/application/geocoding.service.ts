import { GeocodingRepository, GeocodingSearchInput, GeocodingSuggestion } from "../domain/geocoding";

type MapboxFeature = {
  id?: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    place_formatted?: string;
    full_address?: string;
  };
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

export class GeocodingService {
  constructor(
    private readonly repository: GeocodingRepository,
    private readonly mapboxToken: string,
  ) {}

  public async autocomplete(input: GeocodingSearchInput): Promise<GeocodingSuggestion[]> {
    const query = (input.query ?? "").trim();
    if (query.length < 2) {
      throw new Error("query must be at least 2 characters");
    }

    const local = await this.repository.searchLocal(input);
    let remote: GeocodingSuggestion[] = [];
    if (this.mapboxToken) {
      remote = await this.searchMapbox(input);
    }

    const merged = rankSuggestions(query, local, remote, input.latitude, input.longitude);
    const limit = Math.min(input.limit ?? 8, 20);
    return merged.slice(0, limit);
  }

  public async confirmSelection(userId: string | undefined, item: GeocodingSuggestion): Promise<GeocodingSuggestion> {
    await this.repository.upsertPlaceCache(item);
    await this.repository.recordHistory(userId, item);
    return item;
  }

  private async searchMapbox(input: GeocodingSearchInput): Promise<GeocodingSuggestion[]> {
    const params = new URLSearchParams({
      q: input.query,
      access_token: this.mapboxToken,
      language: "pt",
      country: "BR",
      limit: String(Math.min(input.limit ?? 8, 10)),
    });

    if (input.longitude !== undefined && input.latitude !== undefined) {
      params.set("proximity", `${input.longitude},${input.latitude}`);
    }

    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`);
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as MapboxResponse;
    const features = data.features ?? [];

    return features.map((feature) => {
      const coords = feature.geometry?.coordinates ?? [0, 0];
      return {
        mapboxFeatureId: String(feature.id ?? feature.properties?.mapbox_id ?? ""),
        placeName: String(feature.properties?.name ?? feature.properties?.place_formatted ?? input.query),
        addressText: String(feature.properties?.full_address ?? feature.properties?.place_formatted ?? input.query),
        longitude: Number(coords[0]),
        latitude: Number(coords[1]),
        score: 0.75,
        source: "mapbox" as const,
      };
    });
  }
}

function rankSuggestions(
  query: string,
  local: GeocodingSuggestion[],
  remote: GeocodingSuggestion[],
  lat?: number,
  lng?: number,
): GeocodingSuggestion[] {
  const all = [...local, ...remote];
  const q = query.toLowerCase();

  return all
    .map((item) => {
      let score = item.score;
      const text = `${item.placeName} ${item.addressText}`.toLowerCase();
      if (text.startsWith(q)) {
        score += 0.2;
      } else if (text.includes(q)) {
        score += 0.1;
      }

      if (lat !== undefined && lng !== undefined) {
        const dist = haversineKm(lat, lng, item.latitude, item.longitude);
        score += Math.max(0, 0.2 - dist / 50);
      }

      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item, index, arr) => {
      const key = `${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}:${item.placeName}`;
      return arr.findIndex((x) => `${x.latitude.toFixed(5)}:${x.longitude.toFixed(5)}:${x.placeName}` === key) === index;
    });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(a));
}
