import type { SiteCalibration } from '../config';

export type CustomerIntent = {
  customerType: 'new' | 'recurrent' | 'heavy';
  willRecharge: boolean;
  intendedUsages: number;
  intendedSpend: number;
};

export function buildCustomerIntent(params: {
  calibration: SiteCalibration;
  demandIndex: number;
  rng: () => number;
  baseTicket: number;
  heavyGamerRate: number;
}): CustomerIntent {
  const { calibration, demandIndex, rng, baseTicket, heavyGamerRate } = params;
  const r = rng();
  const heavyThreshold = Math.min(0.45, heavyGamerRate + demandIndex * 0.02);
  const newThreshold = Math.min(0.85, heavyThreshold + calibration.newCustomerRate);
  const retainedThreshold = Math.min(1, newThreshold + calibration.retentionRate * 0.4);

  let customerType: CustomerIntent['customerType'];
  if (r <= heavyThreshold) {
    customerType = 'heavy';
  } else if (r <= newThreshold) {
    customerType = 'new';
  } else if (r <= retainedThreshold) {
    customerType = 'recurrent';
  } else {
    customerType = 'new';
  }

  const spendMultiplier =
    customerType === 'heavy'
      ? 1.8 + rng() * 0.7
      : customerType === 'recurrent'
        ? 0.95 + rng() * 0.5
        : 0.65 + rng() * 0.55;

  const usageBase = customerType === 'heavy' ? 8 : customerType === 'recurrent' ? 4 : 3;
  const intendedUsages = Math.max(1, Math.round(usageBase + rng() * usageBase));
  const intendedSpend = Math.max(3000, Math.round(baseTicket * spendMultiplier));
  const willRecharge = rng() < (customerType === 'new' ? 0.52 : customerType === 'heavy' ? 0.88 : 0.64);

  return {
    customerType,
    willRecharge,
    intendedUsages,
    intendedSpend,
  };
}
