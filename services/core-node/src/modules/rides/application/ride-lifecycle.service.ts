import { OutboxService } from "../../outbox/application/outbox.service";
import { PaymentService } from "../../payments/application/payment.service";
import { Ride } from "../domain/ride";
import { RideRepository } from "../domain/ride.repository";

export class RideLifecycleService {
  constructor(
    private readonly rideRepository: RideRepository,
    private readonly outboxService: OutboxService,
    private readonly paymentService?: PaymentService,
  ) {}

  public async accept(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.requireRide(rideId);
    if (ride.status !== "SOLICITADA") {
      throw new Error("ride is not in requested state");
    }

    if (!driverId) {
      throw new Error("driverId is required");
    }

    const updated = await this.rideRepository.assignDriver(rideId, driverId);
    await this.outboxService.publish({
      eventType: "RIDE_DRIVER_ASSIGNED",
      aggregateType: "ride",
      aggregateId: rideId,
      payload: { driverId, passengerId: updated.passengerId },
      idempotencyKey: `ride-assigned:${rideId}`,
    });

    return updated;
  }

  public async arrive(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.requireRide(rideId);
    if (ride.driverId !== driverId) {
      throw new Error("driver is not assigned to ride");
    }

    if (ride.status !== "MOTORISTA_A_CAMINHO") {
      throw new Error("invalid status for arrival");
    }

    const updated = await this.rideRepository.markArrived(rideId);
    await this.outboxService.publish({
      eventType: "RIDE_DRIVER_ARRIVED",
      aggregateType: "ride",
      aggregateId: rideId,
      payload: { driverId },
      idempotencyKey: `ride-arrived:${rideId}`,
    });

    return updated;
  }

  public async complete(rideId: string, driverId: string, finalValueCentavos?: number): Promise<Ride> {
    const ride = await this.requireRide(rideId);
    if (ride.driverId !== driverId) {
      throw new Error("driver is not assigned to ride");
    }

    if (ride.status !== "EM_ANDAMENTO") {
      throw new Error("ride is not in progress");
    }

    const updated = await this.rideRepository.complete(rideId, finalValueCentavos ?? ride.estimatedValueCentavos ?? 0);

    if (this.paymentService) {
      const intent = await this.paymentService.findByRide(rideId);
      if (intent && intent.status === "AUTHORIZED") {
        await this.paymentService.capture(intent.id);
      }
    }

    await this.outboxService.publish({
      eventType: "RIDE_COMPLETED",
      aggregateType: "ride",
      aggregateId: rideId,
      payload: { driverId, finalValueCentavos: updated.finalValueCentavos },
      idempotencyKey: `ride-completed:${rideId}`,
    });

    return updated;
  }

  private async requireRide(rideId: string): Promise<Ride> {
    const ride = await this.rideRepository.findById(rideId);
    if (!ride) {
      throw new Error("ride not found");
    }

    return ride;
  }
}
