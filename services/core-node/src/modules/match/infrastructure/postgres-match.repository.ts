import { Pool } from "pg";
import { GeoGoMatchResult } from "../../../integrations/geo-go/geo-go.client";
import { MatchRepository } from "../application/match-dispatch.service";

export class PostgresMatchRepository implements MatchRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async persistMatchResult(rideId: string, result: GeoGoMatchResult, strategy = "SEQUENTIAL"): Promise<string> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const attempt = await client.query<{ id: string }>(
        `
        insert into ride_match_attempts (
          ride_id, stage_number, search_radius_m, candidate_count, strategy, result_status, ended_at
        ) values ($1, $2, $3, $4, $5, 'MATCHED', now())
        returning id
        `,
        [rideId, result.stage_number, result.search_radius_meters, result.ranked_candidates.length, strategy],
      );

      const attemptId = attempt.rows[0].id;

      for (let i = 0; i < result.ranked_candidates.length; i++) {
        const c = result.ranked_candidates[i];
        await client.query(
          `
          insert into ride_match_candidates (
            attempt_id, driver_id, score, eta_pickup_s, distance_m, reputation_score,
            acceptance_score, cancellation_score, online_score, experience_score,
            compatibility_score, rank_position
          ) values ($1,$2,$3,$4,$5,$6,$6,$6,$6,$6,$7,$8)
          on conflict (attempt_id, driver_id) do nothing
          `,
          [attemptId, c.driver_id, c.final_score, c.eta_seconds, c.distance_meters, c.final_score, c.compatibility_score, i + 1],
        );
      }

      if (result.matched_driver_id) {
        const expiresAt = new Date(Date.now() + 6_000);
        await client.query(
          `
          insert into ride_offers (ride_id, attempt_id, driver_id, offer_type, expires_at, status)
          values ($1, $2, $3, 'DIRECT', $4, 'PENDING')
          `,
          [rideId, attemptId, result.matched_driver_id, expiresAt],
        );
      }

      await client.query("COMMIT");
      return attemptId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
