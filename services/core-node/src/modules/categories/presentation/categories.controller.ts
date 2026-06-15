import { IncomingMessage, ServerResponse } from "node:http";
import { CategoryService } from "../application/category.service";
import { CreateCategoryInput, UpdateCategoryInput } from "../domain/category";

export class CategoriesController {
  constructor(private readonly service: CategoryService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/categories") {
      if (req.method === "GET") {
        const categories = await this.service.list();
        writeJson(res, 200, categories);
        return true;
      }

      if (req.method === "POST") {
        const body = await readJson(req);
        const created = await this.service.create(toCreateInput(body));
        writeJson(res, 201, created);
        return true;
      }

      writeJson(res, 405, { message: "method not allowed" });
      return true;
    }

    const match = url.match(/^\/api\/v1\/categories\/([^/?#]+)$/);
    if (!match) {
      return false;
    }

    const id = match[1];

    if (req.method === "PUT") {
      const body = await readJson(req);
      const updated = await this.service.update(id, toUpdateInput(body));
      writeJson(res, 200, updated);
      return true;
    }

    if (req.method === "DELETE") {
      await this.service.delete(id);
      writeJson(res, 204, null);
      return true;
    }

    writeJson(res, 405, { message: "method not allowed" });
    return true;
  }
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const payload = Buffer.concat(chunks).toString("utf-8").trim();
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("invalid json body");
  }
}

function toCreateInput(body: any): CreateCategoryInput {
  return {
    code: String(body.code ?? ""),
    name: String(body.name ?? ""),
    description: body.description === undefined ? undefined : body.description === null ? null : String(body.description),
    baseFare: toNumber(body.baseFare, "baseFare"),
    pricePerKm: toNumber(body.pricePerKm, "pricePerKm"),
    pricePerMinute: toNumber(body.pricePerMinute, "pricePerMinute"),
    minimumFare: toNumber(body.minimumFare, "minimumFare"),
    active: body.active === undefined ? undefined : Boolean(body.active),
  };
}

function toUpdateInput(body: any): UpdateCategoryInput {
  return {
    code: body.code === undefined ? undefined : String(body.code ?? ""),
    name: body.name === undefined ? undefined : String(body.name ?? ""),
    description: body.description === undefined ? undefined : body.description === null ? null : String(body.description),
    baseFare: body.baseFare === undefined ? undefined : toNumber(body.baseFare, "baseFare"),
    pricePerKm: body.pricePerKm === undefined ? undefined : toNumber(body.pricePerKm, "pricePerKm"),
    pricePerMinute: body.pricePerMinute === undefined ? undefined : toNumber(body.pricePerMinute, "pricePerMinute"),
    minimumFare: body.minimumFare === undefined ? undefined : toNumber(body.minimumFare, "minimumFare"),
    active: body.active === undefined ? undefined : Boolean(body.active),
  };
}

function toNumber(value: any, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field} must be a number`);
  }
  return num;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  if (payload === null || statusCode === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}
