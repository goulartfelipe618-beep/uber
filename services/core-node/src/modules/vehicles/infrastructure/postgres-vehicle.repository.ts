import { Pool } from "pg";
import { CreateVehicleInput, UpdateVehicleInput, Vehicle, VehicleStatus } from "../domain/vehicle";
import { VehicleRepository } from "../domain/vehicle.repository";

export class PostgresVehicleRepository implements VehicleRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async list(): Promise<Vehicle[]> {
    const result = await this.pool.query(
      `
      select
        id,
        driver_id,
        plate,
        brand,
        model,
        color,
        year,
        status,
        created_at,
        updated_at,
        deleted_at
      from vehicles
      where deleted_at is null
      order by created_at asc
      `,
    );

    return result.rows.map(mapRow);
  }

  public async create(input: CreateVehicleInput): Promise<Vehicle> {
    const result = await this.pool.query(
      `
      insert into vehicles (
        driver_id,
        plate,
        brand,
        model,
        color,
        year,
        status
      ) values ($1,$2,$3,$4,$5,$6,$7)
      returning
        id,
        driver_id,
        plate,
        brand,
        model,
        color,
        year,
        status,
        created_at,
        updated_at,
        deleted_at
      `,
      [
        input.driverId,
        input.plate,
        input.brand,
        input.model,
        input.color ?? null,
        input.year ?? null,
        input.status ?? "ACTIVE",
      ],
    );

    return mapRow(result.rows[0]);
  }

  public async update(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const colorParam = input.color === undefined ? "__KEEP__" : input.color;
    const yearParam = input.year === undefined ? -1 : input.year;
    const statusParam = input.status === undefined ? "__KEEP__" : input.status;

    const result = await this.pool.query(
      `
      update vehicles
      set
        driver_id = coalesce($2, driver_id),
        plate = coalesce($3, plate),
        brand = coalesce($4, brand),
        model = coalesce($5, model),
        color = case when $6::text = '__KEEP__' then color else $6::text end,
        year = case when $7::int = -1 then year else $7::int end,
        status = case when $8::text = '__KEEP__' then status else $8::vehicle_status end,
        updated_at = now()
      where id = $1
        and deleted_at is null
      returning
        id,
        driver_id,
        plate,
        brand,
        model,
        color,
        year,
        status,
        created_at,
        updated_at,
        deleted_at
      `,
      [
        id,
        input.driverId ?? null,
        input.plate ?? null,
        input.brand ?? null,
        input.model ?? null,
        colorParam,
        yearParam,
        statusParam,
      ],
    );

    if (result.rows.length === 0) {
      throw new Error("vehicle not found");
    }

    return mapRow(result.rows[0]);
  }

  public async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `
      update vehicles
      set deleted_at = now(), updated_at = now()
      where id = $1 and deleted_at is null
      `,
      [id],
    );
  }
}

function mapRow(row: any): Vehicle {
  return {
    id: String(row.id),
    driverId: String(row.driver_id),
    plate: String(row.plate),
    brand: String(row.brand),
    model: String(row.model),
    color: row.color === null ? null : String(row.color),
    year: row.year === null ? null : Number(row.year),
    status: String(row.status) as VehicleStatus,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}
