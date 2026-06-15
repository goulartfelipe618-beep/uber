import { ReputationResult, ReputationRole } from "./reputation";

export interface ReputationRepository {
  compute(userId: string, role: ReputationRole): Promise<ReputationResult>;
  persistSnapshot(result: ReputationResult): Promise<void>;
}

