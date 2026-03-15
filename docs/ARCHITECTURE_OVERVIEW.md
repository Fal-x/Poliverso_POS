# Arquitectura Técnica

## Módulos principales
- `src/pages/*`: UI POS por rol (`cashier`, `supervisor`, `admin`).
- `src/api/client.ts`: cliente HTTP unificado al backend.
- `src/backend/api/server.ts`: bootstrap Fastify, CORS, Swagger, registro de rutas.
- `src/backend/api/routes/*`: endpoints por dominio (`sales`, `cash`, `cards`, `reports`, `admin`, `esp`).
- `src/backend/services/*`: lógica de negocio financiera (caja, recibos).
- `prisma/schema.prisma`: modelo de datos transaccional.

## Diagrama de módulos (alto nivel)
```text
Frontend React (POS)
  -> API Fastify (/api/v1)
    -> Servicios de dominio (cash/sales/cards/reports)
      -> Prisma Client
        -> PostgreSQL
  -> ESP readers (/api/v1/esp/* con token + firma HMAC)
```

## Flujos críticos
- Apertura/Cierre de caja: `cashSessionService` con cálculo de esperado, diferencias y aprobaciones.
- Venta/Recarga: escritura transaccional (`sale`, `saleLine`, `salePayment`, `auditLog`).
- Anulaciones: rutas con validación de motivo y aprobación de supervisor.
- Lectores físicos: verificación de token + firma + ventana temporal + idempotencia por `requestId`.

## Catálogo e Inventario Parametrizable
- Estructura modular: `Categoria` -> `Subcategoria` -> `ItemVendible` (producto o servicio).
- Operación sin desarrollo adicional: alta, edición, activación y desactivación por datos (`activo`).
- Clasificación contable/financiera: cada item queda asociado a su subcategoría para reportes.
- Regla de código para nuevos ítems: `CSS-00X`.
  - `C`: inicial de la categoría.
  - `SS`: dos primeras letras de la subcategoría.
  - `00X`: consecutivo de tres cifras por prefijo (histórico no reutilizable mediante `CodigoReservado`).
