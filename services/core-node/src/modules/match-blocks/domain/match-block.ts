export type MatchBlockType =
  | "PASSENGER_CANCEL_DRIVER_24H"
  | "DRIVER_CANCEL_PASSENGER_REDISPATCH"
  | "PAIR_RISK_BLOCK"
  | "MANUAL_BLOCK";

export interface MatchBlock {
  id: string;
  passengerId: string;
  driverId: string;
  rideId: string | null;
  blockType: MatchBlockType;
  reasonCode: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateMatchBlockInput {
  passengerId: string;
  driverId: string;
  rideId?: string | null;
  blockType: MatchBlockType;
  reasonCode?: string | null;
  expiresAt: string;
}
