# POLIVERSO - API Endpoints

> Estado: documento histórico. Para endpoints vigentes usar `docs/API_V1.md`.

## Base URL
```
Production: https://api.poliverso.com/v1
Development: http://localhost:3000/v1
```

## Autenticación
Todas las peticiones requieren header `Authorization: Bearer <token>` excepto `/auth/login`.

---

## 🔐 Autenticación

### POST /auth/login
Iniciar sesión con código de 6 dígitos.

**Request:**
```json
{
  "user_id": "uuid",
  "code": "123456"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "uuid",
      "name": "María García",
      "role": "cashier",
      "avatar_url": null
    },
    "expires_at": "2024-01-15T23:59:59Z"
  }
}
```

### GET /auth/users
Listar usuarios disponibles para login (sin datos sensibles).

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "María García", "role": "cashier", "avatar_url": null }
  ]
}
```

### POST /auth/logout
Cerrar sesión actual.

---

## 💳 Tarjetas

### POST /cards
Crear nueva tarjeta.

**Request:**
```json
{
  "customer_id": "uuid | null"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "POL-001234",
    "balance": 0,
    "bonus_balance": 0,
    "points": 0,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### GET /cards/:code
Leer información de tarjeta.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "POL-001234",
    "balance": 45000,
    "bonus_balance": 5000,
    "points": 2500,
    "customer": {
      "id": "uuid",
      "name": "Juan Pérez"
    },
    "is_active": true,
    "last_used_at": "2024-01-15T09:45:00Z"
  }
}
```

### POST /cards/:code/recharge
Recargar tarjeta.

**Request:**
```json
{
  "amount": 50000,
  "payment_method": "cash"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "recharge_id": "uuid",
    "amount": 50000,
    "bonus_amount": 7000,
    "points_earned": 50,
    "new_balance": 102000,
    "new_points": 2550
  }
}
```

### DELETE /cards/:code
Desactivar tarjeta (requiere rol supervisor+).

**Request:**
```json
{
  "reason": "Tarjeta dañada",
  "supervisor_pin": "5678"
}
```

### GET /cards/:code/transactions
Historial de movimientos de tarjeta.

**Query params:** `?from=2024-01-01&to=2024-01-31&limit=50`

---

## 🛒 Ventas

### POST /sales
Registrar nueva venta.

**Request:**
```json
{
  "items": [
    { "product_id": "uuid", "quantity": 2 },
    { "product_id": "uuid", "quantity": 1 }
  ],
  "payment_method": "cash",
  "customer_id": "uuid | null",
  "card_id": "uuid | null",
  "requires_invoice": false,
  "discount": 0
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ticket_number": "00001234",
    "items": [...],
    "subtotal": 24000,
    "discount": 0,
    "total": 24000,
    "payment_method": "cash",
    "status": "completed",
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

### GET /sales
Listar ventas (con filtros).

**Query params:** 
- `?shift_id=uuid` - Por turno
- `?user_id=uuid` - Por vendedor
- `?from=2024-01-01&to=2024-01-31` - Por rango de fechas
- `?status=completed` - Por estado
- `?payment_method=cash` - Por medio de pago

### GET /sales/:id
Detalle de venta.

### PUT /sales/:id/cancel
Anular venta (requiere supervisor).

**Request:**
```json
{
  "reason": "Error en productos",
  "supervisor_pin": "5678"
}
```

### PUT /sales/:id/invoice
Asociar código de factura.

**Request:**
```json
{
  "invoice_code": "FE-2024-001234"
}
```

---

## 🎮 Máquinas/Atracciones

### GET /machines
Listar máquinas.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Air Hockey 1",
      "code": "AH-001",
      "price_per_use": 3000,
      "status": "active",
      "readers": 2,
      "today_usage": 45,
      "today_revenue": 135000
    }
  ]
}
```

### POST /machines/:id/use
Registrar uso de máquina (desde ESP/lector).

**Request:**
```json
{
  "card_code": "POL-001234",
  "reader_id": 1
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "usage_id": "uuid",
    "amount_charged": 3000,
    "new_balance": 42000,
    "is_double_read": false
  }
}
```

### PUT /machines/:id/usage/:usage_id/correct
Corregir uso (doble lectura, etc).

**Request:**
```json
{
  "reason": "Doble lectura detectada",
  "supervisor_pin": "5678",
  "refund": true
}
```

### POST /machines
Crear máquina (admin).

### PUT /machines/:id
Actualizar máquina (admin).

---

## 💰 Caja

### POST /cash-register/open
Abrir caja.

**Request:**
```json
{
  "cash_register_id": "uuid",
  "initial_amount": 200000
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "shift_id": "uuid",
    "cash_register_id": "uuid",
    "user_id": "uuid",
    "start_time": "2024-01-15T08:00:00Z",
    "initial_amount": 200000
  }
}
```

### POST /cash-register/close
Cerrar caja.

**Request:**
```json
{
  "actual_amounts": {
    "cash": 850000,
    "transfer": 320000,
    "debit": 180000,
    "credit": 95000,
    "qr": 45000
  },
  "card_inventory": {
    "initial": 50,
    "sold": 12,
    "final": 38
  },
  "notes": "Sin novedad"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "shift_id": "uuid",
    "summary": {
      "total_sales": 1490000,
      "by_payment": {...},
      "expected": {...},
      "actual": {...},
      "difference": 0
    },
    "cards_difference": 0,
    "end_time": "2024-01-15T18:00:00Z"
  }
}
```

### POST /cash-register/withdrawal
Registrar salida de dinero.

**Request:**
```json
{
  "amount": 100000,
  "reason": "Pago a proveedor",
  "supervisor_pin": "5678"
}
```

### GET /cash-register/current
Estado actual de caja del turno activo.

---

## 🎁 Premios

### GET /prizes
Listar premios disponibles.

### POST /prizes/:id/redeem
Redimir premio.

**Request:**
```json
{
  "card_code": "POL-001234"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "redemption_id": "uuid",
    "prize": { "id": "uuid", "name": "Peluche Grande" },
    "points_used": 3000,
    "remaining_points": 1500
  }
}
```

### POST /prizes (admin)
Crear premio.

### PUT /prizes/:id (admin)
Actualizar premio.

---

## 📊 Reportes

### GET /reports/sales
Reporte de ventas.

**Query params:**
- `?from=2024-01-01&to=2024-01-31`
- `?group_by=day|week|month`
- `?location_id=uuid`
- `?user_id=uuid`
- `?format=json|excel`

### GET /reports/bonuses
Reporte de bonificaciones.

### GET /reports/machine-usage
Reporte de uso de máquinas.

### GET /reports/prizes
Reporte de premios entregados.

### GET /reports/card-inventory
Reporte de inventario de tarjetas.

### GET /reports/cash-counts
Reporte de arqueos de caja.

---

## 👥 Usuarios (Admin)

### GET /users
Listar usuarios.

### POST /users
Crear usuario.

**Request:**
```json
{
  "name": "Nuevo Usuario",
  "email": "nuevo@poliverso.com",
  "pin": "1234",
  "role": "cashier"
}
```

### PUT /users/:id
Actualizar usuario.

### DELETE /users/:id
Desactivar usuario.

### PUT /users/:id/reset-pin
Resetear PIN.

---

## 🎓 Programas

### GET /programs
Listar programas.

**Query params:**
- `?type=birthday|vacation|extracurricular`
- `?status=pending|partial|paid`
- `?from=2024-01-01&to=2024-03-31`

### POST /programs
Crear programa.

**Request:**
```json
{
  "type": "birthday",
  "name": "Cumpleaños Juan - 8 años",
  "customer_id": "uuid",
  "total_amount": 450000,
  "scheduled_date": "2024-02-15",
  "notes": "Tema: Superhéroes"
}
```

### POST /programs/:id/payment
Registrar abono.

**Request:**
```json
{
  "amount": 150000,
  "payment_method": "transfer"
}
```

---

## 🔔 Alertas

### GET /alerts
Listar alertas.

**Query params:**
- `?is_read=false`
- `?severity=error|warning|info`
- `?type=bonus|cancellation|inventory|double_read`

### PUT /alerts/:id/read
Marcar alerta como leída.

### PUT /alerts/read-all
Marcar todas como leídas.

---

## 🔧 Configuración (Admin)

### GET /config
Obtener configuración del sistema.

### PUT /config
Actualizar configuración.

**Request:**
```json
{
  "card_price": 10000,
  "min_recharge": 5000,
  "points_per_1000": 1,
  "require_pin_for_cancellation": true,
  "double_confirm_close": true
}
```

### GET /config/bonuses
Listar escalas de bonificación.

### POST /config/bonuses
Crear escala de bonificación.

### PUT /config/bonuses/:id
Actualizar escala.

### DELETE /config/bonuses/:id
Eliminar escala.

---

## 🔌 Endpoints para ESP32/Lectoras

Estos endpoints están optimizados para dispositivos IoT.

### POST /esp/read
Lectura de tarjeta desde ESP.

**Headers:** `X-Device-ID: ESP-001`

**Request:**
```json
{
  "card_code": "POL-001234",
  "machine_code": "AH-001",
  "reader": 1
}
```

**Response 200:**
```json
{
  "success": true,
  "action": "charge",
  "amount": 3000,
  "new_balance": 42000,
  "display_message": "Saldo: $42,000"
}
```

**Response 402 (saldo insuficiente):**
```json
{
  "success": false,
  "error": "insufficient_balance",
  "display_message": "Saldo insuficiente"
}
```

### POST /esp/heartbeat
Ping de estado del dispositivo.

**Request:**
```json
{
  "device_id": "ESP-001",
  "machine_code": "AH-001",
  "status": "online",
  "last_read_at": "2024-01-15T10:30:00Z"
}
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos para esta acción |
| 404 | Not Found - Recurso no encontrado |
| 402 | Payment Required - Saldo insuficiente |
| 409 | Conflict - Operación no permitida (ej: caja ya abierta) |
| 422 | Unprocessable Entity - Validación fallida |
| 500 | Internal Server Error |

## Formato de Errores

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Saldo insuficiente para esta operación",
    "details": {
      "required": 5000,
      "available": 3000
    }
  }
}
```

---

## WebSocket Events

Para actualizaciones en tiempo real:

```
ws://api.poliverso.com/ws
```

### Eventos

| Evento | Descripción |
|--------|-------------|
| `sale:created` | Nueva venta registrada |
| `recharge:completed` | Recarga completada |
| `alert:new` | Nueva alerta |
| `machine:use` | Uso de máquina |
| `card:balance_low` | Saldo bajo en tarjeta |
| `shift:opened` | Caja abierta |
| `shift:closed` | Caja cerrada |
