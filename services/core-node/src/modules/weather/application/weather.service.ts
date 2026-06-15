import { Pool } from "pg";

export type WeatherState = "CLEAR" | "LIGHT_RAIN" | "MODERATE_RAIN" | "HEAVY_RAIN" | "STORM";

export interface WeatherSnapshot {
  regionId: string;
  weatherState: WeatherState;
  intensityIndex: number;
  confidence: number;
  observedAt: string;
}

type OpenMeteoResponse = {
  current?: {
    weather_code?: number;
    precipitation?: number;
  };
};

export class WeatherService {
  private readonly pool: Pool | null;

  constructor(connectionString: string) {
    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
        })
      : null;
  }

  public async fetchAndStore(regionId: string, latitude: number, longitude: number): Promise<WeatherSnapshot> {
    const remote = await this.fetchOpenMeteo(latitude, longitude);

    if (this.pool) {
      await this.pool.query(
        `
        insert into weather_region_snapshots (region_id, weather_state, intensity_index, confidence, observed_at)
        values ($1, $2, $3, $4, now())
        `,
        [regionId, remote.weatherState, remote.intensityIndex, remote.confidence],
      );
    }

    return { regionId, ...remote, observedAt: new Date().toISOString() };
  }

  public async latest(regionId: string): Promise<WeatherSnapshot | null> {
    if (!this.pool) {
      return null;
    }

    const result = await this.pool.query<{
      region_id: string;
      weather_state: WeatherState;
      intensity_index: number;
      confidence: number;
      observed_at: Date;
    }>(
      `
      select region_id, weather_state, intensity_index, confidence, observed_at
      from weather_region_snapshots
      where region_id = $1
      order by observed_at desc
      limit 1
      `,
      [regionId],
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];
    return {
      regionId: String(row.region_id),
      weatherState: row.weather_state,
      intensityIndex: Number(row.intensity_index),
      confidence: Number(row.confidence),
      observedAt: new Date(row.observed_at).toISOString(),
    };
  }

  private async fetchOpenMeteo(lat: number, lng: number): Promise<Omit<WeatherSnapshot, "regionId" | "observedAt">> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,precipitation&timezone=auto`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { weatherState: "CLEAR", intensityIndex: 0, confidence: 0.5 };
      }

      const data = (await response.json()) as OpenMeteoResponse;
      const code = Number(data.current?.weather_code ?? 0);
      const precipitation = Number(data.current?.precipitation ?? 0);
      return mapWeather(code, precipitation);
    } catch {
      return { weatherState: "CLEAR", intensityIndex: 0, confidence: 0.3 };
    }
  }
}

function mapWeather(code: number, precipitation: number): Omit<WeatherSnapshot, "regionId" | "observedAt"> {
  if (code >= 95) {
    return { weatherState: "STORM", intensityIndex: 1, confidence: 0.9 };
  }

  if (precipitation >= 4 || code >= 65) {
    return { weatherState: "HEAVY_RAIN", intensityIndex: 0.85, confidence: 0.85 };
  }

  if (precipitation >= 1.5 || code >= 55) {
    return { weatherState: "MODERATE_RAIN", intensityIndex: 0.55, confidence: 0.8 };
  }

  if (precipitation > 0 || (code >= 51 && code <= 57)) {
    return { weatherState: "LIGHT_RAIN", intensityIndex: 0.25, confidence: 0.75 };
  }

  return { weatherState: "CLEAR", intensityIndex: 0, confidence: 0.7 };
}
