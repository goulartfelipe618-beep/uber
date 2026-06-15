import { Pool } from "pg";
import { CreatePaymentIntentInput, PaymentIntent, PaymentRepository } from "../domain/payment";

export class PostgresPaymentRepository implements PaymentRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const result = await this.pool.query(
      `
      insert into payment_intents (
        ride_id, user_id, payment_method_id, payment_method_type,
        status, amount_authorized_centavos, currency
      ) values ($1,$2,$3,$4,'PENDING',$5,'BRL')
      returning id, ride_id, user_id, payment_method_type, status,
                amount_authorized_centavos, currency, created_at
      `,
      [
        input.rideId,
        input.userId,
        input.paymentMethodId ?? null,
        input.paymentMethodType,
        input.amountCentavos,
      ],
    );
    return mapRow(result.rows[0]);
  }

  public async findByRide(rideId: string): Promise<PaymentIntent | null> {
    const result = await this.pool.query(
      `
      select id, ride_id, user_id, payment_method_type, status,
             amount_authorized_centavos, currency, created_at
      from payment_intents
      where ride_id = $1
      order by created_at desc
      limit 1
      `,
      [rideId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  }

  public async authorize(intentId: string): Promise<PaymentIntent> {
    const result = await this.pool.query(
      `
      update payment_intents
      set status = 'AUTHORIZED', updated_at = now()
      where id = $1
      returning id, ride_id, user_id, payment_method_type, status,
                amount_authorized_centavos, currency, created_at
      `,
      [intentId],
    );
    if (result.rows.length === 0) {
      throw new Error("payment intent not found");
    }
    return mapRow(result.rows[0]);
  }

  public async capture(intentId: string): Promise<PaymentIntent> {
    const result = await this.pool.query(
      `
      update payment_intents
      set status = 'CAPTURED', updated_at = now()
      where id = $1 and status = 'AUTHORIZED'
      returning id, ride_id, user_id, payment_method_type, status,
                amount_authorized_centavos, currency, created_at
      `,
      [intentId],
    );
    if (result.rows.length === 0) {
      throw new Error("payment intent not found or not authorized");
    }
    return mapRow(result.rows[0]);
  }
}

function mapRow(row: any): PaymentIntent {
  return {
    id: String(row.id),
    rideId: String(row.ride_id),
    userId: String(row.user_id),
    paymentMethodType: row.payment_method_type,
    status: String(row.status),
    amountAuthorizedCentavos: Number(row.amount_authorized_centavos),
    currency: String(row.currency),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
