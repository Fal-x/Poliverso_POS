# POLIVERSO POS

Sistema POS on-premise para operación financiera y de caja (ventas, recargas, control de sesiones de efectivo, usuarios/roles, reportes y lectoras físicas).

## Estado técnico actual
- Arquitectura: Frontend React + API Fastify + Prisma + PostgreSQL.
- Ejecución: nativa, sin contenedores.
- Base de datos: PostgreSQL (conexión directa por `DATABASE_URL`).
- Seguridad: JWT, roles (`cashier`, `supervisor`, `admin`), aprobaciones de supervisor y `AuditLog`.

## Requisitos
- Node.js 20.x
- npm 10.x
- PostgreSQL 15+

## Variables de entorno base
Usar `.env.example` como plantilla:
- `DATABASE_URL`
- `API_PORT`
- `VITE_API_URL`
- `JWT_SECRET`
- `LOG_LEVEL`
- `CORS_ORIGINS`

## Arranque local
1. `npm install`
2. `npm run prisma:generate`
3. `npm run prisma:migrate`
4. `npm run prisma:seed`
5. API: `npm run api:dev`
6. Frontend: `npm run dev`

## Scripts clave
- `scripts/setup.sh`: bootstrap local nativo (sin Docker).
- `scripts/dev-daemon.sh`: start/stop/restart/status de frontend + backend.
- `scripts/install-ubuntu.sh`: instalación base en Ubuntu.
- `scripts/install-systemd.sh`: alta de servicios `systemd`.
- `npm run sim:pos:month`: backfill rápido de 30 días con `simulation_report.json`.
- `npm run sim:pos:period -- --profile=stress --month=2026-02`: simulación mensual más agresiva.

## Documentación
- `docs/DEPLOY_UBUNTU_NATIVE.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/ADMIN_SUPPORT_RUNBOOK.md`
- `docs/GO_LIVE_CHECKLIST.md`
- `docs/AUDIT_REPORT_2026-02-19.md`
