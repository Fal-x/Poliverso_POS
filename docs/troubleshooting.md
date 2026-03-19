# Troubleshooting

Guía rápida de diagnóstico para operación y soporte.

## Verificaciones base
```bash
systemctl status poliverso-api
systemctl status poliverso-web
curl -s http://127.0.0.1:3001/health
journalctl -u poliverso-api -n 200
journalctl -u poliverso-web -n 200
```

## API no inicia
Revisar:
- `.env` presente y válido
- `DATABASE_URL` accesible
- PostgreSQL activo
- `JWT_SECRET` definido

Acciones:
```bash
journalctl -u poliverso-api -f
psql "$DATABASE_URL" -c 'SELECT 1;'
```

## Frontend no conecta al backend
Revisar:
- `VITE_API_URL`
- puerto `API_PORT`
- `CORS_ORIGINS`

Acciones:
```bash
curl -s http://127.0.0.1:3001/health
curl -s http://127.0.0.1:3001/api/v1/sites
```

## Fallo de migraciones Prisma
Revisar:
- credenciales de DB
- base de datos existente
- permisos del usuario
- consistencia entre `prisma/schema.prisma` y estado real

Acciones:
```bash
npm run prisma:generate
npx prisma migrate deploy
```

## Problemas de autenticación
Revisar:
- `JWT_SECRET` consistente entre reinicios
- hora del servidor sincronizada
- expiración y refresh token

Acciones:
```bash
timedatectl status
journalctl -u poliverso-api -n 200 | grep -i auth
```

## Problemas de caja
Revisar:
- sesión abierta/cerrada
- aprobaciones requeridas
- `audit_logs`
- diferencias calculadas en conciliación

Acciones:
- validar los movimientos de la sesión afectada
- revisar aprobaciones de supervisor
- confirmar que no hubo reintentos duplicados

## Problemas con lectoras ESP
Revisar:
- `x-reader-id`
- `x-api-token`
- `x-signature`
- asociación lectora-máquina
- estado de máquina y lectora

Síntomas frecuentes:
- `401` o `403`: token o firma inválidos
- `404`: actividad o máquina no encontrada
- `MACHINE_MAINTENANCE`: máquina bloqueada operativamente
- `INSUFFICIENT_FUNDS`: saldo insuficiente

Acciones:
- probar con `npm run sim:esp:load`
- revisar logs ESP en administración
- validar secreto HMAC y token configurados

## Restore post-incidente
```bash
sudo systemctl stop poliverso-api poliverso-web
pg_restore -h 127.0.0.1 -U poliverse_app -d poliverse_db /ruta/backup.dump
sudo systemctl start poliverso-api poliverso-web
curl -s http://127.0.0.1:3001/health
```

## Escalamiento
- L1: confirma disponibilidad, puertos, proceso y evidencia
- L2: revisa logs, DB, migraciones y configuración
- Toda intervención debe registrarse en bitácora operativa
