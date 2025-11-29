# Guía de Despliegue Rápido - Servidor 10.10.10.193

**Servidor:** Ubuntu 22.04 en VMware  
**IP:** 10.10.10.193  
**Usuario:** im  
**Contraseña:** Imsa2025

---

## 📋 Requisitos Previos

Esta guía asume que tienes:
- VS Code instalado en tu máquina local (Windows)
- Extensión Remote-SSH instalada en VS Code
- Conexión a la red donde está el servidor (10.10.10.193)

---

## 🚀 Paso 1: Conectar al Servidor con VS Code Remote-SSH

### 1.1 Abrir VS Code
1. Abre Visual Studio Code
2. Presiona `F1` o `Ctrl+Shift+P`
3. Escribe `Remote-SSH: Connect to Host...`

### 1.2 Agregar Configuración SSH
1. Selecciona `+ Add New SSH Host...`
2. Ingresa: `ssh im@10.10.10.193`
3. Selecciona el archivo de configuración (normalmente `C:\Users\tu_usuario\.ssh\config`)

### 1.3 Conectar
1. Presiona `F1` nuevamente
2. Escribe `Remote-SSH: Connect to Host...`
3. Selecciona `im@10.10.10.193`
4. Cuando te pida la contraseña, ingresa: `Imsa2025`
5. Espera a que VS Code se conecte al servidor

**Nota:** La primera conexión puede tardar mientras VS Code instala el servidor remoto.

---

## 🔧 Paso 2: Instalar Docker y Docker Compose

Una vez conectado al servidor mediante VS Code:

### 2.1 Abrir Terminal en VS Code
1. En VS Code conectado al servidor, presiona `` Ctrl+` `` (backtick)
2. Se abrirá una terminal que está corriendo en el servidor Ubuntu

### 2.2 Actualizar el Sistema
```bash
sudo apt update
sudo apt upgrade -y
```

### 2.3 Instalar Docker
```bash
# Instalar dependencias
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Agregar repositorio de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Aplicar cambios de grupo
newgrp docker

# Verificar instalación
docker --version
```

### 2.4 Instalar Docker Compose
```bash
# Descargar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Dar permisos de ejecución
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalación
docker compose version
```

---

## 📦 Paso 3: Clonar el Proyecto

### 3.1 Instalar Git (si no está instalado)
```bash
sudo apt install -y git
```

### 3.2 Clonar el Repositorio
```bash
# Ir al directorio home
cd ~

# Clonar el proyecto
git clone https://github.com/Snordfish/mvp_printer_manager.git

# Entrar al directorio
cd mvp_printer_manager
```

### 3.3 Abrir el Proyecto en VS Code
1. En VS Code, ve a `File > Open Folder...`
2. Navega a `/home/im/mvp_printer_manager`
3. Haz clic en `OK`

---

## ⚙️ Paso 4: Configurar Variables de Entorno

El archivo `.env.production` ya está creado en tu repositorio local. Ahora necesitas copiarlo al servidor:

### Opción A: Copiar desde tu máquina local
1. En tu VS Code local (conectado al servidor), ve al archivo `.env.production`
2. Verifica que tenga el contenido correcto (ya está configurado con IP 10.10.10.193)

### Opción B: Verificar en el servidor
```bash
# Ver el contenido del archivo
cat .env.production
```

Debería mostrar la configuración con IP `10.10.10.193` y contraseña `admin123`.

---

## 🐳 Paso 5: Desplegar la Aplicación

### 5.1 Navegar al Directorio de Deployment
```bash
cd ~/mvp_printer_manager/deployment
```

### 5.2 Dar Permisos al Script de Despliegue
```bash
chmod +x deploy.sh
```

### 5.3 Ejecutar el Despliegue
```bash
./deploy.sh
```

**El script hará automáticamente:**
- ✅ Verificar Docker y Docker Compose
- ✅ Verificar archivo .env.production
- ✅ Detener contenedores existentes
- ✅ Crear directorios necesarios
- ✅ Construir imágenes Docker
- ✅ Iniciar todos los servicios
- ✅ Verificar que todo esté funcionando
- ✅ Te preguntará si quieres configurar el firewall

**Cuando pregunte por el firewall, responde `s` (sí).**

### 5.4 Esperar a que Complete
El proceso tomará entre 5-10 minutos dependiendo de la velocidad del servidor.

---

## 🔍 Paso 6: Verificar el Despliegue

### 6.1 Verificar Contenedores
```bash
docker compose -f docker-compose.prod.yml ps
```

Deberías ver 5 contenedores corriendo:
- `printer_fleet_db` (PostgreSQL)
- `printer_fleet_redis` (Redis)
- `printer_fleet_api` (FastAPI)
- `printer_fleet_web` (Next.js)
- `printer_fleet_nginx` (Nginx)

### 6.2 Ver Logs
```bash
# Ver todos los logs
docker compose -f docker-compose.prod.yml logs -f

# Ver logs específicos
docker compose -f docker-compose.prod.yml logs web -f
docker compose -f docker-compose.prod.yml logs api -f
```

Presiona `Ctrl+C` para salir de los logs.

### 6.3 Probar la Aplicación

**Desde el servidor:**
```bash
curl http://localhost/health
curl http://localhost/api/health
```

**Desde tu navegador (en Windows):**
1. Abre un navegador
2. Ve a: `http://10.10.10.193`
3. Deberías ver la aplicación Printer Fleet Manager

---

## 🔥 Paso 7: Configurar Firewall (Importante)

Si el script no configuró el firewall automáticamente:

```bash
# Permitir SSH (¡IMPORTANTE! No te bloquees)
sudo ufw allow 22/tcp

# Permitir HTTP
sudo ufw allow 80/tcp

# Habilitar firewall
sudo ufw enable

# Verificar estado
sudo ufw status verbose
```

---

## 📊 Comandos Útiles

### Ver Estado de Contenedores
```bash
cd ~/mvp_printer_manager/deployment
docker compose -f docker-compose.prod.yml ps
```

### Ver Logs en Tiempo Real
```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Reiniciar un Servicio Específico
```bash
docker compose -f docker-compose.prod.yml restart web
docker compose -f docker-compose.prod.yml restart api
```

### Reiniciar Todos los Servicios
```bash
docker compose -f docker-compose.prod.yml restart
```

### Detener Todo
```bash
docker compose -f docker-compose.prod.yml down
```

### Iniciar Todo
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Ver Uso de Recursos
```bash
docker stats
```

### Limpiar Espacio (Cuidado)
```bash
# Limpiar contenedores detenidos
docker container prune -f

# Limpiar imágenes no usadas
docker image prune -a -f

# Limpiar todo (¡CUIDADO! Borra todo lo no usado)
docker system prune -a --volumes -f
```

---

## 🔄 Paso 8: Actualizar la Aplicación

Cuando hagas cambios en el código:

### 8.1 Hacer Pull de los Cambios
```bash
cd ~/mvp_printer_manager
git pull origin main
```

### 8.2 Reconstruir y Reiniciar
```bash
cd deployment
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

O simplemente ejecuta el script de despliegue nuevamente:
```bash
./deploy.sh
```

---

## 🛠️ Solución de Problemas

### Problema: No puedo conectarme con VS Code
**Solución:**
1. Verifica que el servidor esté encendido
2. Haz ping al servidor: `ping 10.10.10.193`
3. Verifica que el firewall permita SSH (puerto 22)

### Problema: Docker dice "permission denied"
**Solución:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Problema: El contenedor web o api no inicia
**Solución:**
```bash
# Ver logs detallados
docker compose -f docker-compose.prod.yml logs web
docker compose -f docker-compose.prod.yml logs api

# Reconstruir sin cache
docker compose -f docker-compose.prod.yml build --no-cache web
docker compose -f docker-compose.prod.yml up -d
```

### Problema: No puedo acceder desde el navegador
**Solución:**
1. Verifica que el firewall permita el puerto 80:
```bash
sudo ufw status
sudo ufw allow 80/tcp
```

2. Verifica que nginx esté corriendo:
```bash
docker compose -f docker-compose.prod.yml ps nginx
```

3. Verifica conectividad desde el servidor:
```bash
curl http://localhost/health
```

### Problema: La base de datos no se conecta
**Solución:**
```bash
# Ver logs de PostgreSQL
docker compose -f docker-compose.prod.yml logs db

# Reiniciar base de datos
docker compose -f docker-compose.prod.yml restart db

# Verificar que el contenedor esté healthy
docker compose -f docker-compose.prod.yml ps
```

---

## 📝 Checklist de Despliegue

- [ ] VS Code con Remote-SSH instalado
- [ ] Conectado al servidor 10.10.10.193
- [ ] Docker instalado
- [ ] Docker Compose instalado
- [ ] Proyecto clonado desde GitHub
- [ ] Archivo .env.production configurado
- [ ] Script deploy.sh ejecutado exitosamente
- [ ] Firewall configurado (puertos 22 y 80)
- [ ] Todos los contenedores corriendo (5 contenedores)
- [ ] Aplicación accesible en http://10.10.10.193
- [ ] API accesible en http://10.10.10.193/api

---

## 🎯 URLs Importantes

- **Aplicación Web:** http://10.10.10.193
- **API:** http://10.10.10.193/api
- **Health Check:** http://10.10.10.193/health
- **Documentación API:** http://10.10.10.193/api/docs

---

## 📞 Siguiente Paso

Una vez que todo esté funcionando, puedes:
1. **Agregar impresoras** mediante la interfaz web
2. **Configurar el polling automático** para monitoreo
3. **Configurar backups automáticos** de la base de datos
4. **Configurar monitoreo** con herramientas adicionales

---

## ⚠️ Notas Importantes

1. **Contraseña de producción:** Cambia `admin123` por una contraseña más segura en el archivo `.env.production`
2. **Backups:** Configura backups automáticos de PostgreSQL
3. **SSL/HTTPS:** Para producción seria, considera agregar certificado SSL
4. **Monitoreo:** Implementa herramientas de monitoreo (Prometheus, Grafana)
5. **Logs:** Configura rotación de logs para evitar llenar el disco

---

**¿Problemas?** Revisa los logs con `docker compose -f docker-compose.prod.yml logs -f`
