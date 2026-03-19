# POLIVERSO POS

Sistema POS on-premise para operación financiera y de caja. Cubre ventas, recargas, sesiones de efectivo, usuarios y roles, reportes operativos y validación de uso de máquinas mediante lectoras ESP.

## Descripción
El repositorio contiene la aplicación web de operación, la API backend, el modelo de datos Prisma/PostgreSQL y utilidades de simulación para pruebas de carga y comportamiento. La estrategia de despliegue principal es nativa sobre Ubuntu, sin contenedores.

## Arquitectura general
```text
Frontend React/Vite
  -> API Fastify (/api/v1)
    -> Servicios de dominio
      -> Prisma Client
        -> PostgreSQL

Lectoras ESP
  -> API Fastify (/api/v1/reader/* y /api/v1/esp/*)
    -> Validación token + HMAC + reglas de máquina/tarjeta
```

## Stack tecnológico
- Frontend: React 18, Vite, TypeScript, Tailwind, Radix UI
- Backend: Fastify, TypeScript
- Datos: Prisma, PostgreSQL
- Testing: Vitest
- Integración física: lectoras ESP con token y firma HMAC

## Estructura del repositorio
- `src/`: frontend, backend y simulador (`src/simulator/`)
- `scripts/`: automatización operativa y utilidades CLI
- `tests/`: pruebas automatizadas
- `docs/`: documentación canónica e histórica
- `prisma/`: esquema, migraciones y seed

## Requisitos
- Node.js 20.x
- npm 10.x
- PostgreSQL 15+

## Uso rápido
1. Instalar dependencias: `npm install`
2. Crear `.env` a partir de `.env.example`
3. Generar cliente Prisma: `npm run prisma:generate`
4. Aplicar migraciones de desarrollo: `npm run prisma:migrate`
5. Cargar seed inicial: `npm run prisma:seed`
6. Levantar backend: `npm run api:dev`
7. Levantar frontend: `npm run dev`

## Instalación desde cero en un servidor
Flujo recomendado en Ubuntu 22.04/24.04:

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

Ese flujo:
- instala Node.js, npm, PostgreSQL y utilidades base
- crea usuario y base de datos PostgreSQL
- genera `.env` productivo si no existe
- instala dependencias Node
- ejecuta Prisma generate, migraciones y seed
- compila la app
- instala y levanta servicios `systemd`
- valida healthcheck y deja comandos `journalctl` listos

Arranque conjunto:

```bash
./scripts/dev-daemon.sh start
```

Validación mínima:

```bash
npm test
npm run build
curl -s http://127.0.0.1:3001/health
```

## Variables de entorno base
Usa `.env.example` como plantilla. Variables mínimas:
- `DATABASE_URL`
- `API_PORT`
- `VITE_API_URL`
- `JWT_SECRET`
- `LOG_LEVEL`
- `CORS_ORIGINS`

## Scripts clave
- `scripts/setup.sh`: bootstrap local nativo
- `scripts/dev-daemon.sh`: start/stop/restart/status de frontend y backend
- `scripts/bootstrap-production.sh`: bootstrap end-to-end de servidor productivo desde cero
- `scripts/install-ubuntu.sh`: preparación base del servidor Ubuntu
- `scripts/install-systemd.sh`: instalación de servicios `systemd`
- `scripts/start-production.sh`: arranque manual en producción
- `npm run sim:pos:month`: backfill rápido de datos operativos simulados
- `npm run sim:esp:load`: prueba de carga para lectoras ESP

## Documentación detallada
- Setup: [docs/setup.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/setup.md)
- Arquitectura: [docs/architecture.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/architecture.md)
- API: [docs/api.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/api.md)
- Despliegue: [docs/deployment.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/deployment.md)
- Troubleshooting: [docs/troubleshooting.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/troubleshooting.md)
- Seguridad: [docs/security.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/security.md)

Referencias adicionales:
- OpenAPI: [docs/openapi.yaml](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/openapi.yaml)
- Esquema de datos: [docs/DATABASE_SCHEMA.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/DATABASE_SCHEMA.md)
- Checklist de salida a producción: [docs/GO_LIVE_CHECKLIST.md](/Users/fabianalexanderredondodiaz/Poliverso_POS/docs/GO_LIVE_CHECKLIST.md)

## Estado del proyecto
- Build web: funcional
- Tests automatizados: mínimos, con cobertura insuficiente para producción fuerte
- Despliegue objetivo: nativo en Ubuntu con PostgreSQL
- Riesgos abiertos:
  - errores TypeScript pendientes en backend
  - bundle web grande, pendiente de code splitting
  - documentación histórica aún conviviendo con la documentación canónica

## Licenciamiento
El repositorio no declara un archivo `LICENSE` ni un campo de licencia explícito del proyecto. Hasta definirlo formalmente, debe tratarse como software de uso interno o propietario.
