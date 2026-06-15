import { Category, CreateCategoryInput, UpdateCategoryInput } from "../domain/category";
import { CategoryRepository } from "../domain/category.repository";

export class CategoryService {
  constructor(private readonly repository: CategoryRepository) {}

  public list(): Promise<Category[]> {
    return this.repository.list();
  }

  public create(input: CreateCategoryInput): Promise<Category> {
    return this.repository.create(normalizeCreate(input));
  }

  public update(id: string, input: UpdateCategoryInput): Promise<Category> {
    if (!id) {
      throw new Error("id is required");
    }
    return this.repository.update(id, normalizeUpdate(input));
  }

  public async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("id is required");
    }
    await this.repository.softDelete(id);
  }
}

function normalizeCreate(input: CreateCategoryInput): CreateCategoryInput {
  return {
    ...input,
    code: normalizeCode(input.code),
    name: normalizeName(input.name),
    description: normalizeNullableText(input.description),
    active: input.active ?? true,
  };
}

function normalizeUpdate(input: UpdateCategoryInput): UpdateCategoryInput {
  return {
    ...input,
    code: input.code ? normalizeCode(input.code) : undefined,
    name: input.name ? normalizeName(input.name) : undefined,
    description: input.description === undefined ? undefined : normalizeNullableText(input.description),
  };
}

function normalizeCode(value: string): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!code) {
    throw new Error("code is required");
  }
  return code;
}

function normalizeName(value: string): string {
  const name = (value ?? "").trim();
  if (!name) {
    throw new Error("name is required");
  }
  return name;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
