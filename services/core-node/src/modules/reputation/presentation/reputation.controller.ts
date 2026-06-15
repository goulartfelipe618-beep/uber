import { IncomingMessage, ServerResponse } from "node:http";
import { ReputationService } from "../application/reputation.service";
import { ReputationRole } from "../domain/reputation";

export class ReputationController {
  constructor(private readonly service: ReputationService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/v1\/users\/([^/?#]+)\/reputation$/);
    if (!match) {
      return false;
    }

    if (req.method !== "GET") {
      writeJson(res, 405, { message: "method not allowed" });
      return true;
    }

    const userId = match[1];
    const parsedUrl = new URL(url, "http://localhost");
    const role = String(parsedUrl.searchParams.get("role") ?? "").trim().toUpperCase() as ReputationRole;
    const persist = String(parsedUrl.searchParams.get("persist") ?? "").trim().toLowerCase() === "true";

    const result = persist ? await this.service.recomputeAndPersist(userId, role) : await this.service.compute(userId, role);
    writeJson(res, 200, result);
    return true;
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

