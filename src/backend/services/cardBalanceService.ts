import { Prisma } from '@prisma/client';

type AppendCardBalanceEventParams = {
  tx: Prisma.TransactionClient;
  cardId: string;
  siteId: string;
  ledgerEventId?: string | null;
  moneyDelta: Prisma.Decimal | number | string;
  pointsDelta: number;
  reason: string;
  reversalOfId?: string | null;
  updateCardBalances?: boolean;
};

export async function appendCardBalanceEvent(params: AppendCardBalanceEventParams) {
  const {
    tx,
    cardId,
    siteId,
    ledgerEventId = null,
    moneyDelta,
    pointsDelta,
    reason,
    reversalOfId = null,
    updateCardBalances = true,
  } = params;

  const money = new Prisma.Decimal(moneyDelta);
  await tx.cardBalanceEvent.create({
    data: {
      cardId,
      siteId,
      ledgerEventId,
      moneyDelta: money,
      pointsDelta,
      reason,
      reversalOfId,
    },
  });

  if (updateCardBalances) {
    await tx.card.update({
      where: { id: cardId },
      data: {
        creditBalance: { increment: money },
        pointsBalance: { increment: pointsDelta },
      },
    });
  }
}
