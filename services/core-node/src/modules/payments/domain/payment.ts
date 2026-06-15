export type PaymentMethodType = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH";

export interface CreatePaymentIntentInput {
  rideId: string;
  userId: string;
  paymentMethodType: PaymentMethodType;
  amountCentavos: number;
  paymentMethodId?: string | null;
}

export interface PaymentIntent {
  id: string;
  rideId: string;
  userId: string;
  paymentMethodType: PaymentMethodType;
  status: string;
  amountAuthorizedCentavos: number;
  currency: string;
  createdAt: string;
}

export interface PaymentRepository {
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent>;
  findByRide(rideId: string): Promise<PaymentIntent | null>;
  authorize(intentId: string): Promise<PaymentIntent>;
  capture(intentId: string): Promise<PaymentIntent>;
}
