-- CodigoReservado: evita reutilización histórica de códigos vendibles

CREATE TABLE "CodigoReservado" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "prefijo" TEXT NOT NULL,
  "consecutivo" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CodigoReservado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodigoReservado_siteId_codigo_key" ON "CodigoReservado"("siteId", "codigo");
CREATE UNIQUE INDEX "CodigoReservado_siteId_prefijo_consecutivo_key" ON "CodigoReservado"("siteId", "prefijo", "consecutivo");
CREATE INDEX "CodigoReservado_siteId_prefijo_consecutivo_idx" ON "CodigoReservado"("siteId", "prefijo", "consecutivo");

ALTER TABLE "CodigoReservado"
  ADD CONSTRAINT "CodigoReservado_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
