import { randomUUID } from "node:crypto";
import { CreateRideReviewInput, RideReview, RideSummaryForReview, ReviewTag } from "../domain/review";
import { ReviewRepository } from "../domain/review.repository";

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly rides = new Map<string, RideSummaryForReview>();
  private readonly tags = new Map<string, ReviewTag>();
  private readonly reviews: RideReview[] = [];

  public async getRideSummary(rideId: string): Promise<RideSummaryForReview | null> {
    return this.rides.get(rideId) ?? null;
  }

  public async findTagsByCodes(codes: string[]): Promise<ReviewTag[]> {
    const normalized = codes.map((code) => String(code ?? "").trim().toUpperCase()).filter((code) => Boolean(code));
    return normalized.map((code) => this.tags.get(code)).filter((tag): tag is ReviewTag => Boolean(tag));
  }

  public async create(
    input: CreateRideReviewInput,
    reviewedUserId: string,
    reviewedRole: "PASSENGER" | "DRIVER",
  ): Promise<RideReview> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const tags = input.tagCodes?.length ? await this.findTagsByCodes(input.tagCodes) : [];

    const review: RideReview = {
      id,
      rideId: input.rideId,
      reviewerUserId: input.reviewerUserId,
      reviewedUserId,
      reviewerRole: input.reviewerRole,
      reviewedRole,
      stars: input.stars,
      comment: input.comment ?? null,
      createdAt: now,
      tags,
    };

    this.reviews.unshift(review);
    return review;
  }

  public async listByReviewedUser(userId: string, limit: number): Promise<RideReview[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 50;
    return this.reviews.filter((review) => review.reviewedUserId === userId).slice(0, safeLimit);
  }
}

