import { Category, CreateCategoryInput, UpdateCategoryInput } from "./category";

export interface CategoryRepository {
  list(): Promise<Category[]>;
  findByCode(code: string): Promise<Category | null>;
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  softDelete(id: string): Promise<void>;
}
