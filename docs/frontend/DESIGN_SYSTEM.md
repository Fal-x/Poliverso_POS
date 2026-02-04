# POLIVERSE Design System

Sistema visual único para operación POS. Diseñado para turnos largos, alto volumen y errores costosos.

## Principios
- Consistencia absoluta: mismos colores, tamaños y estados en todo el sistema.
- Jerarquía operativa: totales y acciones críticas dominan la vista.
- Feedback inmediato: cada acción tiene respuesta visible.
- Mínima fricción: solo se confirma donde hay riesgo financiero.

## Paleta institucional (tokens)
- Primario (azul): `--primary` → navegación, selección, CTA principal.
- Acento (amarillo): `--accent` → señales estratégicas y foco de atención.
- Advertencia (amarillo): `--warning` → riesgo u operaciones que requieren validación.
- Éxito (verde): `--success` → acciones que mueven dinero (cobrar, confirmar).
- Error (rojo): `--destructive` → cierre, anulaciones, acciones irreversibles.

## Tipografía
- Base: IBM Plex Sans
- Monospace: Space Mono
- Escala: `xs → 3xl` (ver tokens en `src/design-system/tokens.ts`)

## Espaciado y layout
- Espaciado base: 8px
- Modales: 80–85vh máximo para asegurar aire de lectura.
- Sidebar: 260–280px en desktop.

## Estados globales
- Success: `btn-pos-success`, `badge-success`.
- Warning: `btn-pos-warning`, `badge-warning`.
- Error: `btn-pos-danger`, `badge-danger`.
- Disabled: `opacity-50` + sin interacción.
- Loading: spinner en botón.

## Componentes base

### Botones
- Base: `.btn-pos`
- Variantes: `.btn-pos-primary | success | warning | danger | accent | secondary | ghost`
- Tamaños: `.btn-pos-sm | md | lg | xl`

### Inputs
- Base: `.input-pos`
- Compacto: `.input-pos-compact`
- Error: `.input-pos-error`

### Badges
- Base: `.badge-pos`
- Variantes: `badge-success | badge-warning | badge-danger | badge-info | badge-accent`

### Cards
- Base: `.card-pos`
- Interactiva: `.card-pos-interactive`

### Modales
- Overlay: `.modal-overlay`
- Contenido: `.modal-content`

### Chips / Tabs
- Base: `.chip-pos`
- Activo: `.chip-pos-active`

### Option Tiles
- Base: `.tile-option`
- Activo: `.tile-option-active`

### Alerts
- Base: `.alert-pos`
- Variantes: `alert-info | alert-warning | alert-danger`

## Usos correctos
- Cobro: `btn-pos-success`.
- Cierre/anulación: `btn-pos-danger`.
- Autorizaciones: `btn-pos-warning`.

## Usos incorrectos
- Colores diferentes por pantalla.
- Botones sin variante estandarizada.
- Inputs con estilos locales.
