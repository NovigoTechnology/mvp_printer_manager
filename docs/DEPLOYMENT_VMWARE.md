# Despliegue en Servidor VMware - Guía Completa

## Preparación del Servidor VMware

### 1. Requisitos del Sistema

**Hardware Mínimo Recomendado:**
- CPU: 4 cores
- RAM: 8 GB
- Disco: 50 GB SSD
- Red: 1 Gbps

**Sistema Operativo:**
- O CentOS/RHEL 8+

### 2. Acceso Inicial al Servidor

```bash
# Conectarse vía SSH
ssh usuario@ip-del-servidor

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y
- Ubuntu Server 22.04 LTS (recomendado)
- Ubuntu Server 22.04 LTS (recomendado)
- Ubuntu Server 22.04 LTS (recomendado)
- Ubuntu Server 22.04 LTS (recomendado)

# Instalar utilidades básicas
sudo apt install -y curl git wget vim net-tools ufw
```

### 3. Configurar Firewall

```bash
# Habilitar firewall
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir puertos de la aplicación (solo si es necesario acceso directo)
sudo ufw allow 3000/tcp  # Next.js
sudo ufw allow 8000/tcp  # FastAPI

# Verificar estado
sudo ufw status
```

## Instalación de Docker y Docker Compose

### 1. Instalar Docker

```bash
# Remover versiones antiguas
sudo apt remove docker docker-engine docker.io containerd runc

# Instalar dependencias
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
# Agregar clave GPG oficial de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Configurar repositorio
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null



# Instalar Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar instalación
sudo docker run hello-world

# Agregar usuario al grupo docker (para evitar usar sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Verificar Docker Compose

```bash
docker compose version
# Debería mostrar: Docker Compose version v2.x.x
```

## Clonar y Configurar el Proyecto

### 1. Clonar el Repositorio

```bash
# Crear directorio para aplicaciones
sudo mkdir -p /opt/apps
sudo chown $USER:$USER /opt/apps
cd /opt/apps

# Clonar repositorio
git clone https://github.com/Snordfish/mvp_printer_manager.git
cd mvp_printer_manager

### 2. Configurar Variables de Entorno

```bash
# Crear archivo .env para producción
cat > .env << 'EOF'
# Database
POSTGRES_DB=printer_fleet_prod
POSTGRES_USER=printer_admin
POSTGRES_PASSWORD=TU_PASSWORD_SEGURA_AQUI_123!

# API
DATABASE_URL=postgresql://printer_admin:TU_PASSWORD_SEGURA_AQUI_123!@db:5432/printer_fleet_prod

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Next.js
NEXT_PUBLIC_API_BASE=http://TU_IP_O_DOMINIO:8000

# Producción
NODE_ENV=production
ENVIRONMENT=production
EOF

# Asegurar permisos del archivo
chmod 600 .env
```

### 3. Configurar Docker Compose para Producción

Crear `docker-compose.prod.yml`:

```bash
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: printer_db_prod
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - printer_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: printer_redis_prod
    restart: unless-stopped
    networks:
      - printer_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: printer_api_prod
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=${REDIS_HOST}
      - ENVIRONMENT=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - printer_network
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: ./web
      dockerfile: Dockerfile.prod
    container_name: printer_web_prod
    environment:
      - NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
      - NODE_ENV=production
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - printer_network
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    container_name: printer_nginx_prod
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deployment/ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - api
    restart: unless-stopped
    networks:
      - printer_network

volumes:
  postgres_data_prod:
    driver: local

networks:
  printer_network:
    driver: bridge
EOF
```

### 4. Crear Dockerfile de Producción para Next.js

```bash
cat > web/Dockerfile.prod << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Build de Next.js para producción
RUN npm run build

# Imagen de producción
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copiar archivos necesarios desde builder
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Exponer puerto
EXPOSE 3000

# Usuario no-root
USER node

# Comando de inicio
CMD ["npm", "start"]
EOF
```

### 5. Configurar NGINX como Reverse Proxy

```bash
mkdir -p deployment

cat > deployment/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server api:8000;
    }

    upstream web_frontend {
        server web:3000;
    }

    # Límite de tasa (rate limiting)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;

    # Configuración de logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Servidor HTTP (redirige a HTTPS)
    server {
        listen 80;
        server_name _;
        
        # Redirigir todo a HTTPS
        return 301 https://$host$request_uri;
    }

    # Servidor HTTPS
    server {
        listen 443 ssl http2;
        server_name tu-dominio.com;  # Cambiar por tu dominio

        # Certificados SSL (cambiar rutas según tu configuración)
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Configuración SSL segura
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Tamaño máximo de carga
        client_max_body_size 50M;

        # Proxy para API
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://api_backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Proxy para documentación de API
        location /docs {
            proxy_pass http://api_backend/docs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Proxy para frontend
        location / {
            limit_req zone=web_limit burst=50 nodelay;
            
            proxy_pass http://web_frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
EOF
```

## Certificados SSL (Opcional pero Recomendado)

### Opción 1: Let's Encrypt (Gratis)

```bash
# Instalar certbot
sudo apt install -y certbot

# Obtener certificado (reemplazar con tu dominio)
sudo certbot certonly --standalone -d tu-dominio.com

# Copiar certificados a la ubicación de NGINX
sudo mkdir -p deployment/ssl
sudo cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem deployment/ssl/cert.pem
sudo cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem deployment/ssl/key.pem
sudo chown $USER:$USER deployment/ssl/*

# Auto-renovación
sudo crontab -e
# Agregar: 0 0 * * * certbot renew --quiet
```

### Opción 2: Certificado Auto-firmado (Solo para Testing)

```bash
mkdir -p deployment/ssl
cd deployment/ssl

# Generar certificado auto-firmado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=AR/ST=BuenosAires/L=BuenosAires/O=YourOrg/CN=tu-dominio.com"

cd ../..
```

## Despliegue

### 1. Build y Levantar Servicios

```bash
# Build de las imágenes
docker compose -f docker-compose.prod.yml build

# Levantar servicios
docker compose -f docker-compose.prod.yml up -d

# Verificar estado
docker compose -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

### 2. Ejecutar Migraciones de Base de Datos

```bash
# Entrar al contenedor de la API
docker exec -it printer_api_prod bash

# Ejecutar migraciones (si las tienes configuradas)
# python -m alembic upgrade head

# O crear las tablas manualmente
python -c "from app.db import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"

# Salir
exit
```

### 3. Verificar Servicios

```bash
# Verificar que todos los contenedores estén corriendo
docker ps

# Probar API
curl http://localhost:8000/health
curl http://localhost:8000/docs

# Probar Frontend
curl http://localhost:3000

# Verificar logs
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs web
```

## Configurar Systemd para Auto-inicio

### 1. Crear Service File

```bash
sudo cat > /etc/systemd/system/printer-manager.service << 'EOF'
[Unit]
Description=Printer Fleet Manager
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/apps/mvp_printer_manager
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
User=tu-usuario
Group=tu-usuario

[Install]
WantedBy=multi-user.target
EOF

# Cambiar tu-usuario por tu usuario actual
sudo sed -i "s/tu-usuario/$USER/g" /etc/systemd/system/printer-manager.service
```

### 2. Habilitar Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar servicio
sudo systemctl enable printer-manager

# Iniciar servicio
sudo systemctl start printer-manager

# Verificar estado
sudo systemctl status printer-manager
```

## Backups Automatizados

### 1. Script de Backup

```bash
mkdir -p /opt/apps/backups

cat > /opt/apps/backups/backup.sh << 'EOF'
#!/bin/bash

# Configuración
BACKUP_DIR="/opt/apps/backups"
APP_DIR="/opt/apps/mvp_printer_manager"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Crear directorio de backup del día
mkdir -p "$BACKUP_DIR/$DATE"

# Backup de base de datos
docker exec printer_db_prod pg_dump -U printer_admin printer_fleet_prod | gzip > "$BACKUP_DIR/$DATE/database.sql.gz"

# Backup de archivos de configuración
cp "$APP_DIR/.env" "$BACKUP_DIR/$DATE/env.backup"
cp -r "$APP_DIR/deployment" "$BACKUP_DIR/$DATE/"

# Comprimir todo
cd "$BACKUP_DIR"
tar -czf "backup_$DATE.tar.gz" "$DATE"
rm -rf "$DATE"

# Eliminar backups antiguos
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completado: backup_$DATE.tar.gz"
EOF

chmod +x /opt/apps/backups/backup.sh
```

### 2. Configurar Cron para Backups

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 2 AM
# 0 2 * * * /opt/apps/backups/backup.sh >> /opt/apps/backups/backup.log 2>&1
```

## Monitoreo y Logs

### 1. Ver Logs en Tiempo Real

```bash
# Todos los servicios
docker compose -f docker-compose.prod.yml logs -f

# Solo API
docker compose -f docker-compose.prod.yml logs -f api

# Solo Web
docker compose -f docker-compose.prod.yml logs -f web

# Solo Base de Datos
docker compose -f docker-compose.prod.yml logs -f db
```

### 2. Monitoreo de Recursos

```bash
# Ver uso de recursos
docker stats

# Ver espacio en disco
df -h

# Ver uso de volúmenes Docker
docker system df
```

## Actualización de la Aplicación

### 1. Pull de Cambios

```bash
cd /opt/apps/mvp_printer_manager

# Hacer backup antes de actualizar
/opt/apps/backups/backup.sh

# Pull de cambios
git pull origin main

# Rebuild y restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verificar logs
docker compose -f docker-compose.prod.yml logs -f
```

### 2. Rollback (si es necesario)

```bash
# Detener servicios
docker compose -f docker-compose.prod.yml down

# Volver a versión anterior
git checkout <commit-hash-anterior>

# Rebuild
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Problema: Contenedores no inician

```bash
# Ver logs detallados
docker compose -f docker-compose.prod.yml logs

# Verificar estado de salud
docker compose -f docker-compose.prod.yml ps

# Reiniciar servicio específico
docker compose -f docker-compose.prod.yml restart api
```

### Problema: Base de datos no conecta

```bash
# Verificar que PostgreSQL esté corriendo
docker exec printer_db_prod pg_isready

# Probar conexión
docker exec -it printer_db_prod psql -U printer_admin -d printer_fleet_prod

# Verificar variables de entorno
docker exec printer_api_prod env | grep DATABASE
```

### Problema: Puerto en uso

```bash
# Ver qué proceso usa el puerto
sudo netstat -tulpn | grep :8000

# Matar proceso si es necesario
sudo kill -9 <PID>
```

## Seguridad Adicional

### 1. Configurar Fail2ban

```bash
# Instalar fail2ban
sudo apt install -y fail2ban

# Configurar para proteger SSH y NGINX
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
maxretry = 5
EOF

sudo systemctl restart fail2ban
```

### 2. Actualizar Regularmente

```bash
# Crear script de actualización
cat > /opt/apps/update_system.sh << 'EOF'
#!/bin/bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
docker image prune -af
EOF

chmod +x /opt/apps/update_system.sh

# Agregar a cron (semanal)
# crontab -e
# 0 3 * * 0 /opt/apps/update_system.sh
```

## Checklist de Despliegue

- [ ] Servidor VMware configurado
- [ ] Docker y Docker Compose instalados
- [ ] Firewall configurado
- [ ] Repositorio clonado
- [ ] Variables de entorno configuradas
- [ ] Certificados SSL configurados
- [ ] docker-compose.prod.yml creado
- [ ] NGINX configurado
- [ ] Servicios levantados
- [ ] Migraciones ejecutadas
- [ ] Systemd configurado
- [ ] Backups automatizados
- [ ] Monitoreo funcionando
- [ ] Pruebas de conectividad OK
- [ ] Documentación actualizada

## Comandos Útiles Rápidos

```bash
# Estado de servicios
docker compose -f docker-compose.prod.yml ps

# Reiniciar todo
docker compose -f docker-compose.prod.yml restart

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Backup manual
/opt/apps/backups/backup.sh

# Actualizar aplicación
cd /opt/apps/mvp_printer_manager && git pull && docker compose -f docker-compose.prod.yml up -d --build

# Limpiar recursos no usados
docker system prune -a --volumes
```

## Soporte y Contacto

Para problemas o consultas:
- GitHub Issues: https://github.com/Snordfish/mvp_printer_manager/issues
- Documentación: `/opt/apps/mvp_printer_manager/docs/`
