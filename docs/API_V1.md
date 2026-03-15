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
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/users`

## Caja
- GET `/cash-sessions/open/reference`
- POST `/cash-sessions/open`
- GET `/cash-sessions/{id}`
- POST `/cash-sessions/{id}/movements`
- POST `/cash-sessions/{id}/movements/{movementId}/void`
- POST `/cash-sessions/{id}/close`

## Ventas
- GET `/sales`
- GET `/sales/recent`
- POST `/sales`
- POST `/sales/{id}/void`

## Aprobaciones
- POST `/supervisor-approvals`

## Tarjetas
- POST `/cards`
- GET `/cards/{uid}`
- POST `/cards/{uid}/recharge`

## Catálogo y Contexto POS
- GET `/sites`
- GET `/pos/context`
- GET `/products`
- GET `/bonus-scales`
- GET `/site-config`
- GET `/attractions`
- GET `/inventory/prizes`

## Reportes
- GET `/reports/day/summary`
- GET `/reports/day/payment-breakdown`
- GET `/reports/day/type-breakdown`
- GET `/reports/day/movements`
- GET `/reports/daily` (PDF)

## Administración
- GET `/admin/products`
- PATCH `/admin/products/{id}`
- GET `/admin/site-config`
- PATCH `/admin/site-config`
- GET `/admin/stations`
- PATCH `/admin/stations/{id}`
- POST `/admin/stations/{id}/maintenance`
- POST `/admin/stations/simulate-use`
- GET `/admin/users`
- POST `/admin/users`
- PATCH `/admin/users/{id}`
- DELETE `/admin/users/{id}`
- GET `/audit-logs`
- GET `/admin/esp-logs`

## Integración ESP
- POST `/reader/validate`
- GET `/esp/cards/{uid}`
- GET `/esp/activities/{activityId}`
- POST `/esp/activities/validate-and-use`

Headers obligatorios en **todas** las llamadas ESP:
- `x-reader-id`
- `x-api-token`
- `x-signature`

Firma requerida:
- `x-signature = Base64(HMAC_SHA256( SHA256(payload_json), hmacSecretDelReader ))`
- Para `GET`, usar payload vacío (`""`), por lo tanto `SHA256("")`.

## Flujo lectoras / máquinas
- Configuración administrativa: ver [docs/ESP_READERS.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/ESP_READERS.md)
- `GET /admin/stations` ahora devuelve `maintenance_mode` y `maintenance_message`.
- `POST /admin/stations/{id}/maintenance` permite activar o quitar mantenimiento desde supervisor/admin.
- Cuando una máquina está en mantenimiento, las rutas `POST /reader/validate` y `POST /esp/activities/validate-and-use` responden `allowed: false`, `reason: "MACHINE_MAINTENANCE"` y el `message` configurado.
