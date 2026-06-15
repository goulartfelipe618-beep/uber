import { IncomingMessage, ServerResponse } from "node:http";
import { PlaceService } from "../application/place.service";
import { CreateSavedPlaceInput, SavedPlaceType } from "../domain/place";

export class PlacesController {
  constructor(private readonly service: PlaceService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    const listMatch = url.match(/^\/api\/v1\/users\/([^/?#]+)\/places$/);
    if (listMatch) {
      const userId = listMatch[1];
      if (req.method === "GET") {
        const places = await this.service.listByUser(userId);
        writeJson(res, 200, places);
        return true;
      }
      if (req.method === "POST") {
        const body = await readJson(req);
        const created = await this.service.create(toCreateInput(userId, body));
        writeJson(res, 201, created);
        return true;
      }
      writeJson(res, 405, { message: "method not allowed" });
      return true;
    }

    const deleteMatch = url.match(/^\/api\/v1\/users\/([^/?#]+)\/places\/([^/?#]+)$/);
    if (deleteMatch && req.method === "DELETE") {
      await this.service.delete(deleteMatch[2], deleteMatch[1]);
      writeJson(res, 204, null);
      return true;
    }

    return false;
  }
}

function toCreateInput(userId: string, body: any): CreateSavedPlaceInput {
  return {
    userId,
    placeType: String(body.placeType ?? "") as SavedPlaceType,
    label: String(body.label ?? ""),
    mapboxFeatureId: body.mapboxFeatureId ?? null,
    addressText: String(body.addressText ?? ""),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
  };
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

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  if (payload === null || statusCode === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}
