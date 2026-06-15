import { MatchBlockService } from "../../match-blocks/application/match-block.service";
import { RideCancellerRole, CancelRideInput, Ride } from "../domain/ride";
import { RideRepository } from "../domain/ride.repository";

export class RideCancellationService {
  constructor(
    private readonly rideRepository: RideRepository,
    private readonly matchBlockService: MatchBlockService,
  ) {}

  public async cancel(input: CancelRideInput): Promise<{ ride: Ride; createdBlockId: string | null }> {
    const normalized = normalizeCancel(input);
    const ride = await this.rideRepository.findById(normalized.rideId);
    if (!ride) {
      throw new Error("ride not found");
    }

    validateCanceller(ride, normalized.cancellerUserId, normalized.cancellerRole);
    const cancelled = await this.rideRepository.cancel(normalized.rideId);

    const createdBlockId = await this.createBlockIfNeeded(cancelled, normalized);
    return { ride: cancelled, createdBlockId };
  }

  private async createBlockIfNeeded(ride: Ride, input: CancelRideInput): Promise<string | null> {
    if (!ride.driverId) {
      return null;
    }

    const now = Date.now();
    if (input.cancellerRole === "PASSENGER") {
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      const block = await this.matchBlockService.create({
        passengerId: ride.passengerId,
        driverId: ride.driverId,
        rideId: ride.id,
        blockType: "PASSENGER_CANCEL_DRIVER_24H",
        reasonCode: input.reasonCode ?? null,
        expiresAt,
      });
      return block.id;
    }

    if (input.cancellerRole === "DRIVER") {
      const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
      const block = await this.matchBlockService.create({
        passengerId: ride.passengerId,
        driverId: ride.driverId,
        rideId: ride.id,
        blockType: "DRIVER_CANCEL_PASSENGER_REDISPATCH",
        reasonCode: input.reasonCode ?? null,
        expiresAt,
      });
      return block.id;
    }

    return null;
  }
}

function normalizeCancel(input: CancelRideInput): CancelRideInput {
  return {
    rideId: String(input.rideId ?? "").trim(),
    cancellerUserId: String(input.cancellerUserId ?? "").trim(),
    cancellerRole: normalizeRole(input.cancellerRole),
    reasonCode: input.reasonCode === undefined ? undefined : input.reasonCode === null ? null : String(input.reasonCode ?? "").trim(),
  };
}

function normalizeRole(value: RideCancellerRole): RideCancellerRole {
  if (value !== "PASSENGER" && value !== "DRIVER") {
    throw new Error("cancellerRole is required");
  }
  return value;
}

function validateCanceller(ride: Ride, cancellerUserId: string, role: RideCancellerRole): void {
  if (!cancellerUserId) {
    throw new Error("cancellerUserId is required");
  }

  if (role === "PASSENGER") {
    if (ride.passengerId !== cancellerUserId) {
      throw new Error("canceller is not ride passenger");
    }
    return;
  }

  if (role === "DRIVER") {
    if (!ride.driverId) {
      throw new Error("ride has no driver");
    }
    if (ride.driverId !== cancellerUserId) {
      throw new Error("canceller is not ride driver");
    }
    return;
  }
}

