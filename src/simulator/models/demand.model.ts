import type { SiteCalibration, SpecialEventWindow } from '../config';

export type DemandSnapshot = {
  expectedArrivals: number;
  hourlyPattern: number;
  weekendFactor: number;
  monthlySeasonality: number;
  trend: number;
  gaussianNoise: number;
  eventBoost: number;
  demandIndex: number;
};

function hourWeight(hour: number): number {
  if (hour >= 18 && hour <= 22) return 2.45;
  if (hour >= 15 && hour < 18) return 1.55;
  if (hour >= 12 && hour < 15) return 1.15;
  if (hour >= 10 && hour < 12) return 0.92;
  if (hour >= 22 || hour < 8) return 0.28;
  return 0.6;
}

function monthSeasonality(monthZeroIndexed: number): number {
  const month = monthZeroIndexed + 1;
  if ([12, 1, 6, 7].includes(month)) return 1.2;
  if ([3, 4, 5, 8].includes(month)) return 1.03;
  return 0.95;
}

function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function computeEventBoost(at: Date, events: SpecialEventWindow[]): number {
  const ts = at.getTime();
  let boost = 1;
  for (const event of events) {
    const from = new Date(event.startsAtIso).getTime();
    const to = new Date(event.endsAtIso).getTime();
    if (ts >= from && ts <= to) {
      boost *= Math.max(1, event.demandMultiplier);
    }
  }
  return boost;
}

export function computeDemand(params: {
  at: Date;
  calibration: SiteCalibration;
  trend: number;
  rng: () => number;
  events: SpecialEventWindow[];
}): DemandSnapshot {
  const { at, calibration, trend, rng, events } = params;
  const hour = at.getHours();
  const day = at.getDay();
  const weekendFactor = day === 0 || day === 6 ? 1.4 : 1;
  const hourlyPattern = hourWeight(hour);
  const monthlySeasonality = monthSeasonality(at.getMonth());
  const eventBoost = computeEventBoost(at, events);
  const gaussianNoise = gaussian(rng) * 0.06;

  const demandIndex = Math.max(
    0.08,
    trend * hourlyPattern * weekendFactor * monthlySeasonality * eventBoost + gaussianNoise,
  );

  const areaFactor = Math.max(0.4, calibration.areaM2 / 250);
  const arrivals = Math.max(0, Math.round(demandIndex * areaFactor * 2.2));

  return {
    expectedArrivals: arrivals,
    hourlyPattern,
    weekendFactor,
    monthlySeasonality,
    trend,
    gaussianNoise,
    eventBoost,
    demandIndex,
  };
}
