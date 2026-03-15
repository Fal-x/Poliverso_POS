# Checklist Go-Live

## Infraestructura
- [ ] Servidor Ubuntu actualizado y endurecido.
- [ ] PostgreSQL 15+ operativo.
- [ ] Usuario de servicio no root creado.
- [ ] Firewall aplicado.

## Aplicación
- [ ] `.env` productivo configurado.
- [ ] `JWT_SECRET` fuerte y único.
- [ ] Migraciones aplicadas (`prisma migrate deploy`).
- [ ] Seed inicial ejecutado y usuarios reales cargados.
- [ ] `npm run build` exitoso.

## Servicios
- [ ] `poliverso-api.service` habilitado y activo.
- [ ] `poliverso-web.service` habilitado y activo.
- [ ] Healthcheck `/health` responde OK.

## Operación financiera
- [ ] Apertura/cierre de caja validado.
- [ ] Venta y recarga validadas.
- [ ] Anulación con supervisor validada.
- [ ] Reportes diarios consistentes.

## Continuidad
- [ ] Backup automático configurado.
- [ ] Restore de prueba ejecutado.
- [ ] Runbook operativo entregado.
