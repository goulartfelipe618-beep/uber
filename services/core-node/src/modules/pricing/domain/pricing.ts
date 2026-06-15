export interface PricingQuoteRequest {
  categoryCode: string;
  distanceKm: number;
  durationMinutes: number;
  dynamicMultiplier?: number;
  trafficSurcharge?: number;
  airportFee?: number;
  tollEstimate?: number;
  addonsFee?: number;
  discounts?: number;
}

export interface PricingQuoteBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  trafficSurcharge: number;
  airportFee: number;
  tollEstimate: number;
  addonsFee: number;
  subtotal: number;
  minimumFareApplied: number;
  dynamicMultiplier: number;
  totalBeforeDiscount: number;
  discounts: number;
  total: number;
}

export interface PricingQuoteResult {
  categoryCode: string;
  currency: string;
  breakdown: PricingQuoteBreakdown;
}
