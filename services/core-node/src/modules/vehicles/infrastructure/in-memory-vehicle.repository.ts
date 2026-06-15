import { randomUUID } from "node:crypto";
import { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "../domain/vehicle";
import { VehicleRepository } from "../domain/vehicle.repository";

export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly items = new Map<string, Vehicle>();

  public async list(): Promise<Vehicle[]> {
    return Array.from(this.items.values())
      .filter((item) => item.deletedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async create(input: CreateVehicleInput): Promise<Vehicle> {
    const now = new Date().toISOString();
    const id = randomUUID();

    const item: Vehicle = {
      id,
      driverId: input.driverId,
      plate: input.plate,
      brand: input.brand,
      model: input.model,
      color: input.color ?? null,
      year: input.year ?? null,
      status: input.status ?? "ACTIVE",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.items.set(id, item);
    return item;
  }

  public async update(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const existing = this.items.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new Error("vehicle not found");
    }

    const updated: Vehicle = {
      ...existing,
      driverId: input.driverId ?? existing.driverId,
      plate: input.plate ?? existing.plate,
      brand: input.brand ?? existing.brand,
      model: input.model ?? existing.model,
      color: input.color === undefined ? existing.color : input.color,
      year: input.year === undefined ? existing.year : input.year,
      status: input.status ?? existing.status,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);
    return updated;
  }

  public async softDelete(id: string): Promise<void> {
    const existing = this.items.get(id);
    if (!existing || existing.deletedAt !== null) {
      return;
    }
    const now = new Date().toISOString();
    this.items.set(id, { ...existing, deletedAt: now, updatedAt: now });
  }
}
