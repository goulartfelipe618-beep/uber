import { IncomingMessage, ServerResponse } from "node:http";
import { GeocodingService } from "../application/geocoding.service";
import { GeocodingSource } from "../domain/geocoding";

export class GeocodingController {
  constructor(private readonly service: GeocodingService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url.startsWith("/api/v1/geocoding/autocomplete")) {
      if (req.method !== "GET") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const params = new URL(url, "http://local").searchParams;
      const suggestions = await this.service.autocomplete({
        query: params.get("q") ?? "",
        latitude: optionalNumber(params.get("lat")),
        longitude: optionalNumber(params.get("lng")),
        userId: params.get("userId") ?? undefined,
        limit: optionalNumber(params.get("limit")),
      });
      writeJson(res, 200, { suggestions });
      return true;
    }

    if (url === "/api/v1/geocoding/confirm" && req.method === "POST") {
      const body = await readJson(req);
      const confirmed = await this.service.confirmSelection(
        body.userId === undefined || body.userId === null ? undefined : String(body.userId),
        {
          mapboxFeatureId: body.mapboxFeatureId === undefined || body.mapboxFeatureId === null ? null : String(body.mapboxFeatureId),
          placeName: String(body.placeName ?? ""),
          addressText: String(body.addressText ?? ""),
          latitude: Number(body.latitude),
          longitude: Number(body.longitude),
          score: 1,
          source: (body.source ?? "local") as GeocodingSource,
        },
      );
      writeJson(res, 200, confirmed);
      return true;
    }

    return false;
  }
}

function optionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const payload = Buffer.concat(chunks).toString("utf-8").trim();
  if (!payload) {
    return {};
  }

  return JSON.parse(payload) as Record<string, unknown>;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
