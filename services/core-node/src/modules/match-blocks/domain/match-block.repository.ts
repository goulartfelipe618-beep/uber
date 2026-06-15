import { CreateMatchBlockInput, MatchBlock } from "./match-block";

export interface MatchBlockRepository {
  create(input: CreateMatchBlockInput): Promise<MatchBlock>;
  hasActiveBlock(passengerId: string, driverId: string): Promise<boolean>;
}

