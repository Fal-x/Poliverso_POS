# API

Referencia operativa de la API v1.

Base URL por defecto:

```text
http://127.0.0.1:3001/api/v1
```

Especificación complementaria:
- `docs/openapi.yaml`

## Convención de respuesta
Éxito:

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

## Dominios principales

### Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/users`

### Caja
- `GET /cash-sessions/open/reference`
- `POST /cash-sessions/open`
- `GET /cash-sessions/{id}`
- `POST /cash-sessions/{id}/movements`
- `POST /cash-sessions/{id}/movements/{movementId}/void`
- `POST /cash-sessions/{id}/close`

### Ventas
- `GET /sales`
- `GET /sales/recent`
- `POST /sales`
- `POST /sales/{id}/void`

### Aprobaciones
- `POST /supervisor-approvals`

### Tarjetas
- `POST /cards`
- `GET /cards/{uid}`
- `POST /cards/{uid}/recharge`

### Catálogo y contexto POS
- `GET /sites`
- `GET /pos/context`
- `GET /products`
- `GET /bonus-scales`
- `GET /site-config`
- `GET /attractions`
- `GET /inventory/prizes`

### Reportes
- `GET /reports/day/summary`
- `GET /reports/day/payment-breakdown`
- `GET /reports/day/type-breakdown`
- `GET /reports/day/movements`
- `GET /reports/daily`

### Administración
- `GET /admin/products`
- `PATCH /admin/products/{id}`
- `GET /admin/site-config`
- `PATCH /admin/site-config`
- `GET /admin/stations`
- `PATCH /admin/stations/{id}`
- `POST /admin/stations/{id}/maintenance`
- `POST /admin/stations/simulate-use`
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/{id}`
- `DELETE /admin/users/{id}`
- `GET /audit-logs`
- `GET /admin/esp-logs`

## Integración ESP

### Endpoints
- `POST /esp/usage`
- `GET /admin/readers/status?site_id=<uuid>`
- `POST /reader/validate`
- `GET /esp/cards/{uid}`
- `GET /esp/activities/{activityId}`
- `POST /esp/activities/validate-and-use`

### Headers obligatorios
- `x-reader-id`
- `x-api-token`
- `x-signature`

### Firma
```text
x-signature = Base64(HMAC_SHA256(SHA256(payload_json), hmacSecretDelReader))
```

Para `GET`, el payload es cadena vacía `""`.

### Reglas
- `x-reader-id` debe coincidir con `Reader.code`
- `x-api-token` debe coincidir con la lectora configurada
- `x-signature` debe generarse con el secreto de esa lectora
- La integración nueva debe usar solo `POST /esp/usage`
- `requestId` es recomendado para idempotencia, pero no obligatorio en el flujo simplificado
- El servidor determina la máquina desde la lectora autenticada, sin que la ESP tenga que mandar `activityId`
- El estado de conectividad se consulta desde `GET /admin/readers/status`

### Motivos comunes de bloqueo
- `MACHINE_MAINTENANCE`
- `MACHINE_INACTIVE`
- `READER_INACTIVE`
- `CARD_NOT_FOUND`
- `CARD_INACTIVE`
- `INSUFFICIENT_FUNDS`

## Referencias históricas
- `docs/API_V1.md`
- `docs/API_ENDPOINTS.md`
- `docs/ESP_READERS.md`
