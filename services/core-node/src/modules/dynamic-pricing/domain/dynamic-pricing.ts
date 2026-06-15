export interface DynamicPricingInput {
  regionId?: string;
  categoryCode: string;
  demandPressure?: number;
  weatherPressure?: number;
  eventPressure?: number;
  airportPressure?: number;
  trafficPressure?: number;
  supplyShortage?: number;
  timePressure?: number;
  conversionPressure?: number;
  previousMultiplier?: number;
}

export interface DynamicPricingResult {
  categoryCode: string;
  multiplierRaw: number;
  multiplierEffective: number;
  dynamicCap: number;
  factors: {
    demandPressure: number;
    weatherPressure: number;
    eventPressure: number;
    airportPressure: number;
    trafficPressure: number;
    supplyShortage: number;
    timePressure: number;
    conversionPressure: number;
  };
}
