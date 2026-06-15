import { IncomingMessage, ServerResponse } from "node:http";
import { DynamicPricingService } from "../application/dynamic-pricing.service";
import { DynamicPricingInput } from "../domain/dynamic-pricing";

export class DynamicPricingController {
  constructor(private readonly service: DynamicPricingService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/pricing/dynamic") {
      if (req.method !== "POST") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const body = await readJson(req);
      const result = await this.service.calculate(toInput(body));
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

function toInput(body: any): DynamicPricingInput {
  return {
    regionId: body.regionId ? String(body.regionId) : undefined,
    categoryCode: String(body.categoryCode ?? ""),
    demandPressure: optionalNumber(body.demandPressure),
    weatherPressure: optionalNumber(body.weatherPressure),
    eventPressure: optionalNumber(body.eventPressure),
    airportPressure: optionalNumber(body.airportPressure),
    trafficPressure: optionalNumber(body.trafficPressure),
    supplyShortage: optionalNumber(body.supplyShortage),
    timePressure: optionalNumber(body.timePressure),
    conversionPressure: optionalNumber(body.conversionPressure),
    previousMultiplier: optionalNumber(body.previousMultiplier),
  };
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("invalid numeric field");
  }
  return num;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
