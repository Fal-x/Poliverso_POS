# Manual de Administración y Soporte

## Administración diaria
- Estado API: `systemctl status poliverso-api`
- Estado Web: `systemctl status poliverso-web`
- Healthcheck: `curl -s http://127.0.0.1:3001/health`
- Logs API: `journalctl -u poliverso-api -f`
- Logs Web: `journalctl -u poliverso-web -f`

## Operaciones seguras
- Reinicio controlado:
```bash
sudo systemctl restart poliverso-api poliverso-web
```
- Aplicar migraciones tras despliegue:
```bash
npx prisma migrate deploy
```

## Incidentes frecuentes
- API no inicia:
  - Validar `.env` y `DATABASE_URL`.
  - Verificar PostgreSQL activo.
  - Revisar `journalctl -u poliverso-api -n 200`.
- Error de autenticación:
  - Confirmar `JWT_SECRET` consistente.
  - Verificar hora del servidor (NTP).
- Error de caja:
  - Revisar aprobaciones (`supervisor_approvals`) y `audit_logs`.

## Soporte técnico (L1/L2)
- L1: diagnóstico operativo y recolección de evidencia.
- L2: análisis de logs, DB y corrección de configuración.
- Toda intervención debe dejar registro en bitácora de soporte.
