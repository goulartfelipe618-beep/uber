import { Pool } from "pg";
import { RideStartRepository } from "../application/ride-start.service";

export class PostgresRideStartRepository implements RideStartRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async deactivateActiveCodes(rideId: string): Promise<void> {
    await this.pool.query(
      `update ride_start_code_pairs set is_active = false, updated_at = now() where ride_id = $1 and is_active = true`,
      [rideId],
    );
  }

  public async createCodePair(input: {
    rideId: string;
    passengerCodeHash: string;
    driverCodeHash: string;
    expiresAt: Date;
    reissueCount: number;
  }): Promise<string> {
    const result = await this.pool.query(
      `
      insert into ride_start_code_pairs (
        ride_id, passenger_code_hash, driver_code_hash, expires_at, reissue_count
      ) values ($1,$2,$3,$4,$5)
      returning id
      `,
      [input.rideId, input.passengerCodeHash, input.driverCodeHash, input.expiresAt, input.reissueCount],
    );
    return String(result.rows[0].id);
  }

  public async getActivePair(rideId: string) {
    const result = await this.pool.query(
      `
      select id, passenger_code_hash, driver_code_hash, expires_at,
             passenger_validated_at, driver_validated_at,
             passenger_attempts, driver_attempts, reissue_count
      from ride_start_code_pairs
      where ride_id = $1 and is_active = true
      order by created_at desc
      limit 1
      `,
      [rideId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: String(row.id),
      passengerCodeHash: String(row.passenger_code_hash),
      driverCodeHash: String(row.driver_code_hash),
      expiresAt: new Date(row.expires_at),
      passengerValidatedAt: row.passenger_validated_at ? new Date(row.passenger_validated_at) : null,
      driverValidatedAt: row.driver_validated_at ? new Date(row.driver_validated_at) : null,
      passengerAttempts: Number(row.passenger_attempts),
      driverAttempts: Number(row.driver_attempts),
      reissueCount: Number(row.reissue_count),
    };
  }

  public async recordAttempt(
    rideId: string,
    codePairId: string | null,
    role: "PASSENGER" | "DRIVER",
    success: boolean,
  ): Promise<void> {
    await this.pool.query(
      `
      insert into ride_start_code_attempts (ride_id, code_pair_id, role, success)
      values ($1, $2, $3, $4)
      `,
      [rideId, codePairId, role, success],
    );
  }

  public async incrementAttempts(codePairId: string, role: "PASSENGER" | "DRIVER"): Promise<number> {
    const column = role === "PASSENGER" ? "passenger_attempts" : "driver_attempts";
    const result = await this.pool.query(
      `
      update ride_start_code_pairs
      set ${column} = ${column} + 1, updated_at = now()
      where id = $1
      returning ${column}
      `,
      [codePairId],
    );
    return Number(result.rows[0][column]);
  }

  public async markValidated(codePairId: string, role: "PASSENGER" | "DRIVER"): Promise<void> {
    const column = role === "PASSENGER" ? "passenger_validated_at" : "driver_validated_at";
    await this.pool.query(
      `update ride_start_code_pairs set ${column} = now(), updated_at = now() where id = $1`,
      [codePairId],
    );
  }

  public async markRideInProgress(rideId: string): Promise<void> {
    await this.pool.query(
      `
      update viagens
      set status = 'EM_ANDAMENTO', iniciada_em = now(), updated_at = now(), ride_version = ride_version + 1
      where id = $1
      `,
      [rideId],
    );
  }

  public async countReissues(rideId: string): Promise<number> {
    const result = await this.pool.query(
      `select count(*)::int as total from ride_start_code_pairs where ride_id = $1`,
      [rideId],
    );
    return Number(result.rows[0].total);
  }
}
