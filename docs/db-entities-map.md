# Mapa de Entidades de Base de Datos

Fuente principal: [prisma/schema.prisma](/Users/fabianalexanderredondodiaz/Poliverso_POS/prisma/schema.prisma)

Este documento resume todas las entidades actuales de la base de datos de POLIVERSO POS, qué datos guardan y cuál es su función principal dentro del sistema.

## Vista General por Dominio

| Dominio | Entidades |
|---|---|
| Multi-sede y acceso | `Organization`, `Site`, `SiteConfig`, `Role`, `RolePermission`, `User`, `UserAssignment`, `UserAuthCode`, `RefreshToken` |
| Operación POS y caja | `Terminal`, `CashRegister`, `Shift`, `CashSession`, `CashCount`, `CashMovement` |
| Catálogo e inventario | `Categoria`, `Subcategoria`, `ItemVendible`, `CodigoReservado`, `Product`, `InventoryItem`, `InventoryMovement` |
| Tarjetas y saldo | `Card`, `CardStatusHistory`, `CardBalanceEvent`, `BonusScale`, `BonusApplied` |
| Ventas | `Sale`, `SaleLine`, `SalePayment` |
| Premios y puntos | `PrizeRedemption`, `PointsLedgerEvent` |
| Atracciones y lectoras | `Attraction`, `Reader`, `DeviceLog`, `AttractionUsage` |
| Clientes y servicios | `Customer`, `Service`, `ServiceSale`, `ServicePayment` |
| Programas POLIKid | `PolikidStudent`, `ProgramEnrollment`, `EnrollmentPayment` |
| Eventos | `EventBasePlan`, `EventBooking`, `EventBookingPayment` |
| Promociones | `Promotion` |
| Contabilidad y control | `LedgerEvent`, `LedgerEntry`, `SupervisorApproval`, `AdminAction`, `AuditLog` |

## 1. Multi-sede y Acceso

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Organization` | `name`, `legalName`, `nit`, `phone`, `address`, `city` | Representa la organización dueña de una o varias sedes. |
| `Site` | `organizationId`, `name`, `code`, `address`, `city`, `phone`, `defaultCustomerId`, `status`, `timezone` | Es la sede operativa; casi toda la data transaccional cuelga de aquí. |
| `SiteConfig` | `siteId`, `minRechargeAmount`, `pointsPerCurrency`, `currencyUnit`, `dailySalesGoal`, `creditTermDays` | Guarda reglas comerciales y parámetros operativos por sede. |
| `Role` | `name` | Define roles base del sistema como cajero, supervisor y admin. |
| `RolePermission` | `roleId`, `permission` | Mapea permisos concretos a cada rol. |
| `User` | `email`, `fullName`, `passwordHash`, `status` | Cuenta operativa de usuario del sistema. |
| `UserAssignment` | `userId`, `siteId`, `roleId`, `isActive` | Asigna un usuario a una sede con un rol específico. |
| `UserAuthCode` | `userId`, `codeHash`, `issuedAt`, `expiresAt`, `failedAttempts`, `lockedUntil` | Maneja el código temporal de autenticación para login. |
| `RefreshToken` | `userId`, `tokenHash`, `expiresAt`, `revokedAt` | Soporta renovación y revocación de sesiones autenticadas. |

## 2. Operación POS y Caja

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Terminal` | `siteId`, `code`, `name` | Identifica una terminal lógica del POS dentro de una sede. |
| `CashRegister` | `siteId`, `code`, `name` | Identifica la caja física o gaveta de dinero. |
| `Shift` | `siteId`, `cashRegisterId`, `terminalId`, `openedById`, `openingCash`, `status`, `closedById`, `expectedCash`, `countedCash`, `cashDiscrepancy` | Controla el turno operativo de caja con apertura, cierre y descuadres. |
| `CashSession` | `siteId`, `terminalId`, `cashRegisterId`, `shiftId`, `openedByUserId`, `openingCashAmount`, `expectedCashAmount`, `closingCashAmount`, `cashDifference`, `status` | Lleva la sesión real de caja usada por ventas y movimientos de efectivo. |
| `CashCount` | `cashSessionId`, `type`, `denominations`, `totalAmount`, `countedByUserId` | Guarda arqueos físicos de apertura y cierre por denominaciones. |
| `CashMovement` | `cashSessionId`, `type`, `amount`, `reason`, `createdByUserId`, `authorizedByUserId`, `voidedAt`, `voidReason` | Registra retiros o ajustes de caja con trazabilidad y posibilidad de anulación controlada. |

## 3. Catálogo e Inventario

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Categoria` | `siteId`, `codigo`, `nombre`, `activo` | Nivel superior del catálogo comercial. |
| `Subcategoria` | `siteId`, `categoriaId`, `codigo`, `nombre`, `activo` | Segundo nivel del catálogo comercial. |
| `ItemVendible` | `siteId`, `categoriaId`, `subcategoriaId`, `codigo`, `nombre`, `tipoOperacion`, `tieneInventario`, `usaSaldoElectronico`, `usaPuntos`, `precioBase`, `activo` | Catálogo unificado de lo vendible: producto, servicio, uso, programa o evento. |
| `CodigoReservado` | `siteId`, `codigo`, `prefijo`, `consecutivo` | Reserva consecutivos para evitar reutilizar códigos del catálogo. |
| `Product` | `siteId`, `name`, `sku`, `category`, `analyticsCategory`, `analyticsSubcategory`, `price`, `isActive` | Producto usado por el POS tradicional y por líneas de venta. |
| `InventoryItem` | `siteId`, `name`, `sku`, `category`, `pointsCost`, `isActive` | Maestro de ítems con inventario físico, como plásticos, premios o snacks. |
| `InventoryMovement` | `siteId`, `itemId`, `shiftId`, `performedById`, `type`, `quantity`, `unitCost`, `occurredAt`, `approvalId` | Kardex append-only de entradas, salidas y ajustes de inventario. |

## 4. Tarjetas, Saldos y Bonos

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Card` | `siteId`, `uid`, `label`, `creditBalance`, `pointsBalance`, `status`, `ownerCustomerId`, `issuedAt` | Tarjeta física del cliente con saldo monetario y puntos. |
| `CardStatusHistory` | `siteId`, `cardId`, `fromStatus`, `toStatus`, `reason`, `changedByUserId`, `metadata` | Historial inmutable de cambios de estado de la tarjeta. |
| `CardBalanceEvent` | `cardId`, `siteId`, `ledgerEventId`, `moneyDelta`, `pointsDelta`, `reason`, `reversalOfId` | Ledger append-only de variaciones de saldo y puntos de la tarjeta. |
| `BonusScale` | `siteId`, `minAmount`, `maxAmount`, `bonusAmount` | Define reglas de bonificación por rango de recarga. |
| `BonusApplied` | `cardId`, `saleId`, `bonusScaleId`, `bonusAmount` | Guarda qué bono se aplicó en una venta/recarga concreta. |

## 5. Ventas

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Sale` | `siteId`, `customerId`, `shiftId`, `terminalId`, `cashSessionId`, `status`, `subtotal`, `tax`, `total`, `totalPaid`, `balanceDue`, `bonusTotal`, `pointsEarned`, `receiptNumber`, `createdById`, `approvedById`, `paidAt`, `voidedAt` | Encabezado de la venta; concentra totalización, estado y relación con caja y contabilidad. |
| `SaleLine` | `saleId`, `productId`, `cardId`, `category`, `quantity`, `unitPrice`, `lineTotal`, `metadata` | Detalle de ítems vendidos; también conecta recargas o emisión de tarjetas. |
| `SalePayment` | `saleId`, `method`, `type`, `amount`, `reference` | Registra uno o varios pagos por venta, soportando medios mixtos. |

## 6. Premios y Puntos

| Entidad | Datos principales | Función principal |
|---|---|---|
| `PrizeRedemption` | `siteId`, `cardId`, `itemId`, `quantity`, `pointsUnitCost`, `pointsTotal`, `receiptNumber`, `performedById`, `ledgerEventId` | Registra la redención de premios, descontando puntos e inventario. |
| `PointsLedgerEvent` | `siteId`, `cardId`, `saleId`, `ledgerEventId`, `pointsDelta`, `reason`, `metadata`, `createdById` | Lleva el historial append-only de acumulación y consumo de puntos. |

## 7. Atracciones y Lectoras

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Attraction` | `siteId`, `name`, `code`, `type`, `price`, `duration`, `status`, `readerId`, `location`, `maintenanceMessage`, `costPoints`, `pointsReward` | Representa una máquina o atracción jugable y sus reglas de cobro/uso. |
| `Reader` | `siteId`, `attractionId`, `code`, `position`, `isActive`, `apiTokenHash`, `hmacSecret`, `lastSeenAt` | Lectora física asociada a una atracción para validar tarjetas. |
| `DeviceLog` | `siteId`, `readerId`, `uid`, `cardId`, `activityId`, `requestId`, `eventType`, `allowed`, `reason`, `latency`, `pointsBefore`, `pointsAfter`, `creditBefore`, `creditAfter`, `payload` | Bitácora técnica de eventos de lectoras y validaciones de acceso/consumo. |
| `AttractionUsage` | `siteId`, `cardId`, `attractionId`, `readerId`, `playerIndex`, `type`, `cost`, `ledgerEventId`, `reversalOfId`, `performedById`, `approvalId` | Evento de uso de máquina; descuenta saldo o registra reversos con trazabilidad. |

## 8. Clientes y Servicios

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Customer` | `siteId`, `documentType`, `documentNumber`, `fullName`, `phone`, `email`, `city`, `notes` | Maestro de clientes para ventas, eventos y titularidad de tarjetas. |
| `Service` | `siteId`, `name`, `price`, `isActive` | Catálogo de servicios vendibles sin usar tarjeta. |
| `ServiceSale` | `siteId`, `serviceId`, `customerId`, `status`, `totalAmount`, `paidAmount` | Venta de servicio con saldo pendiente y pagos parciales. |
| `ServicePayment` | `serviceSaleId`, `amount`, `method` | Registra pagos de una venta de servicio. |

## 9. Programas POLIKid

| Entidad | Datos principales | Función principal |
|---|---|---|
| `PolikidStudent` | `siteId`, `firstName`, `lastName`, `documentType`, `documentNumber`, `birthDate`, `phone`, `email`, `guardianName`, `guardianPhone`, `status` | Maestro de estudiantes inscritos en programas académicos o formativos. |
| `ProgramEnrollment` | `siteId`, `studentId`, `programName`, `groupName`, `startsAt`, `endsAt`, `dueDate`, `totalAmount`, `discountAmount`, `finalAmount`, `status` | Inscripción de un estudiante a un programa o grupo. |
| `EnrollmentPayment` | `siteId`, `enrollmentId`, `amount`, `method`, `notes`, `createdById` | Historial append-only de pagos de una inscripción. |

## 10. Eventos

| Entidad | Datos principales | Función principal |
|---|---|---|
| `EventBasePlan` | `siteId`, `name`, `description`, `defaultValue`, `isActive` | Plan base o plantilla comercial para eventos y celebraciones. |
| `EventBooking` | `siteId`, `customerId`, `basePlanId`, `bookingType`, `customPlanName`, `eventDate`, `status`, `totalValue`, `notes` | Reserva concreta de evento con fecha, plan y valor pactado. |
| `EventBookingPayment` | `siteId`, `bookingId`, `amount`, `method`, `notes`, `createdById` | Pagos parciales o totales de una reserva de evento. |

## 11. Promociones

| Entidad | Datos principales | Función principal |
|---|---|---|
| `Promotion` | `siteId`, `code`, `name`, `description`, `type`, `scope`, `isActive`, `priority`, `startsAt`, `endsAt`, `percentValue`, `fixedValue`, `exactValues`, `dayRestrictions`, `productRestrictions`, `exceptions`, `metadata` | Motor declarativo de promociones aplicadas en tiempo de ejecución. |

## 12. Contabilidad, Aprobaciones y Auditoría

| Entidad | Datos principales | Función principal |
|---|---|---|
| `LedgerEvent` | `siteId`, `shiftId`, `saleId`, `serviceSaleId`, `eventType`, `description`, `createdById`, `reversalOfId`, `approvalId` | Evento financiero inmutable que agrupa el efecto contable de una operación. |
| `LedgerEntry` | `eventId`, `account`, `side`, `amount` | Línea contable débito/crédito de cada `LedgerEvent`. |
| `SupervisorApproval` | `siteId`, `action`, `entityType`, `entityId`, `requestedById`, `approvedById`, `reason` | Evidencia formal de aprobación para operaciones sensibles. |
| `AdminAction` | `siteId`, `actorId`, `actorRole`, `actionType`, `entityType`, `entityId`, `reason`, `approvalId`, `metadata` | Registro administrativo de acciones críticas o correctivas. |
| `AuditLog` | `siteId`, `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `reason` | Bitácora inmutable de cambios y acciones auditables en el sistema. |

## Relaciones Clave

- `Site` es el eje principal: casi todas las entidades transaccionales tienen `siteId`.
- `UserAssignment` conecta usuarios con sedes y roles.
- `Shift` y `CashSession` conectan operación de caja con `Sale`, `CashCount`, `CashMovement` y `LedgerEvent`.
- `Sale` conecta cliente, caja, líneas, pagos, bonos, puntos y contabilidad.
- `Card` conecta saldo monetario, puntos, recargas, usos de atracciones y redención de premios.
- `LedgerEvent` y `LedgerEntry` son la base contable; los ajustes se hacen por reversos, no por sobrescritura.
- `SupervisorApproval`, `AdminAction` y `AuditLog` son el bloque de gobierno y trazabilidad.

## Enumeraciones Importantes

Estas enums gobiernan estados y tipos de operación del sistema:

- Roles y permisos: `RoleName`, `PermissionCode`
- Estados operativos: `UserStatus`, `SiteStatus`, `CardStatus`, `ShiftStatus`, `CashSessionStatus`, `ServiceStatus`, `PolikidStudentStatus`
- Pagos y ventas: `PaymentMethod`, `SalePaymentType`, `SaleStatus`, `SaleCategory`
- Caja e inventario: `CashCountType`, `CashMovementType`, `InventoryCategory`, `InventoryMovementType`
- Atracciones y promociones: `AttractionUsageType`, `AttractionMachineType`, `AttractionStatus`, `PromotionType`, `PromotionScope`
- Control y auditoría: `LedgerEventType`, `LedgerEntrySide`, `LedgerAccount`, `ApprovalAction`, `EntityType`, `AuditAction`, `AdminActionType`
- Catálogo modular: `TipoOperacionVendible`
