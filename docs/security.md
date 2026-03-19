# Security

Controles mínimos de seguridad para operar POLIVERSO POS en producción.

## Secretos y configuración
- No versionar `.env`
- Mantener `.env.example` como contrato público de variables
- Usar `JWT_SECRET` fuerte, único por entorno y rotado de forma controlada
- Restringir permisos de `.env` a `600`

## Acceso al sistema
- Ejecutar servicios con usuario no root
- Limitar acceso SSH por red y claves
- Exponer únicamente los puertos estrictamente necesarios
- Restringir `CORS_ORIGINS` a orígenes conocidos

## Base de datos
- PostgreSQL debe vivir en red privada o localhost
- Habilitar backups automáticos y pruebas de restauración
- No manipular manualmente tablas financieras append-only salvo en procedimientos aprobados

Tablas/eventos sensibles:
- `LedgerEvent`
- `LedgerEntry`
- `CardBalanceEvent`
- `AuditLog`

## Autenticación y autorización
- Los roles operativos base son `cashier`, `supervisor` y `admin`
- Toda acción sensible debe quedar auditada
- Las operaciones que cambian estado crítico deben usar aprobación cuando aplique

## Seguridad ESP
- Cada lectora debe tener token y secreto HMAC propios
- Todas las llamadas ESP deben incluir:
  - `x-reader-id`
  - `x-api-token`
  - `x-signature`
- La firma debe calcularse con el secreto de la lectora
- Debe existir ventana temporal e idempotencia por `requestId`

## Seguridad operativa
- Reinicios y despliegues deben dejar evidencia en bitácora
- Los logs deben revisarse tras cada incidente relevante
- El acceso administrativo debe limitarse a personal autorizado

## Hardening mínimo recomendado
- Firewall habilitado
- NTP activo
- usuario de servicio dedicado
- rotación de logs
- backups diarios y restore mensual probado
- monitoreo de errores 5xx y fallos de autenticación

## Riesgos actuales del repositorio
- Existen errores TypeScript pendientes en backend
- La suite de pruebas es todavía mínima
- El bundle web sigue siendo grande
- La documentación histórica aún coexiste con la nueva documentación canónica
