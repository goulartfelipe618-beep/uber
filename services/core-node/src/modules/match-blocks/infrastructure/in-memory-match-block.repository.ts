import { randomUUID } from "node:crypto";
import { CreateMatchBlockInput, MatchBlock } from "../domain/match-block";
import { MatchBlockRepository } from "../domain/match-block.repository";

export class InMemoryMatchBlockRepository implements MatchBlockRepository {
  private readonly items: MatchBlock[] = [];

  public async create(input: CreateMatchBlockInput): Promise<MatchBlock> {
    const now = new Date().toISOString();
    const item: MatchBlock = {
      id: randomUUID(),
      passengerId: input.passengerId,
      driverId: input.driverId,
      rideId: input.rideId ?? null,
      blockType: input.blockType,
      reasonCode: input.reasonCode ?? null,
      createdAt: now,
      expiresAt: input.expiresAt,
    };
    this.items.unshift(item);
    return item;
  }

  public async hasActiveBlock(passengerId: string, driverId: string): Promise<boolean> {
    const now = Date.now();
    return this.items.some((item) => item.passengerId === passengerId && item.driverId === driverId && new Date(item.expiresAt).getTime() > now);
  }
}

