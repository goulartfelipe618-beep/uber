import { Pool } from "pg";
import { ReputationRepository } from "../domain/reputation.repository";
import { ReputationResult, ReputationRole, ReputationTier } from "../domain/reputation";

type ReviewRow = {
  stars: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  distanceRealMeters: number | null;
  finalValueCents: number | null;
};

export class PostgresReputationRepository implements ReputationRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async compute(userId: string, role: ReputationRole): Promise<ReputationResult> {
    const now = new Date();
    const rows = await this.loadReviews(userId, role);
    const globalAverage = await this.loadGlobalAverage(role);
    const p90ValueCents = await this.loadP90RideValue(rows);

    const lambda = role === "DRIVER" ? 0.0025 : 0.0035;
    const smoothingM = role === "DRIVER" ? 50 : 20;

    let weightedSum = 0;
    let weightTotal = 0;

    for (const row of rows) {
      const daysSince = Math.max(0, differenceInDays(now, row.createdAt));
      let wT = Math.exp(-lambda * daysSince);
      if (daysSince <= 30) {
        wT *= 1.05;
      }
      if (daysSince > 365) {
        wT *= 0.15;
      }

      const wC = 1.0;
      let wTrip = 1.0;
      const durationSeconds = row.startedAt && row.finishedAt ? Math.max(0, Math.floor((row.finishedAt.getTime() - row.startedAt.getTime()) / 1000)) : null;
      if ((row.distanceRealMeters !== null && row.distanceRealMeters < 1200) || (durationSeconds !== null && durationSeconds < 240)) {
        wTrip *= 0.85;
      }
      if (p90ValueCents !== null && row.finalValueCents !== null && row.finalValueCents >= p90ValueCents) {
        wTrip *= 1.10;
      }

      const weight = wT * wC * wTrip;
      if (weight <= 0) {
        continue;
      }

      weightedSum += row.stars * weight;
      weightTotal += weight;
    }

    const reviewCount = rows.length;
    const weightedReviewCount = weightTotal;

    const weightedRating = weightTotal > 0 ? weightedSum / weightTotal : globalAverage;
    const smoothedRating = bayesianSmooth(weightedRating, weightedReviewCount, smoothingM, globalAverage);

    const displayedRating = roundTo(smoothedRating, 2);
    const tier = resolveTier(displayedRating);

    return {
      userId,
      role,
      tier,
      weightedRating: roundTo(weightedRating, 4),
      displayedRating,
      weightedReviewCount: roundTo(weightedReviewCount, 4),
      reviewCount,
      globalAverage: roundTo(globalAverage, 4),
      smoothingM,
      calculatedAt: now.toISOString(),
    };
  }

  public async persistSnapshot(result: ReputationResult): Promise<void> {
    const snapshotDate = new Date(result.calculatedAt).toISOString().slice(0, 10);

    if (result.role === "DRIVER") {
      await this.pool.query(
        `
        insert into driver_reputation_snapshots (
          driver_id,
          snapshot_date,
          weighted_rating,
          displayed_rating,
          weighted_review_count,
          direct_rating_component,
          operational_stability_component,
          punctuality_component,
          route_adherence_component,
          compliance_component,
          reputation_tier
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (driver_id, snapshot_date) do update set
          weighted_rating = excluded.weighted_rating,
          displayed_rating = excluded.displayed_rating,
          weighted_review_count = excluded.weighted_review_count,
          direct_rating_component = excluded.direct_rating_component,
          operational_stability_component = excluded.operational_stability_component,
          punctuality_component = excluded.punctuality_component,
          route_adherence_component = excluded.route_adherence_component,
          compliance_component = excluded.compliance_component,
          reputation_tier = excluded.reputation_tier
        `,
        [
          result.userId,
          snapshotDate,
          result.weightedRating,
          result.displayedRating,
          result.weightedReviewCount,
          result.weightedRating,
          0,
          0,
          0,
          0,
          result.tier,
        ],
      );

      await this.pool.query(
        `
        insert into driver_statistics (driver_id, rating_avg, rating_count, created_at, updated_at)
        values ($1,$2,$3, now(), now())
        on conflict (driver_id) do update set
          rating_avg = excluded.rating_avg,
          rating_count = excluded.rating_count,
          updated_at = now()
        `,
        [result.userId, result.displayedRating, result.reviewCount],
      );

      return;
    }

    await this.pool.query(
      `
      insert into passenger_reputation_snapshots (
        passenger_id,
        snapshot_date,
        weighted_rating,
        displayed_rating,
        weighted_review_count,
        direct_rating_component,
        boarding_presence_component,
        payment_success_component,
        late_cancellation_component,
        conduct_component,
        reputation_tier
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      on conflict (passenger_id, snapshot_date) do update set
        weighted_rating = excluded.weighted_rating,
        displayed_rating = excluded.displayed_rating,
        weighted_review_count = excluded.weighted_review_count,
        direct_rating_component = excluded.direct_rating_component,
        boarding_presence_component = excluded.boarding_presence_component,
        payment_success_component = excluded.payment_success_component,
        late_cancellation_component = excluded.late_cancellation_component,
        conduct_component = excluded.conduct_component,
        reputation_tier = excluded.reputation_tier
      `,
      [
        result.userId,
        snapshotDate,
        result.weightedRating,
        result.displayedRating,
        result.weightedReviewCount,
        result.weightedRating,
        0,
        0,
        0,
        0,
        result.tier,
      ],
    );
  }

  private async loadReviews(userId: string, role: ReputationRole): Promise<ReviewRow[]> {
    const result = await this.pool.query(
      `
      select
        r.stars,
        r.created_at,
        v.iniciada_em,
        v.finalizada_em,
        v.distancia_real_m,
        v.valor_final_centavos
      from ride_reviews r
      left join viagens v on v.id = r.ride_id
      where r.reviewed_user_id = $1
        and r.reviewed_role = $2
      order by r.created_at desc
      limit 2000
      `,
      [userId, role],
    );

    return result.rows.map((row: any) => ({
      stars: Number(row.stars),
      createdAt: new Date(row.created_at),
      startedAt: row.iniciada_em ? new Date(row.iniciada_em) : null,
      finishedAt: row.finalizada_em ? new Date(row.finalizada_em) : null,
      distanceRealMeters: row.distancia_real_m === null ? null : Number(row.distancia_real_m),
      finalValueCents: row.valor_final_centavos === null ? null : Number(row.valor_final_centavos),
    }));
  }

  private async loadGlobalAverage(role: ReputationRole): Promise<number> {
    const result = await this.pool.query(
      `
      select avg(stars) as avg_stars
      from ride_reviews
      where reviewed_role = $1
      `,
      [role],
    );

    const raw = result.rows[0]?.avg_stars;
    const avg = raw === null || raw === undefined ? 4.7 : Number(raw);
    if (!Number.isFinite(avg) || avg <= 0) {
      return 4.7;
    }
    return avg;
  }

  private async loadP90RideValue(rows: ReviewRow[]): Promise<number | null> {
    const values = rows.map((row) => row.finalValueCents).filter((value): value is number => value !== null && Number.isFinite(value));
    if (values.length < 20) {
      return null;
    }

    values.sort((a, b) => a - b);
    const index = Math.min(values.length - 1, Math.floor(0.9 * (values.length - 1)));
    return values[index];
  }
}

function resolveTier(rating: number): ReputationTier {
  if (rating >= 4.9) {
    return "elite";
  }
  if (rating >= 4.8) {
    return "premium";
  }
  if (rating >= 4.6) {
    return "reliable";
  }
  if (rating >= 4.3) {
    return "observed";
  }
  return "restricted";
}

function differenceInDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / msPerDay);
}

function bayesianSmooth(rating: number, weightedCount: number, m: number, globalAverage: number): number {
  const v = weightedCount;
  if (v <= 0) {
    return globalAverage;
  }
  return (v / (v + m)) * rating + (m / (v + m)) * globalAverage;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

