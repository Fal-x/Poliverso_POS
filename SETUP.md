# POLIVERSE Backend Setup (PostgreSQL + Prisma)

Este documento describe el paso a paso para levantar la base de datos desde cero y dejarla lista para produccion.

## 0) Requisitos
- Node.js 20+
- PostgreSQL 15+
- Un usuario con permisos para crear bases de datos

## 1) Instalar dependencias
```bash
npm install
```

## 2) Crear base de datos y usuario
Ejemplo en Postgres:
```sql
CREATE USER poliverse_app WITH PASSWORD 'cambia_esto';
CREATE DATABASE poliverse_db OWNER poliverse_app;
GRANT ALL PRIVILEGES ON DATABASE poliverse_db TO poliverse_app;
```

## 3) Configurar variables de entorno
Crear archivo `.env` en la raiz del proyecto:
```bash
DATABASE_URL="postgresql://poliverse_app:cambia_esto@localhost:5432/poliverse_db?schema=public"
```

## 4) Generar el cliente y correr migraciones
```bash
npm run prisma:generate
npm run prisma:migrate
```

Esto creara las tablas definidas en `prisma/schema.prisma`.

## 5) Seed inicial (roles, admin, catalogo base)
```bash
npm run prisma:seed
```

Credenciales iniciales:
- usuario: `admin@poliverse.local`
- passwordHash: `CHANGE_ME_BEFORE_PRODUCTION`

**Importante:** reemplaza el hash antes de exponer el sistema a usuarios reales.

## 6) Verificacion rapida
```bash
npm run prisma:studio
```

## 7) Estrategia de ledger (resumen operativo)
- Todas las operaciones financieras generan un `LedgerEvent` con multiples `LedgerEntry`.
- No se debe actualizar ni borrar un evento financiero; las correcciones se hacen con eventos de tipo `REVERSAL`.
- Para saldo de tarjetas, usar `CardBalanceEvent` como fuente de verdad (append-only).

## 8) Recomendaciones para alto volumen (atracciones)
- La tabla `AttractionUsage` tiene indices por `siteId` y `occurredAt` para consultas diarias.
- Para volumen muy alto, particionar por mes usando tablas hijas en Postgres.
  - Estrategia sugerida: particiones `attraction_usage_YYYY_MM` con rango por fecha.
  - Aplicar el particionado despues de la primera migracion y documentar el DDL aplicado.

## 9) Produccion
1. Configurar una base de datos dedicada (disco SSD, backups automaticos, WAL archiving).
2. Correr migraciones con:
   ```bash
   npx prisma migrate deploy
   ```
3. Generar cliente:
   ```bash
   npx prisma generate
   ```
4. Deshabilitar credenciales de seed y crear usuarios reales.
5. Habilitar monitoreo (latencia, locks, crecimiento de tablas y WAL).
6. Definir politicas de retencion para logs y eventos historicos.

## 10) Nota de seguridad
- Nunca ejecutar `DELETE` o `UPDATE` sobre `LedgerEvent`, `LedgerEntry` y `CardBalanceEvent`.
- Toda accion sensible debe crear `SupervisorApproval` y `AuditLog`.
