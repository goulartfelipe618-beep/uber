import { Pool } from "pg";
import { CreateMatchBlockInput, MatchBlock } from "../domain/match-block";
import { MatchBlockRepository } from "../domain/match-block.repository";

export class PostgresMatchBlockRepository implements MatchBlockRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async create(input: CreateMatchBlockInput): Promise<MatchBlock> {
    const result = await this.pool.query(
      `
      insert into ride_match_blocks (
        passenger_id,
        driver_id,
        ride_id,
        block_type,
        reason_code,
        expires_at
      ) values ($1,$2,$3,$4,$5,$6)
      returning
        id,
        passenger_id,
        driver_id,
        ride_id,
        block_type,
        reason_code,
        created_at,
        expires_at
      `,
      [
        input.passengerId,
        input.driverId,
        input.rideId ?? null,
        input.blockType,
        input.reasonCode ?? null,
        input.expiresAt,
      ],
    );

    return mapRow(result.rows[0]);
  }

  public async hasActiveBlock(passengerId: string, driverId: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      select 1
      from ride_match_blocks
      where passenger_id = $1
        and driver_id = $2
        and expires_at > now()
      limit 1
      `,
      [passengerId, driverId],
    );

    return result.rows.length > 0;
  }
}

function mapRow(row: any): MatchBlock {
  return {
    id: String(row.id),
    passengerId: String(row.passenger_id),
    driverId: String(row.driver_id),
    rideId: row.ride_id ? String(row.ride_id) : null,
    blockType: String(row.block_type) as any,
    reasonCode: row.reason_code === null ? null : String(row.reason_code),
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

