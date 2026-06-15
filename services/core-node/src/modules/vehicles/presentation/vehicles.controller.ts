import { IncomingMessage, ServerResponse } from "node:http";
import { VehicleService } from "../application/vehicle.service";
import { CreateVehicleInput, UpdateVehicleInput } from "../domain/vehicle";

export class VehiclesController {
  constructor(private readonly service: VehicleService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/vehicles") {
      if (req.method === "GET") {
        const vehicles = await this.service.list();
        writeJson(res, 200, vehicles);
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

    const match = url.match(/^\/api\/v1\/vehicles\/([^/?#]+)$/);
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

function toCreateInput(body: any): CreateVehicleInput {
  return {
    driverId: String(body.driverId ?? ""),
    plate: String(body.plate ?? ""),
    brand: String(body.brand ?? body.make ?? ""),
    model: String(body.model ?? ""),
    color: body.color ?? null,
    year: body.year === undefined || body.year === null ? null : Number(body.year),
    status: body.status,
    seatCount: body.seatCount === undefined ? 4 : Number(body.seatCount),
  } as CreateVehicleInput & { seatCount?: number };
}

function toUpdateInput(body: any): UpdateVehicleInput {
  return {
    driverId: body.driverId === undefined ? undefined : String(body.driverId),
    plate: body.plate === undefined ? undefined : String(body.plate),
    brand: body.brand === undefined ? (body.make === undefined ? undefined : String(body.make)) : String(body.brand),
    model: body.model === undefined ? undefined : String(body.model),
    color: body.color === undefined ? undefined : body.color,
    year: body.year === undefined ? undefined : body.year === null ? null : Number(body.year),
    status: body.status,
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
