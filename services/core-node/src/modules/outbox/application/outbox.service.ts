import { Pool } from "pg";

export interface OutboxPublishInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  producer?: string;
  payload?: Record<string, unknown>;
  traceId?: string | null;
  idempotencyKey?: string | null;
}

export class OutboxService {
  private readonly pool: Pool | null;

  constructor(connectionString: string) {
    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
        })
      : null;
  }

  public async publish(input: OutboxPublishInput): Promise<{ eventId: string } | null> {
    if (!this.pool) {
      return null;
    }

    const result = await this.pool.query<{ event_id: string }>(
      `
      insert into event_outbox (
        event_type, aggregate_type, aggregate_id, producer, payload, trace_id, idempotency_key
      ) values ($1, $2, $3, $4, $5::jsonb, $6, $7)
      returning event_id
      `,
      [
        input.eventType,
        input.aggregateType,
        input.aggregateId,
        input.producer ?? "core-node",
        JSON.stringify(input.payload ?? {}),
        input.traceId ?? null,
        input.idempotencyKey ?? null,
      ],
    );

    return { eventId: String(result.rows[0].event_id) };
  }
}
