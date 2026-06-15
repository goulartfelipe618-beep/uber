import { Pool } from "pg";
import { Category, CreateCategoryInput, UpdateCategoryInput } from "../domain/category";
import { CategoryRepository } from "../domain/category.repository";

export class PostgresCategoryRepository implements CategoryRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async list(): Promise<Category[]> {
    const result = await this.pool.query(
      `
      select
        id,
        code,
        name,
        description,
        base_fare,
        price_per_km,
        price_per_minute,
        minimum_fare,
        active,
        created_at,
        updated_at,
        deleted_at
      from ride_categories
      where deleted_at is null
      order by created_at asc
      `,
    );

    return result.rows.map(mapRow);
  }

  public async findByCode(code: string): Promise<Category | null> {
    const normalized = (code ?? "").trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    const result = await this.pool.query(
      `
      select
        id,
        code,
        name,
        description,
        base_fare,
        price_per_km,
        price_per_minute,
        minimum_fare,
        active,
        created_at,
        updated_at,
        deleted_at
      from ride_categories
      where deleted_at is null
        and upper(code) = $1
      limit 1
      `,
      [normalized],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRow(result.rows[0]);
  }

  public async create(input: CreateCategoryInput): Promise<Category> {
    const result = await this.pool.query(
      `
      insert into ride_categories (
        code,
        name,
        description,
        base_fare,
        price_per_km,
        price_per_minute,
        minimum_fare,
        active
      ) values ($1,$2,$3,$4,$5,$6,$7,$8)
      returning
        id,
        code,
        name,
        description,
        base_fare,
        price_per_km,
        price_per_minute,
        minimum_fare,
        active,
        created_at,
        updated_at,
        deleted_at
      `,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.baseFare,
        input.pricePerKm,
        input.pricePerMinute,
        input.minimumFare,
        input.active ?? true,
      ],
    );

    return mapRow(result.rows[0]);
  }

  public async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const descriptionParam = input.description === undefined ? "__KEEP__" : input.description;

    const result = await this.pool.query(
      `
      update ride_categories
      set
        code = coalesce($2, code),
        name = coalesce($3, name),
        description = case when $4::text = '__KEEP__' then description else $4::text end,
        base_fare = coalesce($5, base_fare),
        price_per_km = coalesce($6, price_per_km),
        price_per_minute = coalesce($7, price_per_minute),
        minimum_fare = coalesce($8, minimum_fare),
        active = coalesce($9, active),
        updated_at = now()
      where id = $1
        and deleted_at is null
      returning
        id,
        code,
        name,
        description,
        base_fare,
        price_per_km,
        price_per_minute,
        minimum_fare,
        active,
        created_at,
        updated_at,
        deleted_at
      `,
      [
        id,
        input.code ?? null,
        input.name ?? null,
        descriptionParam,
        input.baseFare ?? null,
        input.pricePerKm ?? null,
        input.pricePerMinute ?? null,
        input.minimumFare ?? null,
        input.active ?? null,
      ],
    );

    if (result.rows.length === 0) {
      throw new Error("category not found");
    }

    return mapRow(result.rows[0]);
  }

  public async softDelete(id: string): Promise<void> {
    await this.pool.query(
      `
      update ride_categories
      set deleted_at = now(), updated_at = now()
      where id = $1 and deleted_at is null
      `,
      [id],
    );
  }
}

function mapRow(row: any): Category {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    baseFare: Number(row.base_fare),
    pricePerKm: Number(row.price_per_km),
    pricePerMinute: Number(row.price_per_minute),
    minimumFare: Number(row.minimum_fare),
    active: Boolean(row.active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  };
}
