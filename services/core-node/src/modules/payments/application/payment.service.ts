import { CreatePaymentIntentInput, PaymentIntent, PaymentMethodType, PaymentRepository } from "../domain/payment";

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  public createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    return this.repository.createIntent({
      rideId: requireText(input.rideId, "rideId"),
      userId: requireText(input.userId, "userId"),
      paymentMethodType: normalizeMethod(input.paymentMethodType),
      amountCentavos: requirePositiveInt(input.amountCentavos, "amountCentavos"),
      paymentMethodId: input.paymentMethodId ?? null,
    });
  }

  public findByRide(rideId: string): Promise<PaymentIntent | null> {
    if (!rideId) {
      throw new Error("rideId is required");
    }
    return this.repository.findByRide(rideId);
  }

  public authorize(intentId: string): Promise<PaymentIntent> {
    if (!intentId) {
      throw new Error("intentId is required");
    }
    return this.repository.authorize(intentId);
  }

  public capture(intentId: string): Promise<PaymentIntent> {
    if (!intentId) {
      throw new Error("intentId is required");
    }
    return this.repository.capture(intentId);
  }
}

function normalizeMethod(value: PaymentMethodType): PaymentMethodType {
  const allowed = ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH"];
  if (!allowed.includes(value)) {
    throw new Error("paymentMethodType is invalid");
  }
  return value;
}

function requireText(value: string, field: string): string {
  const text = (value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function requirePositiveInt(value: number, field: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return num;
}
