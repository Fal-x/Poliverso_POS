-- Unified sellable catalog: Categoria / Subcategoria / ItemVendible

CREATE TYPE "TipoOperacionVendible" AS ENUM ('PRODUCTO', 'SERVICIO', 'USO', 'PROGRAMA', 'EVENTO');

CREATE TABLE "Categoria" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "codigo" TEXT,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subcategoria" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "codigo" TEXT,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subcategoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemVendible" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "subcategoriaId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipoOperacion" "TipoOperacionVendible" NOT NULL,
  "tieneInventario" BOOLEAN NOT NULL DEFAULT false,
  "usaSaldoElectronico" BOOLEAN NOT NULL DEFAULT false,
  "usaPuntos" BOOLEAN NOT NULL DEFAULT false,
  "precioBase" DECIMAL(18,2) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemVendible_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Categoria_siteId_nombre_key" ON "Categoria"("siteId", "nombre");
CREATE UNIQUE INDEX "Categoria_siteId_codigo_key" ON "Categoria"("siteId", "codigo");
CREATE INDEX "Categoria_siteId_activo_idx" ON "Categoria"("siteId", "activo");

CREATE UNIQUE INDEX "Subcategoria_siteId_categoriaId_nombre_key" ON "Subcategoria"("siteId", "categoriaId", "nombre");
CREATE UNIQUE INDEX "Subcategoria_siteId_codigo_key" ON "Subcategoria"("siteId", "codigo");
CREATE INDEX "Subcategoria_siteId_categoriaId_activo_idx" ON "Subcategoria"("siteId", "categoriaId", "activo");

CREATE UNIQUE INDEX "ItemVendible_siteId_codigo_key" ON "ItemVendible"("siteId", "codigo");
CREATE INDEX "ItemVendible_siteId_categoriaId_subcategoriaId_activo_idx" ON "ItemVendible"("siteId", "categoriaId", "subcategoriaId", "activo");

ALTER TABLE "Categoria"
  ADD CONSTRAINT "Categoria_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subcategoria"
  ADD CONSTRAINT "Subcategoria_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subcategoria"
  ADD CONSTRAINT "Subcategoria_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemVendible"
  ADD CONSTRAINT "ItemVendible_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemVendible"
  ADD CONSTRAINT "ItemVendible_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemVendible"
  ADD CONSTRAINT "ItemVendible_subcategoriaId_fkey"
  FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
