import { Pool } from "pg";
import { CreateRideReviewInput, RideReview, RideSummaryForReview, ReviewTag } from "../domain/review";
import { ReviewRepository } from "../domain/review.repository";

export class PostgresReviewRepository implements ReviewRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async getRideSummary(rideId: string): Promise<RideSummaryForReview | null> {
    const result = await this.pool.query(
      `
      select
        id,
        passageiro_id,
        motorista_id,
        status,
        iniciada_em,
        finalizada_em,
        distancia_real_m,
        valor_final_centavos
      from viagens
      where id = $1
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
      passengerId: String(row.passageiro_id),
      driverId: row.motorista_id ? String(row.motorista_id) : null,
      status: String(row.status),
      startedAt: row.iniciada_em ? new Date(row.iniciada_em).toISOString() : null,
      finishedAt: row.finalizada_em ? new Date(row.finalizada_em).toISOString() : null,
      distanceRealMeters: row.distancia_real_m === null ? null : Number(row.distancia_real_m),
      finalValueCents: row.valor_final_centavos === null ? null : Number(row.valor_final_centavos),
    };
  }

  public async findTagsByCodes(codes: string[]): Promise<ReviewTag[]> {
    const normalized = codes.map((code) => String(code ?? "").trim().toUpperCase()).filter((code) => Boolean(code));
    if (normalized.length === 0) {
      return [];
    }

    const result = await this.pool.query(
      `
      select
        id,
        code,
        name,
        tag_group
      from review_tags
      where is_active is true
        and code = any($1::text[])
      `,
      [normalized],
    );

    return result.rows.map((row: any) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      group: row.tag_group === null ? null : String(row.tag_group),
    }));
  }

  public async create(
    input: CreateRideReviewInput,
    reviewedUserId: string,
    reviewedRole: "PASSENGER" | "DRIVER",
  ): Promise<RideReview> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");

      const insertReview = await client.query(
        `
        insert into ride_reviews (
          ride_id,
          reviewer_user_id,
          reviewed_user_id,
          reviewer_role,
          reviewed_role,
          stars,
          comment
        ) values ($1,$2,$3,$4,$5,$6,$7)
        returning
          id,
          ride_id,
          reviewer_user_id,
          reviewed_user_id,
          reviewer_role,
          reviewed_role,
          stars,
          comment,
          created_at
        `,
        [
          input.rideId,
          input.reviewerUserId,
          reviewedUserId,
          input.reviewerRole,
          reviewedRole,
          input.stars,
          input.comment ?? null,
        ],
      );

      const reviewRow = insertReview.rows[0];
      const reviewId = String(reviewRow.id);

      const tagCodes = (input.tagCodes ?? []).map((code) => String(code ?? "").trim().toUpperCase()).filter((code) => Boolean(code));
      const tags = tagCodes.length ? await this.findTagsByCodes(tagCodes) : [];

      if (tags.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        let index = 1;
        for (const tag of tags) {
          values.push(`($${index++}, $${index++})`);
          params.push(reviewId, tag.id);
        }

        await client.query(
          `
          insert into ride_review_tag_links (ride_review_id, review_tag_id)
          values ${values.join(",")}
          on conflict do nothing
          `,
          params,
        );
      }

      await client.query("commit");

      return {
        id: reviewId,
        rideId: String(reviewRow.ride_id),
        reviewerUserId: String(reviewRow.reviewer_user_id),
        reviewedUserId: String(reviewRow.reviewed_user_id),
        reviewerRole: String(reviewRow.reviewer_role) as "PASSENGER" | "DRIVER",
        reviewedRole: String(reviewRow.reviewed_role) as "PASSENGER" | "DRIVER",
        stars: Number(reviewRow.stars),
        comment: reviewRow.comment === null ? null : String(reviewRow.comment),
        createdAt: new Date(reviewRow.created_at).toISOString(),
        tags,
      };
    } catch (error: unknown) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  public async listByReviewedUser(userId: string, limit: number): Promise<RideReview[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 50;
    const result = await this.pool.query(
      `
      select
        r.id,
        r.ride_id,
        r.reviewer_user_id,
        r.reviewed_user_id,
        r.reviewer_role,
        r.reviewed_role,
        r.stars,
        r.comment,
        r.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', t.id,
              'code', t.code,
              'name', t.name,
              'group', t.tag_group
            )
          ) filter (where t.id is not null),
          '[]'::json
        ) as tags
      from ride_reviews r
      left join ride_review_tag_links l on l.ride_review_id = r.id
      left join review_tags t on t.id = l.review_tag_id
      where r.reviewed_user_id = $1
      group by r.id
      order by r.created_at desc
      limit $2
      `,
      [userId, safeLimit],
    );

    return result.rows.map((row: any) => ({
      id: String(row.id),
      rideId: String(row.ride_id),
      reviewerUserId: String(row.reviewer_user_id),
      reviewedUserId: String(row.reviewed_user_id),
      reviewerRole: String(row.reviewer_role) as "PASSENGER" | "DRIVER",
      reviewedRole: String(row.reviewed_role) as "PASSENGER" | "DRIVER",
      stars: Number(row.stars),
      comment: row.comment === null ? null : String(row.comment),
      createdAt: new Date(row.created_at).toISOString(),
      tags: Array.isArray(row.tags)
        ? row.tags
            .filter((tag: any) => tag && tag.id)
            .map((tag: any) => ({
              id: String(tag.id),
              code: String(tag.code),
              name: String(tag.name),
              group: tag.group === null ? null : String(tag.group),
            }))
        : [],
    }));
  }
}

