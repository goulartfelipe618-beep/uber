export type ReputationRole = "DRIVER" | "PASSENGER";

export type ReputationTier = "restricted" | "observed" | "reliable" | "premium" | "elite";

export interface ReputationResult {
  userId: string;
  role: ReputationRole;
  tier: ReputationTier;
  weightedRating: number;
  displayedRating: number;
  weightedReviewCount: number;
  reviewCount: number;
  globalAverage: number;
  smoothingM: number;
  calculatedAt: string;
}

