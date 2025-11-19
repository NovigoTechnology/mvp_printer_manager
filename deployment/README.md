# Deployment

Archivos de configuración para despliegue en producción.

## Archivos

### `docker-compose.prod.yml`
Configuración de Docker Compose optimizada para producción.

**Diferencias con desarrollo:**
- Variables de entorno de producción
- Volúmenes persistentes para datos
- Configuración de restart policies
- Optimizaciones de performance

**Uso:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

### `nginx.conf`
Configuración de Nginx como reverse proxy.

**Características:**
- Proxy para API (puerto 8000)
- Proxy para Web UI (puerto 3000)
- Headers de seguridad
- Compresión gzip
- Rate limiting

**Uso:**
```bash
# En el servidor de producción
sudo cp nginx.conf /etc/nginx/sites-available/printer-manager
sudo ln -s /etc/nginx/sites-available/printer-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### `printer-manager.service`
Archivo de servicio systemd para gestión automática.

**Características:**
- Auto-inicio en boot
- Restart automático en caso de fallo
- Logging integrado con systemd

**Instalación:**
```bash
sudo cp printer-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable printer-manager
sudo systemctl start printer-manager
```

**Gestión:**
```bash
# Ver estado
sudo systemctl status printer-manager

# Ver logs
sudo journalctl -u printer-manager -f

# Reiniciar
sudo systemctl restart printer-manager
```

## Proceso de Despliegue

1. **Preparar servidor:**
   ```bash
   # Instalar Docker y Docker Compose
   sudo apt update
   sudo apt install docker.io docker-compose nginx
   ```

2. **Clonar repositorio:**
   ```bash
   git clone <repo-url>
   cd printer-fleet-manager
   ```

3. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env.production
   nano .env.production  # Editar con valores reales
   ```

4. **Configurar Nginx:**
   ```bash
   sudo cp deployment/nginx.conf /etc/nginx/sites-available/printer-manager
   sudo ln -s /etc/nginx/sites-available/printer-manager /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Configurar servicio systemd:**
   ```bash
   sudo cp deployment/printer-manager.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable printer-manager
   sudo systemctl start printer-manager
   ```

6. **Verificar:**
   ```bash
   sudo systemctl status printer-manager
   docker ps
   curl http://localhost
   ```

## Mantenimiento

### Actualizar aplicación
```bash
git pull
docker compose -f deployment/docker-compose.prod.yml down
docker compose -f deployment/docker-compose.prod.yml build
docker compose -f deployment/docker-compose.prod.yml up -d
```

### Backups
```bash
# Backup de base de datos
docker exec mvp_printer_manager-db-1 pg_dump -U postgres printer_manager > backup.sql

# Backup de volúmenes
docker run --rm -v mvp_printer_manager_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

### Logs
```bash
# Logs de la aplicación
docker compose -f deployment/docker-compose.prod.yml logs -f

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Seguridad

- ✅ Cambiar `JWT_SECRET` en producción
- ✅ Usar HTTPS con certificado SSL/TLS
- ✅ Configurar firewall (UFW)
- ✅ Actualizar regularmente las imágenes Docker
- ✅ Monitorear logs de acceso
- ✅ Implementar rate limiting en Nginx
