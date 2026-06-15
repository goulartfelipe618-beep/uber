import { Pool } from "pg";
import { GeocodingRepository, GeocodingSearchInput, GeocodingSuggestion } from "../domain/geocoding";

type SavedPlaceRow = {
  mapbox_feature_id: string | null;
  label: string;
  address_text: string;
  lat: number;
  lng: number;
};

type PlaceCacheRow = {
  mapbox_feature_id: string | null;
  place_name: string;
  address_text: string | null;
  lat: number;
  lng: number;
};

export class PostgresGeocodingRepository implements GeocodingRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async searchLocal(input: GeocodingSearchInput): Promise<GeocodingSuggestion[]> {
    const q = `%${input.query.trim()}%`;
    const limit = Math.min(input.limit ?? 8, 20);
    const results: GeocodingSuggestion[] = [];

    if (input.userId) {
      const saved = await this.pool.query<SavedPlaceRow>(
        `
        select label, mapbox_feature_id, address_text,
               st_y(point::geometry) as lat, st_x(point::geometry) as lng
        from user_saved_places
        where user_id = $1 and deleted_at is null
          and (label ilike $2 or address_text ilike $2)
        limit $3
        `,
        [input.userId, q, limit],
      );

      for (const row of saved.rows) {
        results.push({
          mapboxFeatureId: row.mapbox_feature_id,
          placeName: row.label,
          addressText: row.address_text,
          latitude: Number(row.lat),
          longitude: Number(row.lng),
          score: 0.85,
          source: "local",
        });
      }
    }

    const cache = await this.pool.query<PlaceCacheRow>(
      `
      select mapbox_feature_id, place_name, address_text,
             st_y(point::geometry) as lat, st_x(point::geometry) as lng
      from place_cache
      where place_name ilike $1 or address_text ilike $1
      limit $2
      `,
      [q, limit],
    );

    for (const row of cache.rows) {
      results.push({
        mapboxFeatureId: row.mapbox_feature_id,
        placeName: row.place_name,
        addressText: row.address_text ?? row.place_name,
        latitude: Number(row.lat),
        longitude: Number(row.lng),
        score: 0.65,
        source: "local",
      });
    }

    return results.slice(0, limit);
  }

  public async upsertPlaceCache(item: GeocodingSuggestion): Promise<void> {
    if (!item.mapboxFeatureId) {
      return;
    }

    await this.pool.query(
      `
      insert into place_cache (mapbox_feature_id, place_name, address_text, point)
      values ($1, $2, $3, st_setsrid(st_makepoint($4, $5), 4326))
      on conflict (mapbox_feature_id) do update set
        place_name = excluded.place_name,
        address_text = excluded.address_text,
        point = excluded.point,
        updated_at = now()
      `,
      [item.mapboxFeatureId, item.placeName, item.addressText, item.longitude, item.latitude],
    );
  }

  public async recordHistory(userId: string | undefined, item: GeocodingSuggestion): Promise<void> {
    if (!userId) {
      return;
    }

    await this.pool.query(
      `
      insert into user_place_history (user_id, mapbox_feature_id, address_text, point, usage_count)
      values ($1, $2, $3, st_setsrid(st_makepoint($4, $5), 4326), 1)
      on conflict do nothing
      `,
      [userId, item.mapboxFeatureId, item.addressText, item.longitude, item.latitude],
    );
  }
}
