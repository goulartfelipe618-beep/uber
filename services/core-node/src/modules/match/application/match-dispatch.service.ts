import { GeoGoClient, GeoGoMatchResult } from "../../../integrations/geo-go/geo-go.client";
import { RideRepository } from "../../rides/domain/ride.repository";

export interface MatchDispatchResult {
  matched: boolean;
  matchedDriverId: string | null;
  attemptId: string | null;
  matchResult: GeoGoMatchResult | null;
}

export interface MatchRepository {
  persistMatchResult(rideId: string, result: GeoGoMatchResult, strategy?: string): Promise<string>;
}

export class MatchDispatchService {
  constructor(
    private readonly geoGoClient: GeoGoClient,
    private readonly matchRepository: MatchRepository,
    private readonly rideRepository: RideRepository,
  ) {}

  public async dispatchForRide(rideId: string, passengerId: string, categoryCode: string): Promise<MatchDispatchResult> {
    if (!this.geoGoClient.isConfigured()) {
      return { matched: false, matchedDriverId: null, attemptId: null, matchResult: null };
    }

    const coords = await this.rideRepository.getPickupCoords(rideId);
    if (!coords) {
      return { matched: false, matchedDriverId: null, attemptId: null, matchResult: null };
    }

    const result = await this.geoGoClient.resolveMatch({
      rideId,
      passengerId,
      pickupLat: coords.latitude,
      pickupLng: coords.longitude,
      requestedCategory: categoryCode,
    });

    if (!result || !result.matched_driver_id) {
      return { matched: false, matchedDriverId: null, attemptId: null, matchResult: result };
    }

    const attemptId = await this.matchRepository.persistMatchResult(rideId, result);

    return {
      matched: true,
      matchedDriverId: result.matched_driver_id,
      attemptId,
      matchResult: result,
    };
  }
}
