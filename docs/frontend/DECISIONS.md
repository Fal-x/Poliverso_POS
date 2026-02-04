# Decisiones de Arquitectura y Diseño

## 1. UI server-first
El frontend no decide estados críticos; el backend es la fuente de verdad.

## 2. Design System único
Se elimina cualquier estilo local improvisado. Todo pasa por tokens y componentes base.

## 3. Roles diferenciados
Cajero, Supervisor y Admin tienen señales visuales distintas para evitar errores operativos.

## 4. Feedback inmediato
Toda acción crítica confirma con backend y devuelve un estado visible.

## 5. Documentación obligatoria
Sin documentación (design system, arquitectura, APIs y manual operativo) el proyecto no se considera terminado.
