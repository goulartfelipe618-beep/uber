import { CreateRideReviewInput, RideReview, RideSummaryForReview, ReviewTag } from "./review";

export interface ReviewRepository {
  getRideSummary(rideId: string): Promise<RideSummaryForReview | null>;
  findTagsByCodes(codes: string[]): Promise<ReviewTag[]>;
  create(input: CreateRideReviewInput, reviewedUserId: string, reviewedRole: "PASSENGER" | "DRIVER"): Promise<RideReview>;
  listByReviewedUser(userId: string, limit: number): Promise<RideReview[]>;
}

