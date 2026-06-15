import { ReputationRepository } from "../domain/reputation.repository";
import { ReputationResult, ReputationRole } from "../domain/reputation";

export class InMemoryReputationRepository implements ReputationRepository {
  public async compute(userId: string, role: ReputationRole): Promise<ReputationResult> {
    return {
      userId,
      role,
      tier: "restricted",
      weightedRating: 4.7,
      displayedRating: 4.7,
      weightedReviewCount: 0,
      reviewCount: 0,
      globalAverage: 4.7,
      smoothingM: role === "DRIVER" ? 50 : 20,
      calculatedAt: new Date().toISOString(),
    };
  }

  public async persistSnapshot(_: ReputationResult): Promise<void> {}
}

