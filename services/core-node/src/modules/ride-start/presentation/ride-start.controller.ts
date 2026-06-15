import { IncomingMessage, ServerResponse } from "node:http";
import { RideStartService } from "../application/ride-start.service";

export class RideStartController {
  constructor(private readonly service: RideStartService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    const issueMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/start-codes$/);
    if (issueMatch && req.method === "POST") {
      const result = await this.service.issueCodes(issueMatch[1]);
      writeJson(res, 201, result);
      return true;
    }

    const validateMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/start-codes\/validate$/);
    if (validateMatch && req.method === "POST") {
      const body = await readJson(req);
      const result = await this.service.validate({
        rideId: validateMatch[1],
        role: body.role,
        code: String(body.code ?? ""),
        counterpartCode: body.counterpartCode,
      });
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

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
