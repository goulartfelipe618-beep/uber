import { ReputationResult, ReputationRole } from "../domain/reputation";
import { ReputationRepository } from "../domain/reputation.repository";

export class ReputationService {
  constructor(private readonly repository: ReputationRepository) {}

  public async compute(userId: string, role: ReputationRole): Promise<ReputationResult> {
    const normalizedRole = normalizeRole(role);
    if (!userId) {
      throw new Error("userId is required");
    }
    return this.repository.compute(userId, normalizedRole);
  }

  public async recomputeAndPersist(userId: string, role: ReputationRole): Promise<ReputationResult> {
    const result = await this.compute(userId, role);
    await this.repository.persistSnapshot(result);
    return result;
  }
}

function normalizeRole(value: ReputationRole): ReputationRole {
  if (value !== "DRIVER" && value !== "PASSENGER") {
    throw new Error("role is required");
  }
  return value;
}

