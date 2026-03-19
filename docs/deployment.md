# Deployment

Procedimiento de despliegue productivo nativo sobre Ubuntu.

## Requisitos de servidor
- Ubuntu 22.04 LTS o 24.04 LTS
- 4 vCPU recomendados
- 8 GB RAM recomendados
- 80 GB SSD recomendados
- Node.js 20.x
- npm 10.x
- PostgreSQL 15+

## Layout recomendado
- Código: `/opt/poliverso-pos`
- Usuario de servicio: `poliverso`
- Base de datos: PostgreSQL local o en red privada
- Logs del sistema: `journalctl`

## Bootstrap de servidor
```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  DB_NAME=poliverse_db DB_USER=poliverse_app DB_PASSWORD='change_me' \
  ./scripts/install-ubuntu.sh
```

## Bootstrap end-to-end desde cero
Si el repositorio ya fue clonado en el servidor, el flujo más corto y reproducible es:

```bash
sudo mkdir -p /opt/poliverso-pos
sudo chown -R "$USER":"$USER" /opt/poliverso-pos
git clone <repo-url> /opt/poliverso-pos
cd /opt/poliverso-pos
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  DB_NAME=poliverse_db DB_USER=poliverse_app DB_PASSWORD='change_me' \
  API_PORT=3001 WEB_PORT=5173 \
  ./scripts/bootstrap-production.sh
```

El script:
- instala paquetes base del sistema
- instala Node.js y PostgreSQL
- crea usuario de aplicación y base de datos
- genera `.env` productivo si falta
- ejecuta `npm ci`
- aplica migraciones y seed
- compila frontend
- instala y reinicia `poliverso-api` y `poliverso-web`
- imprime healthcheck y comandos `journalctl`

## Despliegue de aplicación
```bash
sudo mkdir -p /opt/poliverso-pos
sudo chown -R poliverso:poliverso /opt/poliverso-pos
cd /opt/poliverso-pos
git clone <repo-url> .
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run build
```

## Variables de entorno
Archivo `.env` mínimo:

```env
NODE_ENV=production
DATABASE_URL="postgresql://poliverse_app:change_me@127.0.0.1:5432/poliverse_db?schema=public"
API_PORT=3001
VITE_API_URL="http://127.0.0.1:3001/api/v1"
JWT_SECRET="replace_with_strong_secret"
LOG_LEVEL=info
CORS_ORIGINS="https://tu-dominio-interno"
```

Reglas:
- `.env` debe quedar con permisos `600`
- `JWT_SECRET` debe ser fuerte y único por entorno
- `CORS_ORIGINS` debe limitarse a orígenes explícitos

## Servicios `systemd`
```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  API_PORT=3001 WEB_PORT=5173 ./scripts/install-systemd.sh
```

Verificación:

```bash
systemctl status poliverso-api
systemctl status poliverso-web
curl -s http://127.0.0.1:3001/health
```

## Arranque manual alternativo
```bash
./scripts/start-production.sh
```

## Logs
- API: `journalctl -u poliverso-api -f`
- Web: `journalctl -u poliverso-web -f`
- Healthcheck: `curl -s http://127.0.0.1:3001/health`

## Backup
Backup recomendado:

```bash
pg_dump -Fc -h 127.0.0.1 -U poliverse_app -d poliverse_db \
  -f /var/backups/poliverso/poliverse_db_$(date +%F).dump
```

Retención sugerida:
- diarios: 14 días
- semanales: 8 semanas
- mensuales: 12 meses

## Restore
```bash
sudo systemctl stop poliverso-api poliverso-web
dropdb -h 127.0.0.1 -U postgres poliverse_db
createdb -h 127.0.0.1 -U postgres -O poliverse_app poliverse_db
pg_restore -h 127.0.0.1 -U poliverse_app -d poliverse_db /ruta/backup.dump
sudo systemctl start poliverso-api poliverso-web
```

## Monitoreo mínimo
- disponibilidad del healthcheck
- uso de CPU, RAM y disco
- crecimiento de tablas y WAL en PostgreSQL
- errores 5xx de la API
- fallos de autenticación ESP
- diferencia de caja y eventos auditables
