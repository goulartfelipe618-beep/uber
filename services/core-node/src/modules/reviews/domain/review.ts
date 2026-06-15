export type ReviewerRole = "PASSENGER" | "DRIVER";

export interface ReviewTag {
  id: string;
  code: string;
  name: string;
  group: string | null;
}

export interface RideReview {
  id: string;
  rideId: string;
  reviewerUserId: string;
  reviewedUserId: string;
  reviewerRole: ReviewerRole;
  reviewedRole: ReviewerRole;
  stars: number;
  comment: string | null;
  createdAt: string;
  tags: ReviewTag[];
}

export interface CreateRideReviewInput {
  rideId: string;
  reviewerUserId: string;
  reviewerRole: ReviewerRole;
  stars: number;
  comment?: string | null;
  tagCodes?: string[];
}

export interface RideSummaryForReview {
  id: string;
  passengerId: string;
  driverId: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  distanceRealMeters: number | null;
  finalValueCents: number | null;
}

