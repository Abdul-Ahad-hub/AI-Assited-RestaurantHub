/**
 * Bidding rules (single source of truth).
 *
 * Bids are not fixed to a flat step. The required raise scales with the current
 * leading bid so early bids can be a few cents and the step grows gradually:
 *   step = max(campaign floor, 5% of the current leading bid, rounded up to a cent)
 */
export const DEFAULT_OPENING_BID = 0.1;
export const DEFAULT_STEP_FLOOR = 0.01;
export const STEP_PERCENT = 5;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getBidStep(currentLeadingBid: number, stepFloor = DEFAULT_STEP_FLOOR): number {
  const floor = stepFloor > 0 ? stepFloor : DEFAULT_STEP_FLOOR;
  const proportional = Math.ceil(currentLeadingBid * STEP_PERCENT) / 100;
  return roundMoney(Math.max(floor, proportional));
}

export function getMinNextBid(
  currentLeadingBid: number,
  opts: { openingBid?: number; stepFloor?: number } = {}
): number {
  const opening = opts.openingBid && opts.openingBid > 0 ? opts.openingBid : DEFAULT_OPENING_BID;
  if (currentLeadingBid <= 0) return roundMoney(opening);
  return roundMoney(currentLeadingBid + getBidStep(currentLeadingBid, opts.stepFloor));
}
