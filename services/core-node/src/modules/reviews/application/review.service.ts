import { CreateRideReviewInput, RideReview, ReviewerRole, RideSummaryForReview } from "../domain/review";
import { ReviewRepository } from "../domain/review.repository";

export class ReviewService {
  constructor(private readonly repository: ReviewRepository) {}

  public async create(input: CreateRideReviewInput): Promise<{ review: RideReview; updatedReputationUserId: string; updatedReputationRole: ReviewerRole }> {
    const normalized = normalizeCreate(input);
    const ride = await this.repository.getRideSummary(normalized.rideId);
    if (!ride) {
      throw new Error("ride not found");
    }

    validateRideForReview(ride);
    const { reviewedUserId, reviewedRole } = resolveReviewTarget(ride, normalized.reviewerUserId, normalized.reviewerRole);

    const tagCodes = normalized.tagCodes ?? [];
    if (tagCodes.length > 0) {
      const tags = await this.repository.findTagsByCodes(tagCodes);
      const resolvedCodes = new Set(tags.map((tag) => tag.code));
      for (const code of tagCodes) {
        if (!resolvedCodes.has(code)) {
          throw new Error("invalid tag code");
        }
      }
    }

    const review = await this.repository.create(normalized, reviewedUserId, reviewedRole);
    return { review, updatedReputationUserId: reviewedUserId, updatedReputationRole: reviewedRole };
  }

  public listByReviewedUser(userId: string, limit = 50): Promise<RideReview[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 50;
    if (!userId) {
      throw new Error("userId is required");
    }
    return this.repository.listByReviewedUser(userId, safeLimit);
  }
}

function normalizeCreate(input: CreateRideReviewInput): CreateRideReviewInput {
  const tagCodes = (input.tagCodes ?? [])
    .map((code) => String(code ?? "").trim().toUpperCase())
    .filter((code) => Boolean(code));

  return {
    rideId: String(input.rideId ?? "").trim(),
    reviewerUserId: String(input.reviewerUserId ?? "").trim(),
    reviewerRole: normalizeRole(input.reviewerRole),
    stars: normalizeStars(input.stars),
    comment: normalizeNullableText(input.comment),
    tagCodes: Array.from(new Set(tagCodes)),
  };
}

function normalizeRole(value: ReviewerRole): ReviewerRole {
  if (value !== "PASSENGER" && value !== "DRIVER") {
    throw new Error("reviewerRole is required");
  }
  return value;
}

function normalizeStars(value: number): number {
  const stars = Number(value);
  if (!Number.isFinite(stars)) {
    throw new Error("stars must be a number");
  }
  const rounded = Math.round(stars);
  if (rounded < 1 || rounded > 5) {
    throw new Error("stars must be between 1 and 5");
  }
  return rounded;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function validateRideForReview(ride: RideSummaryForReview): void {
  if (ride.status !== "CONCLUIDA") {
    throw new Error("ride is not completed");
  }
  if (!ride.driverId) {
    throw new Error("ride has no driver");
  }
}

function resolveReviewTarget(
  ride: RideSummaryForReview,
  reviewerUserId: string,
  reviewerRole: ReviewerRole,
): { reviewedUserId: string; reviewedRole: ReviewerRole } {
  if (!reviewerUserId) {
    throw new Error("reviewerUserId is required");
  }

  if (reviewerRole === "PASSENGER") {
    if (ride.passengerId !== reviewerUserId) {
      throw new Error("reviewer is not ride passenger");
    }
    if (!ride.driverId) {
      throw new Error("ride has no driver");
    }
    return { reviewedUserId: ride.driverId, reviewedRole: "DRIVER" };
  }

  if (reviewerRole === "DRIVER") {
    if (ride.driverId !== reviewerUserId) {
      throw new Error("reviewer is not ride driver");
    }
    return { reviewedUserId: ride.passengerId, reviewedRole: "PASSENGER" };
  }

  throw new Error("invalid reviewerRole");
}

