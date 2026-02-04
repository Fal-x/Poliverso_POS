# POLIVERSE POS API v1

Base URL: `http://localhost:3001/api/v1`

## Convención de respuesta

Success:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-01-31T00:00:00Z",
    "requestId": "uuid"
  }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "DOMAIN_ERROR_CODE",
    "message": "Mensaje claro para frontend"
  }
}
```

## Auth
- POST `/auth/login` (CAJERO+): login con código 6 dígitos
- POST `/auth/refresh` (PUBLIC): renueva access token
- POST `/auth/logout` (PUBLIC): revoca refresh token
- GET `/auth/users` (CAJERO+): lista usuarios para login

## Caja
- POST `/cash-sessions/open` (CAJERO+): apertura
- POST `/cash-sessions/{id}/movements` (CAJERO+ + aprobación): retiros/ajustes
- POST `/cash-sessions/{id}/close` (CAJERO+ + aprobación si hay diferencia): cierre
- GET `/cash-sessions/{id}` (CAJERO+): resumen de caja

## Ventas
- POST `/sales` (CAJERO+): crear venta con items, pagos y customer_id (o defaultCustomerId)

## Aprobaciones
- POST `/supervisor-approvals` (CAJERO+): crear autorización con PIN de supervisor

## Tarjetas
- POST `/cards` (CAJERO+): crear tarjeta
- GET `/cards/{uid}` (CAJERO+): consulta tarjeta
- POST `/cards/{uid}/recharge` (CAJERO+): recargar tarjeta (customer_id opcional)

## Inventario / Premios / Atracciones / Reportes
Implementación base reservada. Ver `docs/openapi.yaml`.
