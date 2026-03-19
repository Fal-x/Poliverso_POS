# Architecture

Resumen de arquitectura orientado a operación y evolución segura del sistema.

## Vista general
POLIVERSO POS es una aplicación on-premise compuesta por:
- Frontend React/Vite para operación POS por rol
- API Fastify para reglas de negocio, autenticación y reporting
- Prisma como capa de acceso a datos
- PostgreSQL como base transaccional
- Integración con lectoras ESP mediante token y firma HMAC
- Simulador operativo en `src/simulator/` para carga y pruebas de comportamiento

## Diagrama lógico
```text
Frontend React
  -> API Fastify (/api/v1)
    -> Servicios de dominio
      -> Prisma Client
        -> PostgreSQL

Lectoras ESP
  -> API Fastify (/api/v1/esp/* y /api/v1/reader/*)
    -> Validación de autenticación, firma, máquina y tarjeta
      -> Ledger / DeviceLog / AttractionUsage
```

## Estructura del repositorio
- `src/pages/`: pantallas por rol y operación
- `src/components/`: componentes UI y componentes de aplicación
- `src/api/`: cliente HTTP del frontend
- `src/backend/api/`: bootstrap Fastify, middleware y rutas
- `src/backend/services/`: lógica de negocio
- `src/backend/domain/`: reglas y máquinas de estado
- `src/backend/utils/`: utilidades de auditoría, sanitización y soporte
- `src/simulator/`: motor de simulación, agentes y escritor DB
- `scripts/`: automatización de setup, despliegue y simulación
- `tests/`: pruebas automatizadas
- `prisma/`: esquema, migraciones y seed

## Módulos críticos
- `src/backend/api/server.ts`: entrada principal del backend
- `src/backend/api/routes/*`: endpoints por dominio
- `src/backend/services/cashSessionService.ts`: apertura/cierre de caja y conciliación
- `src/backend/services/receiptService.ts`: generación de recibos
- `src/backend/services/promotionEngine.ts`: promociones de recarga
- `src/backend/domain/cardStateMachine.ts`: transiciones válidas de tarjetas
- `prisma/schema.prisma`: modelo de datos y contratos persistentes

## Flujos de negocio críticos
- Apertura y cierre de caja: cálculo de esperado, diferencias, aprobaciones y auditoría
- Venta y recarga: escritura transaccional con líneas, pagos, ledger y recibos
- Anulación y reversión: validación de motivo, autorización y trazabilidad
- Uso de máquina: validación de lectora, tarjeta, saldo, estado de máquina e idempotencia

## Decisiones operativas
- La aplicación corre nativamente, sin Docker, como estrategia principal de despliegue
- El modelo financiero es append-only en eventos sensibles
- Las acciones sensibles deben quedar auditadas
- El frontend y backend comparten repositorio, pero sus entradas de ejecución son independientes

## Riesgos conocidos
- El bundle web actual sigue siendo grande y requiere code splitting
- Existen errores TypeScript en backend que deben corregirse antes de declarar readiness total
- La documentación histórica aún convive con la documentación canónica nueva
