# Auditoría Técnica Integral
Fecha: 2026-02-19
Alcance: estructura, dependencias, APIs, seguridad, scripts de arranque, DB, módulos financieros y preparación on-premise sin contenedores.

## Resumen Ejecutivo
- Se eliminó acoplamiento operativo a Docker en código del proyecto.
- Se retiró API `stub` no funcional (`501 NOT_IMPLEMENTED`) del servidor.
- Se incorporó ruta de despliegue nativo Ubuntu + `systemd`.
- Persisten riesgos de calidad de código y cobertura QA profunda que bloquean una certificación financiera completa.

## Hallazgos Críticos
1. QA automatizado insuficiente para dominio financiero.
- Evidencia: `npm run test` solo ejecuta `src/test/example.test.ts`.
- Riesgo: no hay cobertura formal para caja, recargas, anulaciones, arqueo e integridad contable.

2. Calidad estática bloqueante.
- Evidencia: `npm run lint` falla con 100 errores.
- Riesgo: deuda técnica alta, defectos ocultos, baja confiabilidad para cambios en producción.

3. Rutas de negocio no implementadas estaban expuestas.
- Evidencia previa: `src/backend/api/routes/stubs.ts` respondía `501` para inventario/premios/atracciones.
- Acción aplicada: archivo eliminado y desregistrado en `src/backend/api/server.ts`.

## Hallazgos Altos
1. Endpoints públicos sin autenticación en superficie de usuarios/sedes.
- `GET /api/v1/sites`
- `GET /api/v1/auth/users`
- Riesgo: enumeración de estructura organizacional y usuarios.

2. Conexión DB fallida no detiene arranque de API.
- Evidencia: `server.ts` registra error de `prisma.$connect()` pero continúa.
- Riesgo: API viva con fallos operativos tardíos.

3. Duplicidad de lógica de listados de usuarios.
- Evidencia: `src/backend/api/routes/users.ts` expone `/auth/users` y `/users` con payload casi idéntico.

## Hallazgos Medios
1. Dependencias potencialmente no usadas.
- Candidatas: `@hookform/resolvers`, `date-fns`, `zod`.
- Nota: se requiere validación final de uso indirecto antes de retirar en rama productiva.

2. Documentación previa de despliegue incompleta para operación on-premise con `systemd`.
- Acción aplicada: nuevos documentos y scripts de despliegue nativo.

3. Modelo de seguridad inconsistente entre rutas.
- Hay rutas con `requireAuth + requireRole`, y otras de catálogo/usuarios sin preHandler.

## Hallazgos Bajos
1. Archivo legado de datos mock (`src/lib/mock-data.ts`) sin referencias activas.
2. `build` reporta bundle principal >500 kB (impacto en rendimiento, no en integridad financiera).

## Cambios Ejecutados en esta auditoría
- Eliminado `docker-compose.yml`.
- Eliminada ruta `stub`:
  - `src/backend/api/routes/stubs.ts` (borrado).
  - desregistro en `src/backend/api/server.ts`.
- Scripts nativos:
  - `scripts/setup.sh` actualizado para flujo sin Docker.
  - `scripts/dev-daemon.sh` actualizado para flujo sin Docker.
  - `scripts/install-ubuntu.sh` (nuevo).
  - `scripts/install-systemd.sh` (nuevo).
- Variables de entorno profesionales:
  - `.env.example` actualizado para PostgreSQL directo `127.0.0.1:5432`.
- Documentación profesional agregada:
  - `docs/DEPLOY_UBUNTU_NATIVE.md`
  - `docs/ARCHITECTURE_OVERVIEW.md`
  - `docs/ADMIN_SUPPORT_RUNBOOK.md`
  - `docs/BACKUP_RECOVERY.md`
  - `docs/GO_LIVE_CHECKLIST.md`

## Validación Ejecutada
- `npm run test`: OK (1 test trivial).
- `npm run build`: OK.
- `npm run lint`: FAIL (100 errores, 13 warnings).

## Riesgo Residual para Go-Live
Estado actual: **NO APTO para certificación financiera completa** por insuficiencia de QA y deuda estática.

Condiciones mínimas para pasar a “Apto”:
1. Suite de pruebas funcionales y de integridad financiera (caja/ventas/recargas/anulaciones/reportes).
2. Cierre de errores de lint críticos (especialmente backend API y validaciones).
3. Endurecimiento de autenticación en rutas públicas no justificadas.
