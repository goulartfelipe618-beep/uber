import { IncomingMessage, ServerResponse } from "node:http";
import { WeatherService } from "../application/weather.service";

export class WeatherController {
  constructor(private readonly service: WeatherService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url.startsWith("/api/v1/weather/regions/") && req.method === "GET") {
      const match = url.match(/^\/api\/v1\/weather\/regions\/([^/?#]+)/);
      if (!match) {
        return false;
      }

      const params = new URL(url, "http://local").searchParams;
      const lat = Number(params.get("lat"));
      const lng = Number(params.get("lng"));
      const regionId = match[1];

      if (params.get("refresh") === "true" && Number.isFinite(lat) && Number.isFinite(lng)) {
        const snapshot = await this.service.fetchAndStore(regionId, lat, lng);
        writeJson(res, 200, snapshot);
        return true;
      }

      const latest = await this.service.latest(regionId);
      if (!latest) {
        writeJson(res, 404, { message: "weather snapshot not found" });
        return true;
      }

      writeJson(res, 200, latest);
      return true;
    }

    return false;
  }
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
