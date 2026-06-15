import { Pool } from "pg";
import { CreateSavedPlaceInput, PlaceRepository, SavedPlace } from "../domain/place";

export class PostgresPlaceRepository implements PlaceRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async listByUser(userId: string): Promise<SavedPlace[]> {
    const result = await this.pool.query(
      `
      select
        id, user_id, place_type, label, mapbox_feature_id, address_text,
        st_y(point::geometry) as latitude,
        st_x(point::geometry) as longitude,
        created_at, updated_at
      from user_saved_places
      where user_id = $1 and deleted_at is null
      order by place_type, created_at desc
      `,
      [userId],
    );
    return result.rows.map(mapRow);
  }

  public async create(input: CreateSavedPlaceInput): Promise<SavedPlace> {
    const result = await this.pool.query(
      `
      insert into user_saved_places (
        user_id, place_type, label, mapbox_feature_id, address_text, point
      ) values (
        $1, $2, $3, $4, $5,
        st_setsrid(st_makepoint($6, $7), 4326)
      )
      returning
        id, user_id, place_type, label, mapbox_feature_id, address_text,
        st_y(point::geometry) as latitude,
        st_x(point::geometry) as longitude,
        created_at, updated_at
      `,
      [
        input.userId,
        input.placeType,
        input.label,
        input.mapboxFeatureId ?? null,
        input.addressText,
        input.longitude,
        input.latitude,
      ],
    );
    return mapRow(result.rows[0]);
  }

  public async softDelete(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `update user_saved_places set deleted_at = now(), updated_at = now() where id = $1 and user_id = $2 and deleted_at is null`,
      [id, userId],
    );
  }
}

function mapRow(row: any): SavedPlace {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    placeType: row.place_type,
    label: String(row.label),
    mapboxFeatureId: row.mapbox_feature_id ? String(row.mapbox_feature_id) : null,
    addressText: String(row.address_text),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
