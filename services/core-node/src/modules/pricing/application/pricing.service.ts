import { CategoryRepository } from "../../categories/domain/category.repository";
import { PricingQuoteRequest, PricingQuoteResult } from "../domain/pricing";

export class PricingService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  public async quote(request: PricingQuoteRequest): Promise<PricingQuoteResult> {
    const categoryCode = normalizeCode(request.categoryCode);
    const distanceKm = requireNonNegativeNumber(request.distanceKm, "distanceKm");
    const durationMinutes = requireNonNegativeNumber(request.durationMinutes, "durationMinutes");

    const dynamicMultiplierRaw = request.dynamicMultiplier ?? 1;
    const dynamicMultiplier = clamp(dynamicMultiplierRaw, 1, 10);

    const trafficSurcharge = requireNonNegativeNumber(request.trafficSurcharge ?? 0, "trafficSurcharge");
    const airportFee = requireNonNegativeNumber(request.airportFee ?? 0, "airportFee");
    const tollEstimate = requireNonNegativeNumber(request.tollEstimate ?? 0, "tollEstimate");
    const addonsFee = requireNonNegativeNumber(request.addonsFee ?? 0, "addonsFee");
    const discounts = requireNonNegativeNumber(request.discounts ?? 0, "discounts");

    const category = await this.categoryRepository.findByCode(categoryCode);
    if (!category || category.deletedAt !== null || !category.active) {
      throw new Error("category not found");
    }

    const baseFare = category.baseFare;
    const distanceFare = distanceKm * category.pricePerKm;
    const timeFare = durationMinutes * category.pricePerMinute;

    const subtotal = baseFare + distanceFare + timeFare + trafficSurcharge + airportFee + tollEstimate + addonsFee;
    const minimumFareApplied = Math.max(subtotal, category.minimumFare);
    const totalBeforeDiscount = minimumFareApplied * dynamicMultiplier;
    const total = clamp(totalBeforeDiscount - discounts, 0, Number.MAX_SAFE_INTEGER);

    return {
      categoryCode,
      currency: "BRL",
      breakdown: {
        baseFare,
        distanceFare,
        timeFare,
        trafficSurcharge,
        airportFee,
        tollEstimate,
        addonsFee,
        subtotal,
        minimumFareApplied,
        dynamicMultiplier,
        totalBeforeDiscount,
        discounts,
        total,
      },
    };
  }
}

function normalizeCode(value: string): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!code) {
    throw new Error("categoryCode is required");
  }
  return code;
}

function requireNonNegativeNumber(value: number, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field} must be a number`);
  }
  if (num < 0) {
    throw new Error(`${field} must be >= 0`);
  }
  return num;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}
