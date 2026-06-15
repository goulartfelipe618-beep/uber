export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCategoryInput {
  code: string;
  name: string;
  description?: string | null;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  active?: boolean;
}

export interface UpdateCategoryInput {
  code?: string;
  name?: string;
  description?: string | null;
  baseFare?: number;
  pricePerKm?: number;
  pricePerMinute?: number;
  minimumFare?: number;
  active?: boolean;
}
