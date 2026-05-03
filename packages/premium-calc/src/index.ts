export const TROY_OZ_GRAMS = 31.1034768;

export interface ComputePremiumInput {
  spotUsdPerOz: number;
  dealerPriceUsd: number;
  weightTroyOz: number;
  purity: number;
  quantity?: number;
}

export interface ComputePremiumResult {
  premiumPerOz: number;
  premiumPct: number;
  pricePerGramPure: number;
  pricePerOzPure: number;
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${value}`);
  }
  if (value <= 0) {
    throw new RangeError(`${name} must be > 0, got ${value}`);
  }
}

export function computePremium(input: ComputePremiumInput): ComputePremiumResult {
  const { spotUsdPerOz, dealerPriceUsd, weightTroyOz, purity, quantity = 1 } = input;

  assertFinitePositive('spotUsdPerOz', spotUsdPerOz);
  assertFinitePositive('dealerPriceUsd', dealerPriceUsd);
  assertFinitePositive('weightTroyOz', weightTroyOz);
  assertFinitePositive('quantity', quantity);

  if (!Number.isFinite(purity)) {
    throw new RangeError(`purity must be a finite number in (0, 1], got ${purity}`);
  }
  if (purity <= 0 || purity > 1) {
    throw new RangeError(`purity must be in (0, 1], got ${purity}`);
  }

  const totalPureOz = weightTroyOz * purity * quantity;
  const pricePerOzPure = dealerPriceUsd / totalPureOz;
  const pricePerGramPure = pricePerOzPure / TROY_OZ_GRAMS;
  const premiumPerOz = pricePerOzPure - spotUsdPerOz;
  const premiumPct = (premiumPerOz / spotUsdPerOz) * 100;

  return {
    premiumPerOz,
    premiumPct,
    pricePerGramPure,
    pricePerOzPure,
  };
}
