import { Pool } from "pg";
import { CreateRideInput, Ride } from "../domain/ride";
import { RideRepository } from "../domain/ride.repository";

type RideRow = {
  id: string;
  passageiro_id: string;
  motorista_id: string | null;
  status: string;
  category_code: string | null;
  origem_endereco: string | null;
  destino_endereco: string | null;
  distancia_estimada_m: number | null;
  valor_estimado_centavos: number | null;
  valor_final_centavos: number | null;
  cancelada_em: Date | null;
  criado_em: Date;
};

export class PostgresRideRepository implements RideRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async findById(id: string): Promise<Ride | null> {
    const result = await this.pool.query<RideRow>(
      `
      select
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      from viagens where id = $1 limit 1
      `,
      [id],
    );

    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  public async create(input: CreateRideInput, categoryId: string | null): Promise<Ride> {
    const result = await this.pool.query<RideRow>(
      `
      insert into viagens (
        passageiro_id, status, origem, destino,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos,
        ride_category_id, category_code, estimated_duration_min,
        payment_method, dynamic_multiplier, metadata_json
      ) values (
        $1, 'SOLICITADA',
        st_setsrid(st_makepoint($2, $3), 4326),
        st_setsrid(st_makepoint($4, $5), 4326),
        $6, $7,
        $8, $9,
        $10, $11, $12,
        $13::payment_method_type, $14,
        $15::jsonb
      )
      returning
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      `,
      [
        input.passengerId,
        input.originLongitude,
        input.originLatitude,
        input.destinationLongitude,
        input.destinationLatitude,
        input.originAddress,
        input.destinationAddress,
        Math.round(input.distanceKm * 1000),
        Math.round(input.estimatedFare * 100),
        categoryId,
        input.categoryCode.toUpperCase(),
        Math.round(input.durationMinutes),
        input.paymentMethodType ?? null,
        input.dynamicMultiplier ?? 1,
        JSON.stringify({ source: "api_v1" }),
      ],
    );

    return mapRow(result.rows[0]);
  }

  public async getPickupCoords(rideId: string): Promise<{ latitude: number; longitude: number } | null> {
    const result = await this.pool.query<{ lat: number; lng: number }>(
      `
      select st_y(origem::geometry) as lat, st_x(origem::geometry) as lng
      from viagens where id = $1 limit 1
      `,
      [rideId],
    );

    if (!result.rows.length) {
      return null;
    }

    return { latitude: Number(result.rows[0].lat), longitude: Number(result.rows[0].lng) };
  }

  public async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    const result = await this.pool.query<RideRow>(
      `
      update viagens
      set motorista_id = $2, status = 'MOTORISTA_A_CAMINHO', aceita_em = coalesce(aceita_em, now()), atualizado_em = now(), ride_version = ride_version + 1
      where id = $1 and status = 'SOLICITADA'
      returning
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      `,
      [rideId, driverId],
    );

    if (!result.rows.length) {
      throw new Error("ride not found or not assignable");
    }

    return mapRow(result.rows[0]);
  }

  public async markArrived(rideId: string): Promise<Ride> {
    const result = await this.pool.query<RideRow>(
      `
      update viagens
      set status = 'MOTORISTA_CHEGOU', atualizado_em = now(), ride_version = ride_version + 1
      where id = $1 and status = 'MOTORISTA_A_CAMINHO'
      returning
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      `,
      [rideId],
    );

    if (!result.rows.length) {
      throw new Error("ride not found or invalid status");
    }

    return mapRow(result.rows[0]);
  }

  public async complete(rideId: string, finalValueCentavos: number): Promise<Ride> {
    const result = await this.pool.query<RideRow>(
      `
      update viagens
      set status = 'CONCLUIDA', valor_final_centavos = $2, finalizada_em = now(), atualizado_em = now(), ride_version = ride_version + 1
      where id = $1 and status = 'EM_ANDAMENTO'
      returning
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      `,
      [rideId, finalValueCentavos],
    );

    if (!result.rows.length) {
      throw new Error("ride not found or not in progress");
    }

    return mapRow(result.rows[0]);
  }

  public async cancel(rideId: string): Promise<Ride> {
    const result = await this.pool.query<RideRow>(
      `
      update viagens
      set status = 'CANCELADA', cancelada_em = coalesce(cancelada_em, now()), atualizado_em = now()
      where id = $1 and status <> 'CONCLUIDA'
      returning
        id, passageiro_id, motorista_id, status, category_code,
        origem_endereco, destino_endereco,
        distancia_estimada_m, valor_estimado_centavos, valor_final_centavos,
        cancelada_em, criado_em
      `,
      [rideId],
    );

    if (!result.rows.length) {
      throw new Error("ride not found");
    }

    return mapRow(result.rows[0]);
  }
}

function mapRow(row: RideRow): Ride {
  return {
    id: String(row.id),
    passengerId: String(row.passageiro_id),
    driverId: row.motorista_id ? String(row.motorista_id) : null,
    status: String(row.status),
    categoryCode: row.category_code ? String(row.category_code) : null,
    originAddress: row.origem_endereco ?? null,
    destinationAddress: row.destino_endereco ?? null,
    estimatedDistanceM: row.distancia_estimada_m !== null ? Number(row.distancia_estimada_m) : null,
    estimatedValueCentavos: row.valor_estimado_centavos !== null ? Number(row.valor_estimado_centavos) : null,
    finalValueCentavos: row.valor_final_centavos !== null ? Number(row.valor_final_centavos) : null,
    cancelledAt: row.cancelada_em ? new Date(row.cancelada_em).toISOString() : null,
    createdAt: new Date(row.criado_em).toISOString(),
  };
}
