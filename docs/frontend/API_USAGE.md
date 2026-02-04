# Guía de Consumo de APIs

## Cliente estándar
- Usar `src/api/client.ts`.
- Respuesta esperada: `{ success, data, meta }`.

## Manejo de errores
- Mostrar mensaje operativo, no técnico.
- Evitar suposiciones locales si el backend falla.

## Operaciones críticas
- Apertura/cierre de caja: backend confirma y UI refresca.
- Venta: solo finalizar cuando backend confirma.
- Recarga: validar backend y refrescar saldo.
- Autorizaciones: siempre con PIN supervisor.

## Patrones
- POST para mutaciones.
- GET para lectura con filtros por `site_id`.

## Ejemplos
### Abrir caja
POST `/cash-sessions/open`

### Cerrar caja
POST `/cash-sessions/{id}/close`

### Venta
POST `/sales`

### Recarga
POST `/cards/{uid}/recharge`
