import { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "./vehicle";

export interface VehicleRepository {
  list(): Promise<Vehicle[]>;
  create(input: CreateVehicleInput): Promise<Vehicle>;
  update(id: string, input: UpdateVehicleInput): Promise<Vehicle>;
  softDelete(id: string): Promise<void>;
}
