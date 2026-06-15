export interface GeoGoMatchInput {
  rideId: string;
  passengerId: string;
  pickupLat: number;
  pickupLng: number;
  requestedCategory: string;
  allowedFallbackCategories?: string[];
  passengerReputationTier?: string;
  radiusStages?: number[];
  maxEtaSeconds?: number;
  isAirport?: boolean;
  isCorporate?: boolean;
  isShared?: boolean;
  needsWheelchairAccessible?: boolean;
}

export interface GeoGoRankedCandidate {
  driver_id: string;
  final_score: number;
  eta_seconds: number;
  distance_meters: number;
  compatibility_score: number;
}

export interface GeoGoMatchResult {
  matched_driver_id: string | null;
  stage_number: number;
  search_radius_meters: number;
  ranked_candidates: GeoGoRankedCandidate[];
}

export class GeoGoClient {
  constructor(private readonly baseUrl: string) {}

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public async resolveMatch(input: GeoGoMatchInput): Promise<GeoGoMatchResult | null> {
    if (!this.baseUrl) {
      return null;
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/match/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ride_id: input.rideId,
        passenger_id: input.passengerId,
        pickup_lat: input.pickupLat,
        pickup_lng: input.pickupLng,
        requested_category: input.requestedCategory,
        allowed_fallback_categories: input.allowedFallbackCategories ?? [],
        passenger_reputation_tier: input.passengerReputationTier ?? "RELIABLE",
        radius_stages: input.radiusStages,
        max_eta_seconds: input.maxEtaSeconds ?? 900,
        is_airport: input.isAirport ?? false,
        is_corporate: input.isCorporate ?? false,
        is_shared: input.isShared ?? false,
        needs_wheelchair_accessible: input.needsWheelchairAccessible ?? false,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GeoGoMatchResult;
  }
}
