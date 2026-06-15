import { CreateVehicleInput, UpdateVehicleInput, Vehicle, VehicleStatus } from "../domain/vehicle";
import { VehicleRepository } from "../domain/vehicle.repository";

export class VehicleService {
  constructor(private readonly repository: VehicleRepository) {}

  public list(): Promise<Vehicle[]> {
    return this.repository.list();
  }

  public create(input: CreateVehicleInput): Promise<Vehicle> {
    return this.repository.create(normalizeCreate(input));
  }

  public update(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    if (!id) {
      throw new Error("id is required");
    }
    return this.repository.update(id, normalizeUpdate(input));
  }

  public async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("id is required");
    }
    await this.repository.softDelete(id);
  }
}

function normalizeCreate(input: CreateVehicleInput): CreateVehicleInput {
  return {
    ...input,
    driverId: normalizeRequiredText(input.driverId, "driverId"),
    plate: normalizePlate(input.plate),
    brand: normalizeRequiredText(input.brand, "brand"),
    model: normalizeRequiredText(input.model, "model"),
    color: normalizeNullableText(input.color),
    year: normalizeNullableYear(input.year),
    status: normalizeStatus(input.status),
  };
}

function normalizeUpdate(input: UpdateVehicleInput): UpdateVehicleInput {
  return {
    ...input,
    driverId: input.driverId === undefined ? undefined : normalizeRequiredText(input.driverId, "driverId"),
    plate: input.plate === undefined ? undefined : normalizePlate(input.plate),
    brand: input.brand === undefined ? undefined : normalizeRequiredText(input.brand, "brand"),
    model: input.model === undefined ? undefined : normalizeRequiredText(input.model, "model"),
    color: input.color === undefined ? undefined : normalizeNullableText(input.color),
    year: input.year === undefined ? undefined : normalizeNullableYear(input.year),
    status: input.status === undefined ? undefined : normalizeStatus(input.status),
  };
}

function normalizePlate(value: string): string {
  const plate = normalizeRequiredText(value, "plate").toUpperCase();
  return plate.replace(/\s+/g, "");
}

function normalizeRequiredText(value: string, field: string): string {
  const text = (value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableYear(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value)) {
    throw new Error("year must be an integer");
  }
  if (value < 1980 || value > new Date().getUTCFullYear() + 1) {
    throw new Error("year is out of range");
  }
  return value;
}

function normalizeStatus(value: VehicleStatus | undefined): VehicleStatus {
  return value ?? "ACTIVE";
}
