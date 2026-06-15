import { CreateMatchBlockInput, MatchBlock } from "../domain/match-block";
import { MatchBlockRepository } from "../domain/match-block.repository";

export class MatchBlockService {
  constructor(private readonly repository: MatchBlockRepository) {}

  public create(input: CreateMatchBlockInput): Promise<MatchBlock> {
    const normalized = normalizeCreate(input);
    return this.repository.create(normalized);
  }

  public hasActiveBlock(passengerId: string, driverId: string): Promise<boolean> {
    if (!passengerId) {
      throw new Error("passengerId is required");
    }
    if (!driverId) {
      throw new Error("driverId is required");
    }
    return this.repository.hasActiveBlock(passengerId, driverId);
  }
}

function normalizeCreate(input: CreateMatchBlockInput): CreateMatchBlockInput {
  const passengerId = String(input.passengerId ?? "").trim();
  const driverId = String(input.driverId ?? "").trim();
  const expiresAt = String(input.expiresAt ?? "").trim();

  if (!passengerId) {
    throw new Error("passengerId is required");
  }
  if (!driverId) {
    throw new Error("driverId is required");
  }
  if (!expiresAt) {
    throw new Error("expiresAt is required");
  }

  return {
    passengerId,
    driverId,
    rideId: input.rideId ?? null,
    blockType: input.blockType,
    reasonCode: input.reasonCode ?? null,
    expiresAt,
  };
}

