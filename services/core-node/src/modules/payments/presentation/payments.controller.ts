import { IncomingMessage, ServerResponse } from "node:http";
import { PaymentService } from "../application/payment.service";
import { CreatePaymentIntentInput, PaymentMethodType } from "../domain/payment";

export class PaymentsController {
  constructor(private readonly service: PaymentService) {}

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    if (url === "/api/v1/payments/intents" && req.method === "POST") {
      const body = await readJson(req);
      const created = await this.service.createIntent(toCreateInput(body));
      writeJson(res, 201, created);
      return true;
    }

    const authorizeMatch = url.match(/^\/api\/v1\/payments\/intents\/([^/?#]+)\/authorize$/);
    if (authorizeMatch && req.method === "POST") {
      const authorized = await this.service.authorize(authorizeMatch[1]);
      writeJson(res, 200, authorized);
      return true;
    }

    const rideMatch = url.match(/^\/api\/v1\/rides\/([^/?#]+)\/payment-intent$/);
    if (rideMatch && req.method === "GET") {
      const intent = await this.service.findByRide(rideMatch[1]);
      if (!intent) {
        writeJson(res, 404, { message: "payment intent not found" });
        return true;
      }
      writeJson(res, 200, intent);
      return true;
    }

    return false;
  }
}

function toCreateInput(body: any): CreatePaymentIntentInput {
  return {
    rideId: String(body.rideId ?? ""),
    userId: String(body.userId ?? ""),
    paymentMethodType: String(body.paymentMethodType ?? "") as PaymentMethodType,
    amountCentavos: Number(body.amountCentavos),
    paymentMethodId: body.paymentMethodId ?? null,
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
