# SET_UP.md

Guía rápida para dejar **Backend + Frontend** funcionales en local (sin Docker).

## 1. Requisitos
- Node.js `20.x`
- npm `10.x`
- PostgreSQL `15+`

Verifica:
```bash
node -v
npm -v
psql --version
```

## 2. Clonar e instalar dependencias
```bash
git clone <TU_REPO>
cd Poliverso_POS
npm install
```

## 3. Crear base de datos PostgreSQL
En `psql` (usuario admin de PostgreSQL):
```sql
CREATE USER poliverse_app WITH PASSWORD 'change_me';
CREATE DATABASE poliverse_db OWNER poliverse_app;
GRANT ALL PRIVILEGES ON DATABASE poliverse_db TO poliverse_app;
```

## 4. Configurar variables de entorno
Crear `.env` en la raíz:
```env
NODE_ENV=development
DATABASE_URL="postgresql://poliverse_app:change_me@127.0.0.1:5432/poliverse_db?schema=public"
API_PORT=3001
VITE_API_URL="http://127.0.0.1:3001/api/v1"
JWT_SECRET="change_me_now"
LOG_LEVEL=info
CORS_ORIGINS="http://127.0.0.1:5173,http://localhost:5173"
```

## 5. Preparar Prisma (backend DB)
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## 6. Levantar backend
En una terminal:
```bash
npm run api:dev
```

Validar health:
```bash
curl -s http://127.0.0.1:3001/health
```
Respuesta esperada:
```json
{"ok":true}
```

## 7. Levantar frontend
En otra terminal:
```bash
npm run dev
```

Abrir:
- `http://127.0.0.1:5173`

## 8. Arranque alternativo con daemon local
Si prefieres arranque conjunto:
```bash
./scripts/dev-daemon.sh start
```
Comandos útiles:
```bash
./scripts/dev-daemon.sh status
./scripts/dev-daemon.sh stop
./scripts/dev-daemon.sh restart
```

## 9. Validación funcional mínima
1. Login en frontend.
2. Cargar contexto POS (sede/terminal/caja).
3. Abrir caja.
4. Registrar una venta.
5. Cerrar caja.

## 10. Problemas comunes
- Error DB conexión:
  - Revisa `DATABASE_URL`.
  - Verifica PostgreSQL activo en `127.0.0.1:5432`.
- `prisma migrate` falla:
  - Usuario sin permisos o DB inexistente.
- Frontend no conecta a API:
  - Revisa `VITE_API_URL` en `.env`.
  - Confirma backend activo en puerto `3001`.

## 11. Comandos de verificación técnica
```bash
npm run test
npm run build
npm run lint
```

Nota: actualmente `lint` puede reportar errores existentes del proyecto; no impide levantar localmente backend/frontend para pruebas funcionales.
