# Integración de lectoras ESP / máquinas

Base URL: `http://<host>:3001/api/v1`

## 1. Modelo operativo

Cada lectora (`Reader`) pertenece a una máquina (`Attraction`) y a una sede (`siteId`).

La máquina define:
- `code`: código funcional de la máquina.
- `status`: `ACTIVE`, `MAINTENANCE`, `INACTIVE`.
- `maintenanceMessage`: texto que el servidor retorna cuando la máquina está en mantenimiento.
- `price`: valor a debitar por uso.
- `type`: `TIME` o `SKILL`.

La lectora define:
- `code`: valor enviado en header `x-reader-id`.
- `apiTokenHash`: token compartido para autenticación.
- `hmacSecret`: secreto compartido para firmar payloads.
- `isActive`: habilita o bloquea la lectora.

## 2. Seguridad requerida en la lectora

Headers obligatorios en todas las llamadas ESP:
- `x-reader-id`
- `x-api-token`
- `x-signature`

Firma:
- `x-signature = Base64(HMAC_SHA256(SHA256(payload_json), hmacSecret))`
- Para `GET`, el payload es cadena vacía `""`.

Reglas:
- `x-reader-id` debe coincidir con `Reader.code`.
- `x-api-token` debe coincidir con el token configurado para esa lectora.
- `x-signature` debe generarse con el `hmacSecret` de esa lectora.
- En `POST /reader/validate`, el `timestamp` debe estar dentro de una ventana de 5 minutos.

## 3. Flujo recomendado de conexión

1. La lectora lee el UID NFC.
2. La lectora llama `POST /reader/validate` o `POST /esp/activities/validate-and-use`.
3. El servidor valida lectora, token, firma, ventana de tiempo y asociación lectora-máquina.
4. El servidor revisa estado de máquina y tarjeta.
5. Si todo está bien, debita saldo, crea ledger y registra `DeviceLog`.
6. Si la máquina está en mantenimiento, responde bloqueo con mensaje operativo.

## 4. Endpoints para lectoras

### POST `/reader/validate`

Uso: flujo corto para validar un UID directamente contra la máquina asociada a la lectora.

Headers:
- `x-reader-id`
- `x-api-token`
- `x-signature`

Body:
```json
{
  "uid": "04A1B2C3D4",
  "timestamp": 1710000000,
  "requestId": "11111111-1111-1111-1111-111111111111"
}
```

Respuesta OK:
```json
{
  "allowed": true,
  "reason": null,
  "price": 5000,
  "balanceBefore": 20000,
  "balanceAfter": 15000,
  "machine": "Air Hockey 1",
  "transactionId": "uuid"
}
```

Respuesta bloqueada por mantenimiento:
```json
{
  "allowed": false,
  "reason": "MACHINE_MAINTENANCE",
  "message": "Máquina fuera de servicio por mantenimiento técnico."
}
```

Razones comunes:
- `MACHINE_MAINTENANCE`
- `MACHINE_INACTIVE`
- `READER_INACTIVE`
- `CARD_NOT_FOUND`
- `CARD_INACTIVE`
- `INSUFFICIENT_FUNDS`

### GET `/esp/cards/{uid}`

Uso: consultar saldo y puntos de una tarjeta desde la lectora.

Respuesta:
```json
{
  "success": true,
  "data": {
    "uid": "04A1B2C3D4",
    "points": 0,
    "credit": 15000,
    "status": "ACTIVE"
  }
}
```

### GET `/esp/activities/{activityId}`

Uso: consultar la configuración vigente de una máquina.

Admite `id` o `code`.

Respuesta:
```json
{
  "success": true,
  "data": {
    "activityId": "ARCADE-01",
    "costPoints": 0,
    "pointsReward": 1000,
    "costCredit": 5000,
    "type": "ATTRACTION",
    "machineType": "SKILL",
    "machineStatus": "MAINTENANCE",
    "maintenanceMessage": "Máquina fuera de servicio por mantenimiento técnico.",
    "duration": 0
  }
}
```

### POST `/esp/activities/validate-and-use`

Uso: flujo completo donde la lectora informa explícitamente la máquina a usar.

Body:
```json
{
  "uid": "04A1B2C3D4",
  "activityId": "ARCADE-01",
  "terminalId": "esp32-01",
  "requestId": "11111111-1111-1111-1111-111111111111"
}
```

Bloqueo por mantenimiento:
```json
{
  "success": true,
  "data": {
    "allowed": false,
    "reason": "MACHINE_MAINTENANCE",
    "message": "Máquina fuera de servicio por mantenimiento técnico."
  }
}
```

## 5. Endpoints administrativos para máquinas

### GET `/admin/stations?site_id=<uuid>`

Rol mínimo: `supervisor`

Devuelve por máquina:
- `status`
- `maintenance_mode`
- `maintenance_message`
- `assigned_readers`
- `last_use_at`
- `total_uses_today`
- `total_revenue_today`

### PATCH `/admin/stations/{id}`

Rol mínimo: `admin`

Puede actualizar:
- `status`
- `maintenance_message`
- `price`
- `duration`
- `points_reward`
- `reader_id`
- `location`
- `name`
- `type`

Si `status` pasa a `MAINTENANCE` y no se envía mensaje, el servidor conserva el anterior o usa `Máquina en mantenimiento`.

### POST `/admin/stations/{id}/maintenance`

Rol mínimo: `supervisor`

Activa o desactiva mantenimiento sin tocar otros datos de la máquina.

Body:
```json
{
  "site_id": "uuid-de-la-sede",
  "enabled": true,
  "message": "Máquina fuera de servicio por mantenimiento técnico."
}
```

Para reactivar:
```json
{
  "site_id": "uuid-de-la-sede",
  "enabled": false
}
```

Comportamiento:
- `enabled: true` => `status = MAINTENANCE`
- `enabled: false` => `status = ACTIVE`
- al salir de mantenimiento, `maintenance_message` se limpia

## 6. Comportamiento esperado en firmware

Si llega:
```json
{
  "allowed": false,
  "reason": "MACHINE_MAINTENANCE",
  "message": "Máquina fuera de servicio por mantenimiento técnico."
}
```

La lectora debe:
- no habilitar relé, pulso o inicio de juego
- mostrar el `message` al operador/usuario
- permitir reintento solo cuando el servidor quite mantenimiento
