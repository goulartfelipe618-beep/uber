import { Pool } from "pg";
import { DynamicPricingInput, DynamicPricingResult } from "../domain/dynamic-pricing";

export class DynamicPricingService {
  private readonly pool: Pool | null;

  constructor(connectionString: string) {
    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
        })
      : null;
  }

  public async calculate(input: DynamicPricingInput): Promise<DynamicPricingResult> {
    const categoryCode = normalizeCode(input.categoryCode);
    const demandPressure = clamp(input.demandPressure ?? 1, 0, 10);
    const weatherPressure = clamp(input.weatherPressure ?? 0, 0, 1);
    const eventPressure = clamp(input.eventPressure ?? 0, 0, 1);
    const airportPressure = clamp(input.airportPressure ?? 0, 0, 1);
    const trafficPressure = clamp(input.trafficPressure ?? 0, 0, 1);
    const supplyShortage = clamp(input.supplyShortage ?? 0, 0, 1);
    const timePressure = clamp(input.timePressure ?? 0, 0, 1);
    const conversionPressure = clamp(input.conversionPressure ?? 0, 0, 1);

    const multiplierRaw =
      1 +
      0.28 * Math.max(0, demandPressure - 1) +
      0.16 * weatherPressure +
      0.12 * eventPressure +
      0.1 * airportPressure +
      0.14 * trafficPressure +
      0.14 * supplyShortage +
      0.04 * timePressure +
      0.02 * conversionPressure;

    const previous = input.previousMultiplier ?? 1;
    const ema = previous * 0.65 + multiplierRaw * 0.35;
    const dynamicCap = await this.resolveDynamicCap(categoryCode);
    const multiplierEffective = clamp(ema, 1, dynamicCap);

    if (this.pool && input.regionId) {
      await this.persistSnapshot(input.regionId, categoryCode, {
        demandPressure,
        weatherPressure,
        eventPressure,
        airportPressure,
        trafficPressure,
        supplyShortage,
        timePressure,
        conversionPressure,
        multiplierRaw,
        multiplierEffective,
      });
    }

    return {
      categoryCode,
      multiplierRaw: round(multiplierRaw, 4),
      multiplierEffective: round(multiplierEffective, 4),
      dynamicCap,
      factors: {
        demandPressure,
        weatherPressure,
        eventPressure,
        airportPressure,
        trafficPressure,
        supplyShortage,
        timePressure,
        conversionPressure,
      },
    };
  }

  private async resolveDynamicCap(categoryCode: string): Promise<number> {
    if (!this.pool) {
      return defaultCap(categoryCode);
    }

    const result = await this.pool.query(
      `select dynamic_cap from ride_categories where upper(code) = $1 and deleted_at is null limit 1`,
      [categoryCode],
    );

    if (result.rows.length === 0) {
      return defaultCap(categoryCode);
    }

    return Number(result.rows[0].dynamic_cap) || defaultCap(categoryCode);
  }

  private async persistSnapshot(
    regionId: string,
    categoryCode: string,
    data: Record<string, number>,
  ): Promise<void> {
    if (!this.pool) {
      return;
    }

    const category = await this.pool.query(
      `select id from ride_categories where upper(code) = $1 and deleted_at is null limit 1`,
      [categoryCode],
    );
    if (category.rows.length === 0) {
      return;
    }

    await this.pool.query(
      `
      insert into dynamic_pricing_snapshots (
        region_id, category_id, snapshot_at,
        demand_pressure, weather_pressure, event_pressure, airport_pressure,
        traffic_pressure, supply_shortage, time_pressure, conversion_pressure,
        multiplier_raw, multiplier_effective
      ) values ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      on conflict (region_id, category_id, snapshot_at) do nothing
      `,
      [
        regionId,
        category.rows[0].id,
        data.demandPressure,
        data.weatherPressure,
        data.eventPressure,
        data.airportPressure,
        data.trafficPressure,
        data.supplyShortage,
        data.timePressure,
        data.conversionPressure,
        data.multiplierRaw,
        data.multiplierEffective,
      ],
    );
  }
}

function normalizeCode(value: string): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!code) {
    throw new Error("categoryCode is required");
  }
  return code;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function defaultCap(code: string): number {
  const caps: Record<string, number> = {
    MOTO: 1.8,
    ECONOMICO: 2.2,
    COMFORT: 2.5,
    EXECUTIVO: 2.8,
    BLACK: 3.0,
    SUV: 2.8,
    PET: 2.3,
    ENTREGA: 2.0,
    AEROPORTO: 2.6,
    CORPORATIVO: 2.0,
    VAN: 2.5,
    MICRO_ONIBUS: 2.3,
    COMPARTILHADO: 1.8,
    PCD: 1.9,
  };
  return caps[code] ?? 2.2;
}
