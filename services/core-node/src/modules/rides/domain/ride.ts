export interface Ride {
  id: string;
  passengerId: string;
  driverId: string | null;
  status: string;
  categoryCode: string | null;
  originAddress: string | null;
  destinationAddress: string | null;
  estimatedDistanceM: number | null;
  estimatedValueCentavos: number | null;
  finalValueCentavos: number | null;
  cancelledAt: string | null;
  createdAt: string;
}

export type RideCancellerRole = "PASSENGER" | "DRIVER";

export interface CancelRideInput {
  rideId: string;
  cancellerUserId: string;
  cancellerRole: RideCancellerRole;
  reasonCode?: string | null;
}

export interface CreateRideInput {
  passengerId: string;
  categoryCode: string;
  originLatitude: number;
  originLongitude: number;
  originAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  destinationAddress: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedFare: number;
  paymentMethodType?: string | null;
  dynamicMultiplier?: number;
}
