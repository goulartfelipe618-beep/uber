import { randomUUID } from "node:crypto";
import { Category, CreateCategoryInput, UpdateCategoryInput } from "../domain/category";
import { CategoryRepository } from "../domain/category.repository";

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map<string, Category>();

  public async list(): Promise<Category[]> {
    return Array.from(this.items.values())
      .filter((item) => item.deletedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findByCode(code: string): Promise<Category | null> {
    const normalized = (code ?? "").trim().toUpperCase();
    if (!normalized) {
      return null;
    }
    for (const item of this.items.values()) {
      if (item.deletedAt !== null) {
        continue;
      }
      if (item.code.toUpperCase() === normalized) {
        return item;
      }
    }
    return null;
  }

  public async create(input: CreateCategoryInput): Promise<Category> {
    const now = new Date().toISOString();
    const id = randomUUID();

    const item: Category = {
      id,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      baseFare: input.baseFare,
      pricePerKm: input.pricePerKm,
      pricePerMinute: input.pricePerMinute,
      minimumFare: input.minimumFare,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.items.set(id, item);
    return item;
  }

  public async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = this.items.get(id);
    if (!existing || existing.deletedAt !== null) {
      throw new Error("category not found");
    }

    const updated: Category = {
      ...existing,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      baseFare: input.baseFare ?? existing.baseFare,
      pricePerKm: input.pricePerKm ?? existing.pricePerKm,
      pricePerMinute: input.pricePerMinute ?? existing.pricePerMinute,
      minimumFare: input.minimumFare ?? existing.minimumFare,
      active: input.active ?? existing.active,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);
    return updated;
  }

  public async softDelete(id: string): Promise<void> {
    const existing = this.items.get(id);
    if (!existing || existing.deletedAt !== null) {
      return;
    }
    this.items.set(id, { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}
