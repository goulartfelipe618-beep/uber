import { IncomingMessage, ServerResponse } from "node:http";
import { PricingService } from "../application/pricing.service";
import { PricingQuoteRequest } from "../domain/pricing";

export class PricingController {
  constructor(private readonly service: PricingService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/pricing/quote") {
      if (req.method !== "POST") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const body = await readJson(req);
      const result = await this.service.quote(toQuoteRequest(body));
      writeJson(res, 200, result);
      return true;
    }

    return false;
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

function toQuoteRequest(body: any): PricingQuoteRequest {
  return {
    categoryCode: String(body.categoryCode ?? ""),
    distanceKm: toNumber(body.distanceKm, "distanceKm"),
    durationMinutes: toNumber(body.durationMinutes, "durationMinutes"),
    dynamicMultiplier: body.dynamicMultiplier === undefined ? undefined : toNumber(body.dynamicMultiplier, "dynamicMultiplier"),
    trafficSurcharge: body.trafficSurcharge === undefined ? undefined : toNumber(body.trafficSurcharge, "trafficSurcharge"),
    airportFee: body.airportFee === undefined ? undefined : toNumber(body.airportFee, "airportFee"),
    tollEstimate: body.tollEstimate === undefined ? undefined : toNumber(body.tollEstimate, "tollEstimate"),
    addonsFee: body.addonsFee === undefined ? undefined : toNumber(body.addonsFee, "addonsFee"),
    discounts: body.discounts === undefined ? undefined : toNumber(body.discounts, "discounts"),
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

