export type VehicleStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface Vehicle {
  id: string;
  driverId: string;
  plate: string;
  brand: string;
  model: string;
  color: string | null;
  year: number | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateVehicleInput {
  driverId: string;
  plate: string;
  brand: string;
  model: string;
  color?: string | null;
  year?: number | null;
  status?: VehicleStatus;
}

export interface UpdateVehicleInput {
  driverId?: string;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string | null;
  year?: number | null;
  status?: VehicleStatus;
}
