# Setup

Guía reproducible para levantar POLIVERSO POS desde cero en desarrollo o en un servidor limpio.

## Requisitos
- Node.js 20.x
- npm 10.x
- PostgreSQL 15+
- Acceso a una base de datos PostgreSQL con permisos para crear esquema y ejecutar migraciones

## Estructura relevante
- `src/`: frontend React, backend Fastify y simulador
- `scripts/`: utilidades operativas
- `tests/`: pruebas automáticas
- `prisma/`: esquema, migraciones y seed

## Instalación
```bash
npm install
```

## Base de datos
Ejemplo mínimo en PostgreSQL:

```sql
CREATE USER poliverse_app WITH PASSWORD 'change_me';
CREATE DATABASE poliverse_db OWNER poliverse_app;
GRANT ALL PRIVILEGES ON DATABASE poliverse_db TO poliverse_app;
```

## Variables de entorno
Usa `.env.example` como plantilla y crea `.env`:

```env
NODE_ENV=development
DATABASE_URL="postgresql://poliverse_app:change_me@127.0.0.1:5432/poliverse_db?schema=public"
API_PORT=3001
VITE_API_URL="http://127.0.0.1:3001/api/v1"
JWT_SECRET="change_me_now"
LOG_LEVEL=info
CORS_ORIGINS="http://127.0.0.1:5173,http://localhost:5173"
```

Variables obligatorias:
- `DATABASE_URL`
- `API_PORT`
- `VITE_API_URL`
- `JWT_SECRET`

## Inicialización de base de datos
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Notas:
- `prisma migrate` es para desarrollo.
- En producción usa `npx prisma migrate deploy`.
- El seed inicial crea datos base operativos; las credenciales iniciales deben rotarse antes de uso real.

## Ejecución en desarrollo
Backend:

```bash
npm run api:dev
```

Frontend:

```bash
npm run dev
```

Arranque conjunto:

```bash
./scripts/dev-daemon.sh start
```

Comandos útiles:

```bash
./scripts/dev-daemon.sh status
./scripts/dev-daemon.sh stop
./scripts/dev-daemon.sh restart
```

## Ejecución en producción
Preparación:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run build
```

Bootstrap completo desde un servidor limpio:

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

Qué hace el script:
- instala dependencias base del sistema
- crea usuario técnico y base PostgreSQL
- genera `.env` si no existe
- ejecuta `npm ci`
- ejecuta `prisma generate`, `migrate deploy` y `seed`
- compila la app
- instala y levanta servicios `systemd`
- valida `healthcheck` y muestra comandos `journalctl`

Arranque manual:

```bash
./scripts/start-production.sh
```

Provisionamiento Ubuntu:

```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  DB_NAME=poliverse_db DB_USER=poliverse_app DB_PASSWORD='change_me' \
  ./scripts/install-ubuntu.sh
```

Servicios `systemd`:

```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  API_PORT=3001 WEB_PORT=5173 ./scripts/install-systemd.sh
```

## Verificación mínima
```bash
curl -s http://127.0.0.1:3001/health
npm test
npm run build
```

Respuesta esperada del healthcheck:

```json
{"ok":true}
```

## Referencias
- `docs/architecture.md`
- `docs/api.md`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/security.md`
