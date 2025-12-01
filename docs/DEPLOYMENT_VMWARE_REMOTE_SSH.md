**Guía completa paso a paso para desplegar Printer Fleet Manager en un servidor VMware usando VS Code Remote-SSH**

---

## 📋 Requisitos Previos

### En el Servidor VMware (Ubuntu Server)
- Ubuntu Server 20.04 LTS o superior
- Acceso SSH habilitado
- Usuario con permisos sudo
- Mínimo 4GB RAM, 20GB disco
- Puertos abiertos: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8000 (API)

### En tu PC Local (Windows)
- VS Code instalado
- Git for Windows (incluye SSH)
- Acceso a la red del servidor

---

## 🔧 PARTE 1: Configuración Inicial del Servidor VMware

### 1.1 Preparar el Servidor Ubuntu

**Conectarse al servidor por primera vez:**
```bash
# Desde PowerShell en tu PC
ssh usuario@IP_DEL_SERVIDOR

# Ejemplo:
ssh admin@192.168.1.100
```

**Actualizar el sistema:**
```bash
sudo apt update && sudo apt upgrade -y
```

**Instalar dependencias necesarias:**
```bash
# Git
sudo apt install git -y

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt install docker-compose -y

# Herramientas adicionales
sudo apt install curl wget nano htop net-tools -y
```

**Verificar instalaciones:**
```bash
docker --version
docker-compose --version
git --version
```

**Reiniciar sesión para aplicar permisos de Docker:**
```bash
exit
# Volver a conectar
ssh usuario@IP_DEL_SERVIDOR
```

---

## 🔐 PARTE 2: Configurar SSH sin Contraseña

### 2.1 Generar Claves SSH en tu PC

**Abrir PowerShell y generar la clave:**
```powershell
# Generar clave SSH moderna y segura
ssh-keygen -t ed25519 -C "tu_email@ejemplo.com"

# Presionar Enter para ubicación por defecto:
# C:\Users\TU_USUARIO\.ssh\id_ed25519

# Puedes poner contraseña o dejar vacío (Enter)
```

### 2.2 Copiar la Clave al Servidor

**Opción A - Usando ssh-copy-id (Git Bash):**
```bash
# Abrir Git Bash (no PowerShell)
ssh-copy-id usuario@IP_DEL_SERVIDOR
```

**Opción B - Manual (PowerShell):**
```powershell
# 1. Ver tu clave pública
type $env:USERPROFILE\.ssh\id_ed25519.pub

# 2. Copiar todo el contenido que aparece

# 3. Conectarse al servidor
ssh usuario@IP_DEL_SERVIDOR

# 4. En el servidor, crear directorio SSH
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 5. Agregar tu clave
nano ~/.ssh/authorized_keys
# Pegar la clave pública copiada
# Ctrl+O para guardar, Enter, Ctrl+X para salir

# 6. Configurar permisos
chmod 600 ~/.ssh/authorized_keys

# 7. Salir
exit
```

### 2.3 Probar Conexión sin Contraseña

```powershell
# Desde PowerShell en tu PC
ssh usuario@IP_DEL_SERVIDOR

# Debería conectar sin pedir contraseña
```

---

## 🖥️ PARTE 3: Configurar VS Code Remote-SSH

### 3.1 Instalar Extensión Remote-SSH

1. **Abrir VS Code**
2. **Ir a Extensions** (Ctrl+Shift+X)
3. **Buscar:** `Remote - SSH`
4. **Instalar** la extensión de Microsoft

![Remote SSH Extension](https://code.visualstudio.com/assets/docs/remote/ssh/ssh-extension.png)

### 3.2 Configurar Conexión SSH

**Método A - Conexión Rápida:**

1. Presionar `F1` o `Ctrl+Shift+P`
2. Escribir: `Remote-SSH: Connect to Host...`
3. Seleccionar `+ Add New SSH Host...`
4. Ingresar: `usuario@IP_DEL_SERVIDOR`
5. Ejemplo: `admin@192.168.1.100`
6. Seleccionar archivo de configuración: `C:\Users\TU_USUARIO\.ssh\config`

**Método B - Editar Configuración Manualmente:**

1. Presionar `F1`
2. Escribir: `Remote-SSH: Open SSH Configuration File...`
3. Seleccionar: `C:\Users\TU_USUARIO\.ssh\config`
4. Agregar:

```ssh
Host printer-manager-prod
    HostName 192.168.1.100
    User admin
    Port 22
    IdentityFile C:\Users\TU_USUARIO\.ssh\id_ed25519
    ForwardAgent yes
```

5. Guardar (Ctrl+S)

### 3.3 Conectarse al Servidor

1. **Click en el ícono verde** en la esquina inferior izquierda de VS Code
2. Seleccionar `Connect to Host...`
3. Elegir `printer-manager-prod` (o tu configuración)
4. **VS Code instalará su servidor remoto** (primera vez toma 1-2 minutos)
5. **Listo!** Ahora estás conectado al servidor

**Verificación:**
- Esquina inferior izquierda debe decir: `SSH: printer-manager-prod`
- La terminal integrada es ahora del servidor Ubuntu

---

## 📦 PARTE 4: Clonar y Configurar el Proyecto

### 4.1 Preparar Directorio en el Servidor

**Desde la terminal de VS Code (ya conectado remotamente):**

```bash
# Crear directorio para aplicaciones
sudo mkdir -p /opt/printer-manager
sudo chown $USER:$USER /opt/printer-manager
cd /opt/printer-manager
```

### 4.2 Clonar el Repositorio

**Opción A - Usando Git Clone (si el repo es público):**
```bash
git clone https://github.com/TU_USUARIO/mvp_printer_manager.git
cd mvp_printer_manager
```

**Opción B - Copiar archivos locales al servidor:**

Desde tu PC local (PowerShell):
```powershell
# Comprimir proyecto local (excluir node_modules, .next, etc)
# En el directorio del proyecto
git archive --format=zip --output=proyecto.zip HEAD

# Copiar al servidor
scp proyecto.zip usuario@IP_DEL_SERVIDOR:/opt/printer-manager/

# Conectarse y descomprimir
ssh usuario@IP_DEL_SERVIDOR
cd /opt/printer-manager
unzip proyecto.zip -d mvp_printer_manager
cd mvp_printer_manager
```

**Opción C - Desde VS Code Remote (RECOMENDADO):**

1. En VS Code conectado remotamente
2. `File` → `Open Folder...`
3. Navegar a `/opt/printer-manager`
4. Crear nueva carpeta: `mvp_printer_manager`
5. Abrir terminal integrada (Ctrl+`)
6. Clonar o inicializar git:

```bash
# Si tienes el repo en GitHub
git clone https://github.com/TU_USUARIO/mvp_printer_manager.git .

# O inicializar nuevo repo
git init
git remote add origin https://github.com/TU_USUARIO/mvp_printer_manager.git
git pull origin main
```

---

## ⚙️ PARTE 5: Configurar Variables de Entorno para Producción

### 5.1 Crear Archivo de Configuración

```bash
# En /opt/printer-manager/mvp_printer_manager/
nano .env.production
```

### 5.2 Configuración de Producción

```bash
# ============================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ============================================

# Node Environment
NODE_ENV=production

# API Configuration
NEXT_PUBLIC_API_BASE=http://IP_DEL_SERVIDOR:8000

# Database Configuration
POSTGRES_USER=printer_admin
POSTGRES_PASSWORD=TuPasswordSegura123!
POSTGRES_DB=printer_fleet_db
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Security
SECRET_KEY=genera_una_clave_secreta_muy_larga_y_aleatoria_aqui
ALLOWED_HOSTS=IP_DEL_SERVIDOR,localhost,127.0.0.1

# CORS Origins (separados por coma)
CORS_ORIGINS=http://IP_DEL_SERVIDOR,http://IP_DEL_SERVIDOR:3000

# Logging
LOG_LEVEL=INFO

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Diario a las 2 AM

# Email (opcional, para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASSWORD=tu_app_password
SMTP_FROM=noreply@tuempresa.com
```

**Generar SECRET_KEY segura:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## 🐋 PARTE 6: Configurar Docker para Producción

### 6.1 Crear docker-compose.production.yml

```bash
nano docker-compose.production.yml
```

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: printer_manager_db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - printer_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: printer_manager_redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - printer_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: 
      context: ./api
      dockerfile: Dockerfile
    container_name: printer_manager_api
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./api:/app
      - api_logs:/app/logs
    networks:
      - printer_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  web:
    build:
      context: ./web
      dockerfile: Dockerfile.production
      args:
        - NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
    container_name: printer_manager_web
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      - api
    networks:
      - printer_network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: printer_manager_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deployment/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deployment/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - web
      - api
    networks:
      - printer_network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  api_logs:
    driver: local
  nginx_logs:
    driver: local

networks:
  printer_network:
    driver: bridge
```

### 6.2 Crear Dockerfile de Producción para Next.js

```bash
nano web/Dockerfile.production
```

```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 6.3 Configurar next.config.js para Standalone

```bash
nano web/next.config.js
```

Agregar:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    esmExternals: true,
  },
  // ... resto de configuración
}

module.exports = nextConfig
```

---

## 🌐 PARTE 7: Configurar Nginx como Reverse Proxy

### 7.1 Crear Configuración de Nginx

```bash
mkdir -p deployment/ssl
nano deployment/nginx.conf
```

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;

    # Upstream servers
    upstream api_backend {
        server api:8000 max_fails=3 fail_timeout=30s;
    }

    upstream web_backend {
        server web:3000 max_fails=3 fail_timeout=30s;
    }

    # HTTP Server
    server {
        listen 80;
        server_name _;

        # Redirect to HTTPS (descomenta cuando tengas SSL)
        # return 301 https://$server_name$request_uri;

        client_max_body_size 20M;

        # Frontend
        location / {
            limit_req zone=web_limit burst=20 nodelay;
            proxy_pass http://web_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api {
            limit_req zone=api_limit burst=5 nodelay;
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS headers
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
            
            if ($request_method = 'OPTIONS') {
                return 204;
            }
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }

    # HTTPS Server (opcional, para cuando tengas certificado SSL)
    # server {
    #     listen 443 ssl http2;
    #     server_name _;
    #
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #
    #     # Resto de configuración igual que HTTP
    # }
}
```

---

## 🚀 PARTE 8: Desplegar la Aplicación

### 8.1 Construcción Inicial

**Desde la terminal de VS Code (conectado al servidor):**

```bash
# Asegurarse de estar en el directorio correcto
cd /opt/printer-manager/mvp_printer_manager

# Cargar variables de entorno
export $(cat .env.production | xargs)

# Construir imágenes
docker-compose -f docker-compose.production.yml build --no-cache

# Esto tomará varios minutos la primera vez
```

### 8.2 Iniciar Servicios

```bash
# Levantar todos los servicios
docker-compose -f docker-compose.production.yml up -d

# Ver logs en tiempo real
docker-compose -f docker-compose.production.yml logs -f

# Ver estado de servicios
docker-compose -f docker-compose.production.yml ps
```

### 8.3 Verificar Despliegue

```bash
# Ver todos los contenedores
docker ps

# Verificar salud de servicios
docker-compose -f docker-compose.production.yml ps

# Ver logs específicos
docker logs printer_manager_web
docker logs printer_manager_api
docker logs printer_manager_nginx

# Verificar conectividad
curl http://localhost/health
curl http://localhost/api/health
```

### 8.4 Acceder a la Aplicación

**Desde tu navegador:**
```
http://IP_DEL_SERVIDOR
```

**Endpoints disponibles:**
- Frontend: `http://IP_DEL_SERVIDOR`
- API Docs: `http://IP_DEL_SERVIDOR/api/docs`
- Health Check: `http://IP_DEL_SERVIDOR/health`

---

## 🔄 PARTE 9: Actualizar la Aplicación (Despliegue Continuo)

### 9.1 Desde VS Code Remoto

1. **Abrir terminal integrada** (Ctrl+`)
2. **Actualizar código:**

```bash
# Pull últimos cambios
git pull origin main

# Reconstruir servicios modificados
docker-compose -f docker-compose.production.yml build web api

# Reiniciar servicios
docker-compose -f docker-compose.production.yml up -d

# Ver logs
docker-compose -f docker-compose.production.yml logs -f web api
```

### 9.2 Script de Actualización Automática

```bash
nano deployment/update.sh
```

```bash
#!/bin/bash

echo "🔄 Actualizando Printer Fleet Manager..."

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directorio del proyecto
cd /opt/printer-manager/mvp_printer_manager

# Pull cambios
echo -e "${BLUE}📥 Descargando cambios...${NC}"
git pull origin main

# Backup de base de datos
echo -e "${BLUE}💾 Creando backup de base de datos...${NC}"
docker-compose -f docker-compose.production.yml exec -T db \
    pg_dump -U printer_admin printer_fleet_db > backups/db_backup_$(date +%Y%m%d_%H%M%S).sql

# Reconstruir
echo -e "${BLUE}🏗️  Reconstruyendo servicios...${NC}"
docker-compose -f docker-compose.production.yml build

# Reiniciar servicios (con zero-downtime)
echo -e "${BLUE}🔄 Reiniciando servicios...${NC}"
docker-compose -f docker-compose.production.yml up -d --force-recreate

# Limpiar imágenes antiguas
echo -e "${BLUE}🧹 Limpiando imágenes antiguas...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Actualización completada!${NC}"
echo -e "${GREEN}🌐 Aplicación disponible en: http://$(hostname -I | awk '{print $1}')${NC}"
```

**Dar permisos de ejecución:**
```bash
chmod +x deployment/update.sh

# Ejecutar actualización
./deployment/update.sh
```

---

## 📊 PARTE 10: Monitoreo y Mantenimiento

### 10.1 Ver Logs desde VS Code

**Extensiones útiles:**
- Docker (Microsoft)
- Remote - SSH (Microsoft)
- GitLens

**Ver logs en tiempo real:**
```bash
# Todos los servicios
docker-compose -f docker-compose.production.yml logs -f

# Servicio específico
docker-compose -f docker-compose.production.yml logs -f web

# Últimas 100 líneas
docker-compose -f docker-compose.production.yml logs --tail=100 api
```

### 10.2 Monitoreo de Recursos

```bash
# Ver uso de recursos
docker stats

# Ver espacio en disco
df -h

# Ver uso de memoria
free -h

# Ver procesos
htop
```

### 10.3 Backup Automático

```bash
nano deployment/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/opt/printer-manager/mvp_printer_manager/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio de backups
mkdir -p $BACKUP_DIR

# Backup de base de datos
docker-compose -f docker-compose.production.yml exec -T db \
    pg_dump -U printer_admin printer_fleet_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup de archivos de configuración
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env.production docker-compose.production.yml deployment/

# Eliminar backups antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "✅ Backup completado: $BACKUP_DIR"
```

**Configurar cron para backups automáticos:**
```bash
crontab -e

# Agregar línea (backup diario a las 2 AM):
0 2 * * * /opt/printer-manager/mvp_printer_manager/deployment/backup.sh >> /opt/printer-manager/mvp_printer_manager/logs/backup.log 2>&1
```

---

## 🔒 PARTE 11: Seguridad Adicional

### 11.1 Configurar Firewall

```bash
# Instalar UFW
sudo apt install ufw -y

# Configurar reglas
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Habilitar firewall
sudo ufw enable

# Ver estado
sudo ufw status
```

### 11.2 Configurar Fail2Ban (Protección SSH)

```bash
# Instalar
sudo apt install fail2ban -y

# Configurar
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
```

```bash
# Reiniciar servicio
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

---

## 📝 PARTE 12: Comandos Útiles para el Día a Día

### Desde VS Code Terminal (Remoto)

```bash
# Ver estado de servicios
docker-compose -f docker-compose.production.yml ps

# Reiniciar un servicio específico
docker-compose -f docker-compose.production.yml restart web

# Ver logs en vivo
docker-compose -f docker-compose.production.yml logs -f

# Entrar a un contenedor
docker exec -it printer_manager_web sh
docker exec -it printer_manager_api bash

# Ejecutar migraciones de BD
docker-compose -f docker-compose.production.yml exec api alembic upgrade head

# Limpiar volúmenes y reconstruir (CUIDADO: elimina datos)
docker-compose -f docker-compose.production.yml down -v
docker-compose -f docker-compose.production.yml up -d --build

# Ver uso de espacio
docker system df

# Limpiar todo no utilizado
docker system prune -a
```

---

## 🆘 PARTE 13: Troubleshooting

### Problema: No puedo conectarme por SSH desde VS Code

**Solución:**
```powershell
# En PowerShell local
ssh -v usuario@IP_DEL_SERVIDOR

# Verificar que funcione manualmente primero
# Luego verificar archivo config SSH:
code $env:USERPROFILE\.ssh\config
```

### Problema: Docker no inicia

```bash
# Ver estado de Docker
sudo systemctl status docker

# Reiniciar Docker
sudo systemctl restart docker

# Ver logs
sudo journalctl -u docker -n 50
```

### Problema: Aplicación no responde

```bash
# Ver todos los contenedores
docker ps -a

# Ver logs de error
docker-compose -f docker-compose.production.yml logs --tail=50

# Reiniciar todos los servicios
docker-compose -f docker-compose.production.yml restart
```

### Problema: Base de datos corrupta

```bash
# Restaurar desde backup
gunzip -c backups/db_20250129_020000.sql.gz | \
docker-compose -f docker-compose.production.yml exec -T db \
psql -U printer_admin printer_fleet_db
```

---

## ✅ Checklist Final de Despliegue

- [ ] Servidor Ubuntu configurado con Docker
- [ ] SSH sin contraseña configurado
- [ ] VS Code Remote-SSH conectado
- [ ] Repositorio clonado en `/opt/printer-manager/mvp_printer_manager`
- [ ] Archivo `.env.production` configurado
- [ ] Docker Compose funcionando
- [ ] Nginx configurado
- [ ] Aplicación accesible desde navegador
- [ ] Backups automáticos configurados
- [ ] Firewall configurado
- [ ] Monitoreo activo
- [ ] Script de actualización probado

---

## 🎯 Resumen de URLs y Puertos

| Servicio | URL Local (Servidor) | URL Externa | Puerto |
|----------|---------------------|-------------|---------|
| Frontend | http://localhost:3000 | http://IP_DEL_SERVIDOR | 80 |
| API | http://localhost:8000 | http://IP_DEL_SERVIDOR/api | 8000 |
| API Docs | http://localhost:8000/docs | http://IP_DEL_SERVIDOR/api/docs | 8000 |
| PostgreSQL | localhost:5432 | - | 5432 |
| Redis | localhost:6379 | - | 6379 |
| Nginx | localhost:80 | http://IP_DEL_SERVIDOR | 80 |

---

## 📚 Recursos Adicionales

- [Documentación VS Code Remote-SSH](https://code.visualstudio.com/docs/remote/ssh)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Última actualización:** 29 de Noviembre 2025  
**Versión:** 1.0  
**Autor:** Printer Fleet Manager Team
