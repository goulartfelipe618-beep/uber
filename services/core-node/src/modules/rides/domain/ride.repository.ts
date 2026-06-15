import { CreateRideInput, Ride } from "./ride";

export interface PickupCoords {
  latitude: number;
  longitude: number;
}

export interface RideRepository {
  findById(id: string): Promise<Ride | null>;
  create(input: CreateRideInput, categoryId: string | null): Promise<Ride>;
  getPickupCoords(rideId: string): Promise<PickupCoords | null>;
  assignDriver(rideId: string, driverId: string): Promise<Ride>;
  markArrived(rideId: string): Promise<Ride>;
  complete(rideId: string, finalValueCentavos: number): Promise<Ride>;
  cancel(rideId: string): Promise<Ride>;
}
