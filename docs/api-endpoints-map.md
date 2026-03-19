# API Endpoints Map

Mapa funcional de la API de POLIVERSO POS. Este documento describe qué hace cada endpoint a nivel operativo.

Base URL:

```text
/api/v1
```

Notas:
- `Auth` indica el rol mínimo requerido según el middleware del backend.
- Para payloads y detalles de respuesta, complementar con `docs/api.md` y `docs/openapi.yaml`.
- `Source` indica el archivo donde vive la ruta.

## Health

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/health` | pública | Healthcheck simple del backend. | `src/backend/api/server.ts` |

## Auth

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/auth/login` | pública | Inicia sesión y emite token/refresh token. | `src/backend/api/routes/auth.ts` |
| `POST` | `/auth/refresh` | pública | Renueva la sesión usando refresh token. | `src/backend/api/routes/auth.ts` |
| `POST` | `/auth/logout` | pública | Invalida o cierra la sesión actual. | `src/backend/api/routes/auth.ts` |
| `GET` | `/auth/users` | pública | Lista usuarios disponibles para flujo de login del POS. | `src/backend/api/routes/users.ts` |

## Usuarios operativos

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/users` | `supervisor` | Lista usuarios operativos por sede/contexto. | `src/backend/api/routes/users.ts` |

## Catálogo y contexto POS

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/sites` | pública | Devuelve las sedes disponibles. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/pos/context` | `cashier` | Devuelve contexto operativo del POS para una sede. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/products` | `cashier` | Lista productos vendibles activos. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/bonus-scales` | `cashier` | Devuelve escalas o reglas de bonificación para recargas. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/site-config` | `cashier` | Devuelve configuración operativa de la sede. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/attractions` | `cashier` | Lista atracciones/máquinas disponibles para el POS. | `src/backend/api/routes/catalog.ts` |
| `GET` | `/inventory/prizes` | `supervisor` | Lista premios disponibles en inventario. | `src/backend/api/routes/catalog.ts` |

## Caja

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/cash-sessions/open/reference` | `cashier` | Devuelve referencia para apertura de caja. | `src/backend/api/routes/cash.ts` |
| `GET` | `/cash-sessions/:id` | `cashier` | Consulta detalle de una sesión de caja. | `src/backend/api/routes/cash.ts` |
| `POST` | `/cash-sessions/open` | `cashier` | Abre una nueva sesión de caja. | `src/backend/api/routes/cash.ts` |
| `POST` | `/cash-sessions/:id/movements` | `cashier` | Registra movimientos de caja como retiros o ajustes. | `src/backend/api/routes/cash.ts` |
| `POST` | `/cash-sessions/:id/movements/:movementId/void` | `supervisor` | Anula un movimiento de caja previamente registrado. | `src/backend/api/routes/cash.ts` |
| `POST` | `/cash-sessions/:id/close` | `cashier` | Cierra una sesión de caja y ejecuta conciliación. | `src/backend/api/routes/cash.ts` |

## Aprobaciones

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/supervisor-approvals` | autenticado | Registra una aprobación de supervisor para una operación sensible. | `src/backend/api/routes/approvals.ts` |

## Ventas

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/sales` | `supervisor` | Lista ventas por filtros de sede. | `src/backend/api/routes/sales.ts` |
| `GET` | `/sales/recent` | `cashier` | Lista ventas recientes del cajero para una fecha. | `src/backend/api/routes/sales.ts` |
| `PATCH` | `/sales/:id/metadata` | `cashier` | Actualiza metadata operativa de una venta. | `src/backend/api/routes/sales.ts` |
| `GET` | `/sales/:id/receipt.pdf` | `cashier` | Genera o descarga el recibo PDF de una venta. | `src/backend/api/routes/sales.ts` |
| `POST` | `/sales` | `cashier` | Crea una venta completa con líneas, pagos y efectos contables. | `src/backend/api/routes/sales.ts` |
| `POST` | `/sales/:id/void` | autenticado | Anula una venta; normalmente requiere validaciones/aprobaciones. | `src/backend/api/routes/sales.ts` |
| `PATCH` | `/sales/:id/electronic-invoice` | `supervisor` | Actualiza datos de factura electrónica asociados a la venta. | `src/backend/api/routes/sales.ts` |

## Tarjetas

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/cards/reader/uid` | pública | Recibe el último UID leído por una lectora del POS. | `src/backend/api/routes/cards.ts` |
| `GET` | `/cards/reader/wait-uid` | `cashier` | Espera o consulta el UID más reciente leído para una sede. | `src/backend/api/routes/cards.ts` |
| `POST` | `/cards` | `cashier` | Emite/crea una tarjeta nueva. | `src/backend/api/routes/cards.ts` |
| `POST` | `/cards/read` | `cashier` | Lee/consulta información de una tarjeta a partir del UID. | `src/backend/api/routes/cards.ts` |
| `GET` | `/cards/by-owner` | `cashier` | Busca tarjetas asociadas a un titular. | `src/backend/api/routes/cards.ts` |
| `GET` | `/cards/:uid` | `cashier` | Devuelve detalle de una tarjeta. | `src/backend/api/routes/cards.ts` |
| `GET` | `/cards/:uid/status-history` | `supervisor` | Devuelve historial de estados de una tarjeta. | `src/backend/api/routes/cards.ts` |
| `POST` | `/cards/:uid/status` | `supervisor` | Cambia el estado de una tarjeta. | `src/backend/api/routes/cards.ts` |
| `POST` | `/cards/:uid/migrate-balance` | `cashier` | Migra saldo de una tarjeta origen a una tarjeta destino. | `src/backend/api/routes/cards.ts` |
| `POST` | `/cards/:uid/recharge` | `cashier` | Recarga saldo o crédito en una tarjeta. | `src/backend/api/routes/cards.ts` |

## Premios y puntos

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/prizes/card-summary` | `cashier` | Resume saldo/puntos y actividad de premios para una tarjeta. | `src/backend/api/routes/prizes.ts` |
| `GET` | `/prizes/points-ledger` | `cashier` | Devuelve el ledger de puntos de una tarjeta o cliente. | `src/backend/api/routes/prizes.ts` |
| `GET` | `/prizes` | `cashier` | Lista premios disponibles para redención. | `src/backend/api/routes/prizes.ts` |
| `POST` | `/prizes/redeem` | `cashier` | Redime un premio usando puntos y descuenta inventario. | `src/backend/api/routes/prizes.ts` |
| `POST` | `/prizes/points-adjust` | `supervisor` | Ajusta manualmente puntos. | `src/backend/api/routes/prizes.ts` |
| `POST` | `/prizes/redemptions/:id/reverse` | `supervisor` | Revierte una redención de premio. | `src/backend/api/routes/prizes.ts` |
| `GET` | `/prizes/inventory/kardex` | `supervisor` | Consulta kardex del inventario de premios. | `src/backend/api/routes/prizes.ts` |
| `GET` | `/prizes/reports` | `supervisor` | Devuelve reportes operativos de premios. | `src/backend/api/routes/prizes.ts` |

## Programas

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/programs/students` | `supervisor` | Crea un estudiante/cliente de programas. | `src/backend/api/routes/programs.ts` |
| `GET` | `/programs/students` | `cashier` | Lista estudiantes de programas. | `src/backend/api/routes/programs.ts` |
| `POST` | `/programs/enrollments` | `supervisor` | Crea una inscripción a programa. | `src/backend/api/routes/programs.ts` |
| `GET` | `/programs/students/:id/enrollments` | `cashier` | Lista inscripciones de un estudiante. | `src/backend/api/routes/programs.ts` |
| `GET` | `/programs/enrollments/:id` | `cashier` | Devuelve detalle de una inscripción. | `src/backend/api/routes/programs.ts` |
| `POST` | `/programs/enrollments/:id/payments` | `cashier` | Registra pagos parciales o completos de una inscripción. | `src/backend/api/routes/programs.ts` |
| `GET` | `/programs/portfolio` | `supervisor` | Devuelve cartera o saldos pendientes de programas. | `src/backend/api/routes/programs.ts` |

## Eventos

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/events/base-plans` | `supervisor` | Crea un plan base para eventos. | `src/backend/api/routes/events.ts` |
| `GET` | `/events/base-plans` | `cashier` | Lista planes base de eventos. | `src/backend/api/routes/events.ts` |
| `POST` | `/events/bookings` | `cashier` | Crea una reserva o booking de evento. | `src/backend/api/routes/events.ts` |
| `GET` | `/events/bookings/:id` | `cashier` | Consulta detalle de una reserva. | `src/backend/api/routes/events.ts` |
| `POST` | `/events/bookings/:id/payments` | `cashier` | Registra pagos sobre una reserva. | `src/backend/api/routes/events.ts` |
| `GET` | `/events/calendar` | `cashier` | Devuelve el calendario de eventos agendados. | `src/backend/api/routes/events.ts` |

## Reportes

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/reports/dashboard/summary` | `supervisor` | Resumen general para dashboard. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/dashboard/pending` | `supervisor` | Pendientes operativos del dashboard. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/dashboard/movements` | `supervisor` | Movimientos para dashboard. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/dashboard/movements/export` | `supervisor` | Exporta movimientos del dashboard. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/dashboard/inventory` | `supervisor` | Resumen de inventario para dashboard. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/day/summary` | `cashier` | Resumen diario de ventas/operación. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/day/payment-breakdown` | `supervisor` | Desglose diario por medio de pago. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/day/type-breakdown` | `supervisor` | Desglose diario por categoría o tipo de venta. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/day/movements` | `supervisor` | Lista movimientos diarios. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/day/station-usage` | `supervisor` | Uso diario por estación/máquina. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/revenue-by-category` | `supervisor` | Reporte crítico de ingresos por categoría. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/machine-usage` | `supervisor` | Reporte crítico de uso de máquinas. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/points` | `supervisor` | Reporte crítico de puntos. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/program-portfolio` | `supervisor` | Reporte crítico de cartera de programas. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/inventory` | `supervisor` | Reporte crítico de inventario. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/critical/promotion-usage` | `supervisor` | Reporte crítico de promociones. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/admin/executive` | `supervisor` | Métricas ejecutivas avanzadas para supervisión/gerencia. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/dashboard/executive.pdf` | `admin` | Exporta el dashboard ejecutivo a PDF. | `src/backend/api/routes/reports.ts` |
| `GET` | `/reports/daily` | `supervisor` | Exporta reporte diario consolidado, usualmente PDF. | `src/backend/api/routes/reports.ts` |

## Administración

### Productos

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/products` | `admin` | Lista productos administrables. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/products` | `admin` | Crea un producto nuevo. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/products/:id` | `admin` | Actualiza un producto existente. | `src/backend/api/routes/admin.ts` |
| `DELETE` | `/admin/products/:id` | `admin` | Desactiva o elimina lógicamente un producto. | `src/backend/api/routes/admin.ts` |

### Tarjetas administrativas

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/cards/lookup` | `admin` | Busca una tarjeta y su historial administrativo ampliado. | `src/backend/api/routes/admin.ts` |

### Inventario

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/inventory/items` | `admin` | Lista ítems de inventario administrables. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/inventory/items` | `admin` | Crea un ítem de inventario. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/inventory/movements` | `supervisor` | Registra un movimiento de inventario. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/inventory/movements/register` | `supervisor` | Registra inventario con flujo operacional guiado. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/inventory/kardex` | `admin` | Consulta el kardex completo de inventario. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/inventory/report` | `admin` | Devuelve reporte consolidado de inventario. | `src/backend/api/routes/admin.ts` |

### Catálogo jerárquico

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/catalog/categories` | `admin` | Lista categorías del catálogo. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/catalog/categories` | `admin` | Crea una categoría del catálogo. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/catalog/subcategories` | `admin` | Lista subcategorías del catálogo. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/catalog/subcategories` | `admin` | Crea una subcategoría. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/catalog/items` | `admin` | Lista ítems del catálogo modular. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/catalog/items` | `admin` | Crea un ítem del catálogo modular. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/catalog/items/:id` | `admin` | Actualiza un ítem del catálogo modular. | `src/backend/api/routes/admin.ts` |

### Promociones

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/promotions` | `admin` | Lista promociones configuradas. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/promotions` | `admin` | Crea una promoción. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/promotions/:id` | `admin` | Actualiza una promoción. | `src/backend/api/routes/admin.ts` |

### Configuración de sede

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/site-config` | `admin` | Consulta configuración administrativa de la sede. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/site-config` | `admin` | Actualiza configuración administrativa de la sede. | `src/backend/api/routes/admin.ts` |

### Estaciones y lectoras

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/stations` | `supervisor` | Lista máquinas/estaciones con lectoras y uso del día. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/readers/status` | `supervisor` | Devuelve estado operativo de cada lectora: online, offline o con problema. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/stations` | `admin` | Crea una estación o máquina. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/stations/:id` | `admin` | Actualiza una estación o lectora primaria asociada. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/stations/:id/maintenance` | `supervisor` | Activa o desactiva mantenimiento de una estación. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/stations/simulate-use` | `admin` | Simula uso de una estación para pruebas. | `src/backend/api/routes/admin.ts` |

### Usuarios y auditoría

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/admin/users` | `admin` | Lista usuarios administrables. | `src/backend/api/routes/admin.ts` |
| `POST` | `/admin/users` | `admin` | Crea un usuario. | `src/backend/api/routes/admin.ts` |
| `PATCH` | `/admin/users/:id` | `admin` | Actualiza un usuario. | `src/backend/api/routes/admin.ts` |
| `DELETE` | `/admin/users/:id` | `admin` | Desactiva o elimina un usuario. | `src/backend/api/routes/admin.ts` |
| `GET` | `/audit-logs` | `admin` | Consulta logs de auditoría. | `src/backend/api/routes/admin.ts` |
| `GET` | `/admin/esp-logs` | `admin` | Consulta logs de operaciones ESP/lectoras. | `src/backend/api/routes/admin.ts` |

## ESP / lectoras

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `POST` | `/esp/usage` | pública con headers ESP | Endpoint canónico simplificado: registra una lectura y cuenta el uso de la máquina asociada a la lectora. | `src/backend/api/routes/esp.ts` |
| `POST` | `/reader/validate` | pública con headers ESP | Valida una tarjeta desde una lectora y puede autorizar uso. | `src/backend/api/routes/esp.ts` |
| `GET` | `/esp/cards/:uid` | pública con headers ESP | Consulta saldo y estado de una tarjeta desde firmware ESP. | `src/backend/api/routes/esp.ts` |
| `GET` | `/esp/activities/:activityId` | pública con headers ESP | Consulta configuración y estado de una actividad/máquina. | `src/backend/api/routes/esp.ts` |
| `POST` | `/esp/activities/validate-and-use` | pública con headers ESP | Ruta legacy de uso; puede operar sin `activityId` y delega al flujo simplificado. | `src/backend/api/routes/esp.ts` |

## Notificaciones

| Method | Path | Auth | Qué hace | Source |
|---|---|---:|---|---|
| `GET` | `/notifications/stream` | depende del token del stream | Abre stream de notificaciones en tiempo real por sede. | `src/backend/api/routes/notifications.ts` |

## Comentarios operativos

- Los endpoints públicos de ESP no son abiertos en la práctica: dependen de `x-reader-id`, `x-api-token` y `x-signature`.
- El prefijo real de producción es `/api/v1`, excepto `/health`.
- La mayoría de endpoints administrativos viven en [admin.ts](/Users/fabianalexanderredondodiaz/Poliverso_POS/src/backend/api/routes/admin.ts), que concentra mucho dominio; si ese archivo sigue creciendo, conviene dividirlo por módulos.
- Para contratos exactos de request/response, usar también:
  - [docs/api.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/api.md)
  - [docs/openapi.yaml](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/openapi.yaml)
