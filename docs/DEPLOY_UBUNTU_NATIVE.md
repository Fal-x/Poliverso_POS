# Despliegue Nativo Ubuntu (Sin Docker)

## 1. Requisitos del sistema
- Ubuntu 22.04 LTS o 24.04 LTS
- CPU: 4 vCPU recomendado
- RAM: 8 GB recomendado
- Disco: 80 GB SSD recomendado
- Node.js 20.x
- npm 10.x
- PostgreSQL 15+

## 2. Instalación base del servidor
```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  DB_NAME=poliverse_db DB_USER=poliverse_app DB_PASSWORD='cambiar_esto' \
  ./scripts/install-ubuntu.sh
```

## 3. Despliegue de código
```bash
sudo mkdir -p /opt/poliverso-pos
sudo chown -R poliverso:poliverso /opt/poliverso-pos
cd /opt/poliverso-pos
git clone <repo-url> .
```

## 4. Configuración de entorno
```bash
cp .env.example .env
```
Editar `.env` con valores productivos:
- `DATABASE_URL` a PostgreSQL local/privada
- `JWT_SECRET` robusto (>= 32 chars)
- `CORS_ORIGINS` restringido al dominio interno

## 5. Build y migraciones
```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run build
```

## 6. Servicios systemd
```bash
sudo APP_DIR=/opt/poliverso-pos APP_USER=poliverso APP_GROUP=poliverso \
  API_PORT=3001 WEB_PORT=5173 ./scripts/install-systemd.sh
```

## 7. Verificación operativa
```bash
systemctl status poliverso-api
systemctl status poliverso-web
curl -s http://127.0.0.1:3001/health
```

Debe responder:
```json
{"ok":true}
```

## 8. Dependencias exactas del proyecto
Ver `package.json` y `package-lock.json` versionados para trazabilidad exacta.

## 9. Endurecimiento mínimo recomendado
- Ejecutar servicios con usuario no root.
- Archivo `.env` con permisos `600`.
- Firewall: abrir solo puertos requeridos.
- Respaldos de PostgreSQL diarios + prueba de restauración.
