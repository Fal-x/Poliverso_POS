import { Prisma, type Promotion } from '@prisma/client';
import { prisma } from '@/backend/prisma';

type RechargePromotionResult = {
  promotion: Promotion;
  additionalCredit: Prisma.Decimal;
  visualLabel: string;
};

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function isDateInWindow(reference: Date, startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && reference < startsAt) return false;
  if (endsAt && reference > endsAt) return false;
  return true;
}

function isDayAllowed(reference: Date, dayRestrictions: unknown) {
  const days = asNumberArray(dayRestrictions);
  if (days.length === 0) return true;
  return days.includes(reference.getDay());
}

/**
 * RECA rules:
 * - only exact configured amounts (non-proportional)
 * - additional credit is separated from base recharge
 */
export async function evaluateRechargePromotion(params: {
  siteId: string;
  amount: Prisma.Decimal;
  promotionCode?: string | null;
  now?: Date;
}) {
  const { siteId, amount, promotionCode } = params;
  const now = params.now ?? new Date();
  const code = (promotionCode ?? '').trim().toUpperCase();
  if (!code) return null;

  const promotion = await prisma.promotion.findFirst({
    where: {
      siteId,
      code,
      scope: 'RECHARGE',
      isActive: true,
      type: 'RECHARGE_ADDITIONAL',
    },
  });
  if (!promotion) return null;
  if (!isDateInWindow(now, promotion.startsAt, promotion.endsAt)) return null;
  if (!isDayAllowed(now, promotion.dayRestrictions)) return null;

  const exactValues = asNumberArray(promotion.exactValues);
  const amountNumber = Number(amount.toFixed(2));
  if (exactValues.length === 0 || !exactValues.includes(amountNumber)) return null;

  const additionalCredit = promotion.fixedValue ?? new Prisma.Decimal(0);
  if (additionalCredit.lte(0)) return null;

  const result: RechargePromotionResult = {
    promotion,
    additionalCredit,
    visualLabel: `${promotion.code} (+${additionalCredit.toFixed(2)})`,
  };
  return result;
}
