import { IncomingMessage, ServerResponse } from "node:http";
import { UserService } from "../application/user.service";
import { UserType } from "../domain/user";

export class UsersController {
  constructor(private readonly service: UserService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/users/register" && req.method === "POST") {
      const body = await readJson(req);
      const session = await this.service.register({
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        phone: String(body.phone ?? ""),
        password: String(body.password ?? ""),
        type: String(body.type ?? "PASSAGEIRO") as UserType,
      });
      writeJson(res, 201, session);
      return true;
    }

    if (url === "/api/v1/users/login" && req.method === "POST") {
      const body = await readJson(req);
      const session = await this.service.login({
        login: String(body.login ?? body.email ?? body.phone ?? ""),
        password: String(body.password ?? ""),
      });
      writeJson(res, 200, session);
      return true;
    }

    if (url === "/api/v1/users/me" && req.method === "GET") {
      const token = extractBearer(req);
      const user = await this.service.me(token);
      writeJson(res, 200, user);
      return true;
    }

    return false;
  }
}

function extractBearer(req: IncomingMessage): string {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error("authorization header required");
  }

  return match[1].trim();
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
  res.end(JSON.stringify(payload));
}
