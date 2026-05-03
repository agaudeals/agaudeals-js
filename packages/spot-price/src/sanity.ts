export const SANITY_BAND = 0.2;

export function isWithinSanityBand(
  candidate: number,
  reference: number,
  band: number = SANITY_BAND,
): boolean {
  if (!Number.isFinite(candidate) || candidate <= 0) return false;
  if (!Number.isFinite(reference) || reference <= 0) return true;
  const ratio = candidate / reference;
  return ratio >= 1 - band && ratio <= 1 + band;
}
