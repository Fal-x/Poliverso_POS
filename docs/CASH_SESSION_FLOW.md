# Cash Session Flow (Apertura / Operación / Cierre)

Este documento describe los payloads mínimos esperados para operar caja en POLIVERSE.

## Apertura de caja

**POST /cash-sessions/open**
```json
{
  "site_id": "uuid",
  "terminal_id": "uuid",
  "cash_register_id": "uuid",
  "shift_id": "uuid",
  "opened_by_user_id": "uuid",
  "opening_cash_amount": "150000.00",
  "denominations": {
    "50000": 2,
    "20000": 2,
    "10000": 2,
    "5000": 2
  },
  "approval_id": null
}
```

**Reglas clave**
- No se permite apertura si ya existe una CashSession OPEN en la terminal.
- Si el efectivo inicial difiere del sugerido, requiere `approval_id`.

## Movimiento de efectivo (retiro / ajuste)

**POST /cash-sessions/{id}/movements**
```json
{
  "type": "WITHDRAWAL",
  "amount": "50000.00",
  "reason": "Retiro para caja fuerte",
  "created_by_user_id": "uuid",
  "authorized_by_user_id": "uuid",
  "approval_id": "uuid"
}
```

**Reglas clave**
- Movimientos son append-only.
- Retiros afectan el efectivo esperado.

## Cierre de caja

**POST /cash-sessions/{id}/close**
```json
{
  "closed_by_user_id": "uuid",
  "closing_cash_amount": "518000.00",
  "denominations": {
    "50000": 6,
    "20000": 6,
    "10000": 1,
    "5000": 4
  },
  "close_reason": "Diferencia por billete falso",
  "approval_id": "uuid"
}
```

**Reglas clave**
- No se permite cerrar si hay ventas en estado OPEN.
- Si hay diferencia != 0, requiere motivo y aprobación.

## Notas de auditoría
- Cada acción genera `AuditLog` con actor, timestamp, entidad y before/after.
- Ninguna transacción financiera se elimina; todo se revierte con eventos separados.
