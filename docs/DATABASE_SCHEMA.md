# POLIVERSO - Esquema de Base de Datos

## Diagrama ER (Entidad-Relación)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USERS     │     │  LOCATIONS  │     │ CASH_REGS   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ name        │     │ name        │     │ location_id │──┐
│ email       │     │ address     │     │ name        │  │
│ pin_hash    │     │ is_active   │     │ status      │  │
│ role        │     │ created_at  │     │ opened_by   │  │
│ avatar_url  │     └─────────────┘     │ opened_at   │  │
│ is_active   │            │            └─────────────┘  │
│ created_at  │            │                   │         │
└─────────────┘            └───────────────────┘         │
      │                                                  │
      │         ┌─────────────┐     ┌─────────────┐     │
      │         │   SHIFTS    │     │   CARDS     │     │
      │         ├─────────────┤     ├─────────────┤     │
      └────────▶│ id (PK)     │     │ id (PK)     │     │
                │ user_id     │──┐  │ code        │     │
                │ cash_reg_id │◀─┼──│ balance     │     │
                │ start_time  │  │  │ bonus_bal   │     │
                │ end_time    │  │  │ points      │     │
                │ initial_amt │  │  │ customer_id │──┐  │
                │ final_amt   │  │  │ is_active   │  │  │
                │ is_active   │  │  │ created_at  │  │  │
                └─────────────┘  │  └─────────────┘  │  │
                      │          │         │         │  │
                      │          │         │         │  │
┌─────────────┐       │          │         │         │  │
│  CUSTOMERS  │◀──────┼──────────┼─────────┼─────────┘  │
├─────────────┤       │          │         │            │
│ id (PK)     │       │          │         │            │
│ name        │       │          │         │            │
│ phone       │       │          │         │            │
│ email       │       │          │         │            │
│ document    │       │          │         │            │
│ birth_date  │       │          │         │            │
│ created_at  │       │          │         │            │
└─────────────┘       │          │         │            │
                      │          │         │            │
┌─────────────┐       │          │         │            │
│   SALES     │◀──────┘          │         │            │
├─────────────┤                  │         │            │
│ id (PK)     │                  │         │            │
│ shift_id    │──────────────────┘         │            │
│ user_id     │                            │            │
│ customer_id │                            │            │
│ card_id     │────────────────────────────┘            │
│ subtotal    │                                         │
│ discount    │                                         │
│ total       │                                         │
│ payment_mth │                                         │
│ status      │                                         │
│ req_invoice │                                         │
│ invoice_cod │                                         │
│ created_at  │                                         │
└─────────────┘                                         │
      │                                                 │
      ▼                                                 │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐│
│ SALE_ITEMS  │     │  PRODUCTS   │     │ CATEGORIES  ││
├─────────────┤     ├─────────────┤     ├─────────────┤│
│ id (PK)     │     │ id (PK)     │     │ id (PK)     ││
│ sale_id     │────▶│ category_id │────▶│ name        ││
│ product_id  │     │ name        │     │ icon        ││
│ quantity    │     │ price       │     │ color       ││
│ unit_price  │     │ cost        │     │ order       ││
│ total       │     │ stock       │     │ created_at  ││
└─────────────┘     │ is_active   │     └─────────────┘│
                    │ image_url   │                    │
                    │ created_at  │                    │
                    └─────────────┘                    │
                                                       │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  RECHARGES  │     │  MACHINES   │     │MACHINE_USAGE│
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ card_id     │     │ name        │     │ machine_id  │
│ user_id     │     │ code        │     │ card_id     │
│ shift_id    │     │ price_use   │     │ amount      │
│ amount      │     │ location_id │     │ timestamp   │
│ bonus_amt   │     │ status      │     │ is_double   │
│ points_earn │     │ readers     │     │ corrected_by│
│ payment_mth │     │ created_at  │     │ correction  │
│ status      │     └─────────────┘     └─────────────┘
│ created_at  │
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PRIZES    │     │PRIZE_REDEMP │     │RECHARGE_BON │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ name        │     │ prize_id    │     │ min_amount  │
│ pts_required│     │ card_id     │     │ max_amount  │
│ stock       │     │ user_id     │     │ bonus_amt   │
│ image_url   │     │ points_used │     │ is_active   │
│ is_active   │     │ created_at  │     │ created_at  │
│ created_at  │     └─────────────┘     └─────────────┘
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  PROGRAMS   │     │PROGRAM_PAYS │     │CASH_WITHDR  │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ type        │     │ program_id  │     │ shift_id    │
│ name        │     │ amount      │     │ amount      │
│ customer_id │     │ payment_mth │     │ reason      │
│ total_amt   │     │ user_id     │     │ authorized  │
│ paid_amt    │     │ created_at  │     │ created_by  │
│ pending_amt │     └─────────────┘     │ created_at  │
│ status      │                         └─────────────┘
│ scheduled   │
│ notes       │     ┌─────────────┐     ┌─────────────┐
│ created_at  │     │   ALERTS    │     │ CASH_COUNTS │
└─────────────┘     ├─────────────┤     ├─────────────┤
                    │ id (PK)     │     │ id (PK)     │
                    │ type        │     │ shift_id    │
                    │ severity    │     │ expected    │
                    │ message     │     │ actual      │
                    │ data (JSON) │     │ difference  │
                    │ is_read     │     │ by_payment  │
                    │ created_at  │     │ notes       │
                    └─────────────┘     │ created_at  │
                                        └─────────────┘

┌─────────────┐
│CARD_INVENTOR│
├─────────────┤
│ id (PK)     │
│ shift_id    │
│ initial_cnt │
│ sold_count  │
│ final_count │
│ difference  │
│ created_at  │
└─────────────┘
```

---

## Tablas Detalladas

### users
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(100) | NOT NULL | Nombre completo |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email |
| pin_hash | VARCHAR(255) | NOT NULL | PIN hasheado (bcrypt) |
| role | ENUM | NOT NULL | 'cashier', 'supervisor', 'admin' |
| avatar_url | TEXT | NULL | URL del avatar |
| is_active | BOOLEAN | DEFAULT TRUE | Estado activo |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |
| updated_at | TIMESTAMP | DEFAULT NOW() | Última actualización |

### locations
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(100) | NOT NULL | Nombre de sede |
| address | TEXT | NULL | Dirección completa |
| is_active | BOOLEAN | DEFAULT TRUE | Estado activo |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### cash_registers
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| location_id | UUID | FK → locations | Sede |
| name | VARCHAR(50) | NOT NULL | Nombre (ej: "Caja 1") |
| status | ENUM | NOT NULL | 'open', 'closed' |
| opened_by | UUID | FK → users, NULL | Usuario que abrió |
| opened_at | TIMESTAMP | NULL | Hora de apertura |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### shifts
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| user_id | UUID | FK → users, NOT NULL | Cajero del turno |
| cash_register_id | UUID | FK → cash_registers | Caja asignada |
| start_time | TIMESTAMP | NOT NULL | Inicio del turno |
| end_time | TIMESTAMP | NULL | Fin del turno |
| initial_amount | DECIMAL(12,2) | NOT NULL | Monto inicial |
| final_amount | DECIMAL(12,2) | NULL | Monto final |
| is_active | BOOLEAN | DEFAULT TRUE | Turno activo |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### customers
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(100) | NOT NULL | Nombre completo |
| phone | VARCHAR(20) | NULL | Teléfono |
| email | VARCHAR(255) | NULL | Email |
| document | VARCHAR(20) | NULL | Cédula/NIT |
| birth_date | DATE | NULL | Fecha de nacimiento |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### cards
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Código único (POL-XXXXXX) |
| balance | DECIMAL(12,2) | DEFAULT 0 | Saldo disponible |
| bonus_balance | DECIMAL(12,2) | DEFAULT 0 | Saldo de bonos |
| points | INTEGER | DEFAULT 0 | Puntos acumulados |
| customer_id | UUID | FK → customers, NULL | Cliente asociado |
| is_active | BOOLEAN | DEFAULT TRUE | Tarjeta activa |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |
| last_used_at | TIMESTAMP | NULL | Último uso |

### categories
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(50) | NOT NULL | Nombre de categoría |
| icon | VARCHAR(50) | NULL | Icono Material |
| color | VARCHAR(20) | NULL | Color (primary, success, etc) |
| order | INTEGER | DEFAULT 0 | Orden de visualización |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### products
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| category_id | UUID | FK → categories | Categoría |
| name | VARCHAR(100) | NOT NULL | Nombre del producto |
| price | DECIMAL(12,2) | NOT NULL | Precio de venta |
| cost | DECIMAL(12,2) | NULL | Costo |
| stock | INTEGER | NULL | Stock (NULL = ilimitado) |
| is_active | BOOLEAN | DEFAULT TRUE | Producto activo |
| image_url | TEXT | NULL | Imagen del producto |
| description | TEXT | NULL | Descripción |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### sales
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| shift_id | UUID | FK → shifts, NOT NULL | Turno |
| user_id | UUID | FK → users, NOT NULL | Vendedor |
| customer_id | UUID | FK → customers, NULL | Cliente |
| card_id | UUID | FK → cards, NULL | Tarjeta usada |
| subtotal | DECIMAL(12,2) | NOT NULL | Subtotal |
| discount | DECIMAL(12,2) | DEFAULT 0 | Descuento |
| total | DECIMAL(12,2) | NOT NULL | Total |
| payment_method | ENUM | NOT NULL | 'cash','transfer','qr','debit','credit' |
| status | ENUM | NOT NULL | 'completed','pending','cancelled','refunded' |
| requires_invoice | BOOLEAN | DEFAULT FALSE | Requiere factura |
| invoice_code | VARCHAR(50) | NULL | Código de factura externa |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### sale_items
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| sale_id | UUID | FK → sales, NOT NULL | Venta |
| product_id | UUID | FK → products, NOT NULL | Producto |
| quantity | INTEGER | NOT NULL | Cantidad |
| unit_price | DECIMAL(12,2) | NOT NULL | Precio unitario |
| total | DECIMAL(12,2) | NOT NULL | Total línea |

### recharges
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| card_id | UUID | FK → cards, NOT NULL | Tarjeta |
| user_id | UUID | FK → users, NOT NULL | Cajero |
| shift_id | UUID | FK → shifts, NOT NULL | Turno |
| amount | DECIMAL(12,2) | NOT NULL | Monto recargado |
| bonus_amount | DECIMAL(12,2) | DEFAULT 0 | Bono aplicado |
| points_earned | INTEGER | DEFAULT 0 | Puntos ganados |
| payment_method | ENUM | NOT NULL | Medio de pago |
| status | ENUM | NOT NULL | Estado |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### recharge_bonuses
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| min_amount | DECIMAL(12,2) | NOT NULL | Monto mínimo |
| max_amount | DECIMAL(12,2) | NOT NULL | Monto máximo |
| bonus_amount | DECIMAL(12,2) | NOT NULL | Bono a aplicar |
| is_active | BOOLEAN | DEFAULT TRUE | Escala activa |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### machines
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(100) | NOT NULL | Nombre de máquina |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Código único |
| price_per_use | DECIMAL(12,2) | NOT NULL | Precio por uso |
| location_id | UUID | FK → locations | Sede |
| status | ENUM | NOT NULL | 'active','maintenance','inactive' |
| readers | INTEGER | DEFAULT 1 | Número de lectoras |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### machine_usage
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| machine_id | UUID | FK → machines, NOT NULL | Máquina |
| card_id | UUID | FK → cards, NOT NULL | Tarjeta |
| amount_charged | DECIMAL(12,2) | NOT NULL | Monto cobrado |
| timestamp | TIMESTAMP | NOT NULL | Fecha/hora de uso |
| is_double_read | BOOLEAN | DEFAULT FALSE | Doble lectura detectada |
| corrected_by | UUID | FK → users, NULL | Supervisor que corrigió |
| correction_reason | TEXT | NULL | Motivo de corrección |

### prizes
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| name | VARCHAR(100) | NOT NULL | Nombre del premio |
| points_required | INTEGER | NOT NULL | Puntos requeridos |
| stock | INTEGER | NOT NULL | Stock disponible |
| image_url | TEXT | NULL | Imagen |
| is_active | BOOLEAN | DEFAULT TRUE | Premio activo |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### prize_redemptions
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| prize_id | UUID | FK → prizes, NOT NULL | Premio |
| card_id | UUID | FK → cards, NOT NULL | Tarjeta |
| user_id | UUID | FK → users, NOT NULL | Cajero |
| points_used | INTEGER | NOT NULL | Puntos usados |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### programs
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| type | ENUM | NOT NULL | 'birthday','vacation','extracurricular' |
| name | VARCHAR(100) | NOT NULL | Nombre del programa |
| customer_id | UUID | FK → customers, NOT NULL | Cliente |
| total_amount | DECIMAL(12,2) | NOT NULL | Valor total |
| paid_amount | DECIMAL(12,2) | DEFAULT 0 | Monto pagado |
| pending_amount | DECIMAL(12,2) | NOT NULL | Saldo pendiente |
| status | ENUM | NOT NULL | 'pending','partial','paid' |
| scheduled_date | DATE | NULL | Fecha programada |
| notes | TEXT | NULL | Notas |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### program_payments
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| program_id | UUID | FK → programs, NOT NULL | Programa |
| amount | DECIMAL(12,2) | NOT NULL | Monto del abono |
| payment_method | ENUM | NOT NULL | Medio de pago |
| user_id | UUID | FK → users, NOT NULL | Cajero |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### cash_withdrawals
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| shift_id | UUID | FK → shifts, NOT NULL | Turno |
| amount | DECIMAL(12,2) | NOT NULL | Monto retirado |
| reason | TEXT | NOT NULL | Motivo |
| authorized_by | UUID | FK → users, NOT NULL | Supervisor |
| created_by | UUID | FK → users, NOT NULL | Solicitante |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### cash_counts
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| shift_id | UUID | FK → shifts, NOT NULL | Turno |
| expected_amount | DECIMAL(12,2) | NOT NULL | Esperado |
| actual_amount | DECIMAL(12,2) | NOT NULL | Real |
| difference | DECIMAL(12,2) | NOT NULL | Diferencia |
| by_payment_method | JSONB | NULL | Desglose por medio de pago |
| notes | TEXT | NULL | Notas |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### card_inventory
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| shift_id | UUID | FK → shifts, NOT NULL | Turno |
| initial_count | INTEGER | NOT NULL | Inicial |
| sold_count | INTEGER | DEFAULT 0 | Vendidas |
| final_count | INTEGER | NOT NULL | Final |
| difference | INTEGER | DEFAULT 0 | Diferencia |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### alerts
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| type | ENUM | NOT NULL | 'bonus','cancellation','inventory','double_read','cash_difference' |
| severity | ENUM | NOT NULL | 'info','warning','error' |
| message | TEXT | NOT NULL | Mensaje |
| data | JSONB | NULL | Datos adicionales |
| is_read | BOOLEAN | DEFAULT FALSE | Leída |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

### audit_log
| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PK, NOT NULL | Identificador único |
| user_id | UUID | FK → users, NOT NULL | Usuario |
| action | VARCHAR(50) | NOT NULL | Acción realizada |
| entity_type | VARCHAR(50) | NOT NULL | Tipo de entidad |
| entity_id | UUID | NULL | ID de entidad |
| old_data | JSONB | NULL | Datos anteriores |
| new_data | JSONB | NULL | Datos nuevos |
| ip_address | VARCHAR(50) | NULL | IP del cliente |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha de creación |

---

## Índices Recomendados

```sql
-- Tarjetas
CREATE INDEX idx_cards_code ON cards(code);
CREATE INDEX idx_cards_customer ON cards(customer_id);

-- Ventas
CREATE INDEX idx_sales_shift ON sales(shift_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_status ON sales(status);

-- Recargas
CREATE INDEX idx_recharges_card ON recharges(card_id);
CREATE INDEX idx_recharges_date ON recharges(created_at);

-- Uso de máquinas
CREATE INDEX idx_machine_usage_machine ON machine_usage(machine_id);
CREATE INDEX idx_machine_usage_card ON machine_usage(card_id);
CREATE INDEX idx_machine_usage_date ON machine_usage(timestamp);

-- Auditoría
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
```

---

## Consideraciones de Seguridad

1. **Hasheo de PIN**: Usar bcrypt con salt
2. **Row Level Security (RLS)**: Implementar en PostgreSQL/Supabase
3. **Auditoría**: Registrar todas las operaciones sensibles
4. **Validación de roles**: Middleware en cada endpoint
5. **Límites de tasa**: Proteger endpoints de autenticación
