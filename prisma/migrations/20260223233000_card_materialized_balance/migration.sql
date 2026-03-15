ALTER TABLE "Card"
  ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pointsBalance" INTEGER NOT NULL DEFAULT 0;

WITH agg AS (
  SELECT
    "cardId",
    COALESCE(SUM("moneyDelta"), 0)::DECIMAL(18,2) AS credit,
    COALESCE(SUM("pointsDelta"), 0)::INTEGER AS points
  FROM "CardBalanceEvent"
  GROUP BY "cardId"
)
UPDATE "Card" c
SET
  "creditBalance" = agg.credit,
  "pointsBalance" = agg.points
FROM agg
WHERE c."id" = agg."cardId";
