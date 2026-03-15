# Guía de Backup y Recuperación

## Backup recomendado (PostgreSQL)
Frecuencia mínima: diaria.

```bash
pg_dump -Fc -h 127.0.0.1 -U poliverse_app -d poliverse_db \
  -f /var/backups/poliverso/poliverse_db_$(date +%F).dump
```

Retención sugerida:
- Diarios: 14 días
- Semanales: 8 semanas
- Mensuales: 12 meses

## Verificación de backup
Validar archivo generado y tamaño:
```bash
ls -lh /var/backups/poliverso/
```

## Recuperación
1. Detener servicios:
```bash
sudo systemctl stop poliverso-api poliverso-web
```
2. Restaurar:
```bash
dropdb -h 127.0.0.1 -U postgres poliverse_db
createdb -h 127.0.0.1 -U postgres -O poliverse_app poliverse_db
pg_restore -h 127.0.0.1 -U poliverse_app -d poliverse_db /ruta/backup.dump
```
3. Levantar servicios:
```bash
sudo systemctl start poliverso-api poliverso-web
```
4. Validar:
```bash
curl -s http://127.0.0.1:3001/health
```

## Prueba de recuperación
Realizar simulación de restore al menos 1 vez al mes en entorno de staging.
