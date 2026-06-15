import { IncomingMessage, ServerResponse } from "node:http";
import { RideCancellationService } from "../application/ride-cancellation.service";
import { RideLifecycleService } from "../application/ride-lifecycle.service";
import { RideRequestService } from "../application/ride-request.service";
import { CancelRideInput, CreateRideInput } from "../domain/ride";

export class RidesController {
  constructor(
    private readonly cancellationService: RideCancellationService,
    private readonly requestService?: RideRequestService,
    private readonly lifecycleService?: RideLifecycleService,
  ) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/rides" && req.method === "POST") {
      if (!this.requestService) {
        writeJson(res, 503, { message: "ride request unavailable without database" });
        return true;
      }

      const body = await readJson(req);
      const ride = await this.requestService.request(toCreateInput(body));
      writeJson(res, 201, ride);
      return true;
    }

    const getMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)$/);
    if (getMatch && req.method === "GET") {
      if (!this.requestService) {
        writeJson(res, 503, { message: "ride lookup unavailable without database" });
        return true;
      }

      const ride = await this.requestService.findById(getMatch[1]);
      if (!ride) {
        writeJson(res, 404, { message: "ride not found" });
        return true;
      }

      writeJson(res, 200, ride);
      return true;
    }

    const cancelMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/cancel$/);
    if (cancelMatch) {
      if (req.method !== "POST") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const body = await readJson(req);
      const result = await this.cancellationService.cancel(toCancelInput(cancelMatch[1], body));
      writeJson(res, 200, result);
      return true;
    }

    const acceptMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/accept$/);
    if (acceptMatch && req.method === "POST") {
      if (!this.lifecycleService) {
        writeJson(res, 503, { message: "ride lifecycle unavailable without database" });
        return true;
      }

      const body = await readJson(req);
      const ride = await this.lifecycleService.accept(acceptMatch[1], String(body.driverId ?? ""));
      writeJson(res, 200, ride);
      return true;
    }

    const arriveMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/arrive$/);
    if (arriveMatch && req.method === "POST") {
      if (!this.lifecycleService) {
        writeJson(res, 503, { message: "ride lifecycle unavailable without database" });
        return true;
      }

      const body = await readJson(req);
      const ride = await this.lifecycleService.arrive(arriveMatch[1], String(body.driverId ?? ""));
      writeJson(res, 200, ride);
      return true;
    }

    const completeMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/complete$/);
    if (completeMatch && req.method === "POST") {
      if (!this.lifecycleService) {
        writeJson(res, 503, { message: "ride lifecycle unavailable without database" });
        return true;
      }

      const body = await readJson(req);
      const finalValueCentavos = body.finalValueCentavos === undefined ? undefined : Number(body.finalValueCentavos);
      const ride = await this.lifecycleService.complete(completeMatch[1], String(body.driverId ?? ""), finalValueCentavos);
      writeJson(res, 200, ride);
      return true;
    }

    const matchTrigger = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/match$/);
    if (matchTrigger && req.method === "POST") {
      if (!this.requestService) {
        writeJson(res, 503, { message: "match unavailable without database" });
        return true;
      }

      const result = await this.requestService.triggerMatch(matchTrigger[1]);
      writeJson(res, 200, result);
      return true;
    }

    return false;
  }
}

function toCreateInput(body: Record<string, unknown>): CreateRideInput {
  return {
    passengerId: String(body.passengerId ?? ""),
    categoryCode: String(body.categoryCode ?? ""),
    originLatitude: Number(body.originLatitude),
    originLongitude: Number(body.originLongitude),
    originAddress: String(body.originAddress ?? ""),
    destinationLatitude: Number(body.destinationLatitude),
    destinationLongitude: Number(body.destinationLongitude),
    destinationAddress: String(body.destinationAddress ?? ""),
    distanceKm: Number(body.distanceKm),
    durationMinutes: Number(body.durationMinutes),
    estimatedFare: Number(body.estimatedFare ?? 0),
    paymentMethodType: body.paymentMethodType === undefined ? undefined : body.paymentMethodType === null ? null : String(body.paymentMethodType),
    dynamicMultiplier: body.dynamicMultiplier === undefined ? undefined : Number(body.dynamicMultiplier),
  };
}

function toCancelInput(rideId: string, body: Record<string, unknown>): CancelRideInput {
  return {
    rideId,
    cancellerUserId: String(body.cancellerUserId ?? ""),
    cancellerRole: String(body.cancellerRole ?? "") as CancelRideInput["cancellerRole"],
    reasonCode: body.reasonCode === undefined ? undefined : body.reasonCode === null ? null : String(body.reasonCode),
  };
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

  try {
    return JSON.parse(payload) as Record<string, unknown>;
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
