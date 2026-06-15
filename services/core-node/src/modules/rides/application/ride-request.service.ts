import { Pool } from "pg";
import { MatchDispatchService } from "../../match/application/match-dispatch.service";
import { OutboxService } from "../../outbox/application/outbox.service";
import { PricingService } from "../../pricing/application/pricing.service";
import { CreateRideInput, Ride } from "../domain/ride";
import { RideRepository } from "../domain/ride.repository";

export class RideRequestService {
  private readonly categoryPool: Pool | null;

  constructor(
    private readonly rideRepository: RideRepository,
    private readonly pricingService: PricingService,
    private readonly outboxService: OutboxService,
    connectionString: string,
    private readonly matchDispatchService?: MatchDispatchService,
  ) {
    this.categoryPool = connectionString
      ? new Pool({
          connectionString,
          ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
        })
      : null;
  }

  public async request(input: CreateRideInput): Promise<Ride> {
    const categoryCode = (input.categoryCode ?? "").trim().toUpperCase();
    if (!categoryCode) {
      throw new Error("categoryCode is required");
    }

    if (!input.passengerId) {
      throw new Error("passengerId is required");
    }

    const quote = await this.pricingService.quote({
      categoryCode,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
      dynamicMultiplier: input.dynamicMultiplier,
    });

    const categoryId = await this.resolveCategoryId(categoryCode);
    const ride = await this.rideRepository.create({ ...input, categoryCode, estimatedFare: quote.breakdown.total }, categoryId);

    await this.outboxService.publish({
      eventType: "RIDE_REQUESTED",
      aggregateType: "ride",
      aggregateId: ride.id,
      payload: {
        passengerId: ride.passengerId,
        categoryCode,
        estimatedFare: quote.breakdown.total,
        originAddress: input.originAddress,
        destinationAddress: input.destinationAddress,
      },
      idempotencyKey: `ride-requested:${ride.id}`,
    });

    if (this.matchDispatchService) {
      const match = await this.matchDispatchService.dispatchForRide(ride.id, ride.passengerId, categoryCode);
      if (match.matched && match.matchedDriverId) {
        const assigned = await this.rideRepository.assignDriver(ride.id, match.matchedDriverId);
        await this.outboxService.publish({
          eventType: "RIDE_DRIVER_ASSIGNED",
          aggregateType: "ride",
          aggregateId: ride.id,
          payload: { driverId: match.matchedDriverId, viaMatch: true, attemptId: match.attemptId },
          idempotencyKey: `ride-auto-assigned:${ride.id}`,
        });
        return assigned;
      }
    }

    return ride;
  }

  public async triggerMatch(rideId: string): Promise<{ matched: boolean; matchedDriverId: string | null }> {
    const ride = await this.rideRepository.findById(rideId);
    if (!ride) {
      throw new Error("ride not found");
    }

    if (!this.matchDispatchService) {
      throw new Error("match dispatch unavailable");
    }

    if (!ride.categoryCode) {
      throw new Error("ride has no category");
    }

    const match = await this.matchDispatchService.dispatchForRide(rideId, ride.passengerId, ride.categoryCode);
    if (match.matched && match.matchedDriverId) {
      await this.rideRepository.assignDriver(rideId, match.matchedDriverId);
    }

    return { matched: match.matched, matchedDriverId: match.matchedDriverId };
  }

  public findById(id: string): Promise<Ride | null> {
    return this.rideRepository.findById(id);
  }

  private async resolveCategoryId(code: string): Promise<string | null> {
    if (!this.categoryPool) {
      return null;
    }

    const result = await this.categoryPool.query<{ id: string }>(
      `select id from ride_categories where upper(code) = $1 and deleted_at is null limit 1`,
      [code],
    );

    return result.rows.length ? String(result.rows[0].id) : null;
  }
}
