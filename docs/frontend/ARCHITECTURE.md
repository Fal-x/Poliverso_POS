# Arquitectura Frontend POLIVERSE

## Objetivo
Frontend API-first, sin lógica de negocio crítica en cliente. El backend define el estado real de caja, ventas y autorizaciones.

## Estructura
- `src/design-system`: tokens y estándares visuales.
- `src/components`: UI reutilizable (botones, modales, inputs).
- `src/layouts`: layouts operativos (POSLayout, POSHeader).
- `src/pages`: pantallas por rol (cajero, supervisor, admin, login).
- `src/api`: cliente API tipado.
- `src/lib`: utilidades base (auth, formatters).
- `src/types`: DTOs y tipos compartidos.

## Flujo de datos
- Server-first: los cambios críticos se confirman con backend.
- El estado local no sustituye estado real.
- Después de acciones críticas se refresca el estado desde API.

## Convenciones
- No usar mocks permanentes.
- Manejo de errores por código, no por texto.
- Todas las pantallas consumen APIs documentadas.
- Cada flujo crítico deja auditoría en backend.

## Estándares de código
- TypeScript estricto.
- Componentes pequeños, responsabilidad única.
- Nombres operativos, no genéricos.
