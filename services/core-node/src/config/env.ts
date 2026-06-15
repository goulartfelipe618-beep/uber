export interface EnvConfig {
  appEnv: string;
  httpPort: number;
  pgDsn: string;
  rideStartSecret: string;
  mapboxToken: string;
  geoGoUrl: string;
  supabase: {
    url: string;
    anonKey: string;
    projectRef: string;
    managementToken: string;
  };
}

export function loadEnv(): EnvConfig {
  return {
    appEnv: process.env.APP_ENV ?? "development",
    httpPort: Number(process.env.HTTP_PORT ?? 3000),
    pgDsn: process.env.PG_DSN ?? "",
    rideStartSecret: process.env.RIDE_START_SECRET ?? "dev-ride-start-secret-change-me",
    mapboxToken: process.env.MAPBOX_ACCESS_TOKEN ?? "",
    geoGoUrl: process.env.GEO_GO_URL ?? "",
    supabase: {
      url: process.env.SUPABASE_URL ?? "",
      anonKey: process.env.SUPABASE_ANON_KEY ?? "",
      projectRef: process.env.SUPABASE_PROJECT_REF ?? "",
      managementToken: process.env.SUPABASE_MANAGEMENT_TOKEN ?? "",
    },
  };
}
