import { IncomingMessage, ServerResponse } from "node:http";
import { ReviewService } from "../application/review.service";
import { CreateRideReviewInput } from "../domain/review";
import { ReputationService } from "../../reputation/application/reputation.service";

export class ReviewsController {
  constructor(
    private readonly service: ReviewService,
    private readonly reputationService?: ReputationService,
  ) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    const createMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/reviews$/);
    if (createMatch) {
      if (req.method !== "POST") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const rideId = createMatch[1];
      const body = await readJson(req);
      const result = await this.service.create(toCreateInput(rideId, body));
      if (this.reputationService) {
        await this.reputationService.recomputeAndPersist(result.updatedReputationUserId, result.updatedReputationRole);
      }
      writeJson(res, 201, result.review);
      return true;
    }

    const listMatch = url.match(/^\/api\/v1\/users\/([^/?#]+)\/reviews$/);
    if (listMatch) {
      if (req.method !== "GET") {
        writeJson(res, 405, { message: "method not allowed" });
        return true;
      }

      const userId = listMatch[1];
      const limit = typeof new URL(url, "http://localhost").searchParams.get("limit") === "string" ? Number(new URL(url, "http://localhost").searchParams.get("limit")) : 50;
      const reviews = await this.service.listByReviewedUser(userId, limit);
      writeJson(res, 200, reviews);
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

function toCreateInput(rideId: string, body: any): CreateRideReviewInput {
  return {
    rideId,
    reviewerUserId: String(body.reviewerUserId ?? ""),
    reviewerRole: String(body.reviewerRole ?? "") as any,
    stars: toNumber(body.stars, "stars"),
    comment: body.comment === undefined ? undefined : body.comment === null ? null : String(body.comment),
    tagCodes: Array.isArray(body.tagCodes) ? body.tagCodes.map((code: any) => String(code ?? "")) : undefined,
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
