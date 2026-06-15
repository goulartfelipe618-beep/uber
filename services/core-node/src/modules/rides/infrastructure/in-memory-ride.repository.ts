import { randomUUID } from "node:crypto";
import { CreateRideInput, Ride } from "../domain/ride";
import { RideRepository } from "../domain/ride.repository";

export class InMemoryRideRepository implements RideRepository {
  private readonly items = new Map<string, Ride>();

  public seed(item: Omit<Ride, "id"> & { id?: string }): Ride {
    const id = item.id ?? randomUUID();
    const ride: Ride = { ...item, id };
    this.items.set(id, ride);
    return ride;
  }

  public async findById(id: string): Promise<Ride | null> {
    return this.items.get(id) ?? null;
  }

  public async create(input: CreateRideInput, _categoryId: string | null): Promise<Ride> {
    const id = randomUUID();
    const ride: Ride = {
      id,
      passengerId: input.passengerId,
      driverId: null,
      status: "SOLICITADA",
      categoryCode: input.categoryCode.toUpperCase(),
      originAddress: input.originAddress,
      destinationAddress: input.destinationAddress,
      estimatedDistanceM: Math.round(input.distanceKm * 1000),
      estimatedValueCentavos: Math.round(input.estimatedFare * 100),
      finalValueCentavos: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
    };
    this.items.set(id, ride);
    return ride;
  }

  public async getPickupCoords(rideId: string): Promise<{ latitude: number; longitude: number } | null> {
    return this.items.has(rideId) ? { latitude: -25.4284, longitude: -49.2733 } : null;
  }

  public async assignDriver(rideId: string, driverId: string): Promise<Ride> {
    const existing = this.items.get(rideId);
    if (!existing || existing.status !== "SOLICITADA") {
      throw new Error("ride not found or not assignable");
    }

    const updated: Ride = { ...existing, driverId, status: "MOTORISTA_A_CAMINHO" };
    this.items.set(rideId, updated);
    return updated;
  }

  public async markArrived(rideId: string): Promise<Ride> {
    const existing = this.items.get(rideId);
    if (!existing || existing.status !== "MOTORISTA_A_CAMINHO") {
      throw new Error("ride not found or invalid status");
    }

    const updated: Ride = { ...existing, status: "MOTORISTA_CHEGOU" };
    this.items.set(rideId, updated);
    return updated;
  }

  public async complete(rideId: string, finalValueCentavos: number): Promise<Ride> {
    const existing = this.items.get(rideId);
    if (!existing || existing.status !== "EM_ANDAMENTO") {
      throw new Error("ride not found or not in progress");
    }

    const updated: Ride = { ...existing, status: "CONCLUIDA", finalValueCentavos };
    this.items.set(rideId, updated);
    return updated;
  }

  public async cancel(rideId: string): Promise<Ride> {
    const existing = this.items.get(rideId);
    if (!existing) {
      throw new Error("ride not found");
    }

    if (existing.status === "CONCLUIDA") {
      throw new Error("ride is completed");
    }

    const updated: Ride = {
      ...existing,
      status: "CANCELADA",
      cancelledAt: existing.cancelledAt ?? new Date().toISOString(),
    };
    this.items.set(rideId, updated);
    return updated;
  }
}
