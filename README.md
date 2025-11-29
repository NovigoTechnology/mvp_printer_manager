# 🖨️ Printer Fleet Manager

Sistema integral de gestión de flota de impresoras con monitoreo SNMP en tiempo real, análisis de uso y gestión de contratos.

## ✨ Características

- **📊 Dashboard Analytics**: Visualización de métricas y estadísticas en tiempo real
- **🔍 Monitoreo SNMP**: Soporte para HP, OKI, Brother, Ricoh, Lexmark y impresoras genéricas
- **📝 Gestión de Incidentes**: Sistema completo de tickets y seguimiento
- **📈 Reportes de Uso**: Análisis detallado con gráficos interactivos
- **💰 Contratos y Facturación**: Gestión de arrendamiento y costos por copia
- **🌐 Multi-moneda**: Soporte ARS/USD con tasas de cambio automáticas
- **📦 Gestión de Inventario**: Control de stock de insumos
- **🔐 Autenticación**: Sistema seguro de usuarios y permisos
- **⚡ Polling Automático**: Recolección programada de datos desde impresoras

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|-----------|------------|
| **Backend** | FastAPI + Python 3.11 |
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **Base de Datos** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Estilos** | Tailwind CSS |
| **Gráficos** | Recharts |
| **Infraestructura** | Docker + Docker Compose |
| **Web Server** | Nginx (producción) |

## 📁 Estructura del Proyecto

```
printer-fleet-manager/
├── 📂 api/                    # Backend FastAPI
│   ├── app/                   # Código de la aplicación
│   │   ├── routers/          # Endpoints REST
│   │   ├── services/         # Lógica de negocio
│   │   ├── workers/          # Tareas en background
│   │   ├── migrations/       # Migraciones de BD
│   │   ├── models.py         # Modelos SQLAlchemy
│   │   ├── db.py             # Configuración BD
│   │   └── main.py           # Punto de entrada
│   ├── tests/                # Tests unitarios
│   ├── Dockerfile
│   └── requirements.txt
│
├── 📂 web/                    # Frontend Next.js
│   ├── app/                  # App Router (páginas)
│   │   ├── page.tsx         # Dashboard
│   │   ├── printers/        # Gestión de impresoras
│   │   ├── counters/        # Contadores mensuales
│   │   ├── contracts/       # Contratos
│   │   ├── billing/         # Facturación
│   │   ├── incidents/       # Incidentes
│   │   ├── stock/           # Inventario
│   │   ├── medical-printers/# Impresoras médicas
│   │   └── exchange-rates/  # Tasas de cambio
│   ├── components/          # Componentes reutilizables
│   ├── types/               # Tipos TypeScript
│   ├── public/              # Assets estáticos
│   ├── Dockerfile
│   └── package.json
│
├── 📂 deployment/            # Archivos de producción
│   ├── docker-compose.prod.yml
│   ├── nginx.conf
│   ├── printer-manager.service
│   └── README.md
│
├── 📂 scripts/               # Scripts de utilidad
│   ├── migration_*.py       # Scripts de migración
│   ├── setup_*.py           # Scripts de configuración
│   └── README.md
│
├── 📂 docs/                  # Documentación técnica
│   ├── DESIGN_SYSTEM.md
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── MEDICAL_PRINTER_FLOW.md
│   ├── DESCUBRIMIENTO_IMPRESORAS_MEDICAS.md
│   └── ...más documentación
│
├── 📂 archive/               # Archivos de desarrollo (no en git)
│   ├── html_samples/        # Muestras HTML de DRYPIX
│   ├── test_scripts/        # Scripts de prueba
│   ├── exploration_scripts/ # Scripts de exploración
│   └── README.md
│
├── docker-compose.yml       # Desarrollo local
├── .env.example            # Variables de entorno ejemplo
├── .gitignore
└── README.md
```

## 🚀 Inicio Rápido

## 🚀 Inicio Rápido

### Prerequisitos
- Docker & Docker Compose
- Git

### Instalación

1. **Clonar el repositorio:**
```bash
git clone <repository-url>
cd printer-fleet-manager
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. **Construir y levantar servicios:**
```bash
docker compose build
docker compose up -d
```

4. **Acceder a la aplicación:**
- 🌐 Web UI: http://localhost:3000
- 📚 API Docs: http://localhost:8000/docs
- 🔍 API Redoc: http://localhost:8000/redoc

### Detener servicios
```bash
docker compose down
```

## 📡 API Endpoints Principales

## 📡 API Endpoints Principales

### Impresoras
- `GET /printers` - Listar todas las impresoras
- `POST /printers` - Crear nueva impresora
- `GET /printers/{id}` - Obtener detalles de impresora
- `PUT /printers/{id}` - Actualizar impresora
- `DELETE /printers/{id}` - Eliminar impresora
- `POST /printers/{id}/poll` - Forzar polling SNMP

### Contadores
- `GET /counters` - Obtener contadores mensuales
- `POST /counters/collect` - Recolectar contadores
- `GET /counters/history/{printer_id}` - Historial de impresora

### Contratos
- `GET /contracts` - Listar contratos
- `POST /contracts` - Crear contrato
- `GET /contracts/{id}` - Detalles de contrato
- `PUT /contracts/{id}` - Actualizar contrato

### Incidentes
- `GET /incidents` - Listar incidentes
- `POST /incidents` - Crear incidente
- `PUT /incidents/{id}` - Actualizar incidente

### Reportes
- `GET /reports/usage` - Reporte de uso
- `GET /reports/billing` - Reporte de facturación

## ⚙️ Variables de Entorno

## ⚙️ Variables de Entorno

### Backend (API)
| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `DATABASE_URL` | URL de PostgreSQL | `postgresql://user:pass@db:5432/printer_manager` |
| `REDIS_URL` | URL de Redis | `redis://redis:6379` |
| `JWT_SECRET` | Secreto para JWT | `cambiar-en-produccion` |
| `CORS_ORIGINS` | Orígenes CORS | `http://localhost:3000` |
| `POLL_COMMUNITY` | Community SNMP | `public` |
| `POLL_INTERVAL_MINUTES` | Intervalo de polling | `30` |

### Frontend (Web)
| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_API_BASE` | URL base del API | `http://localhost:8000` |

## 💻 Desarrollo Local

### Backend (API)
```bash
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Web)
```bash
cd web
npm install
npm run dev
```

### Base de Datos
```bash
# Conectar a PostgreSQL
docker exec -it mvp_printer_manager-db-1 psql -U postgres -d printer_manager

# Ver logs
docker logs mvp_printer_manager-db-1 -f
```

## 🖨️ Configuración SNMP

## 🖨️ Configuración SNMP

### Marcas Soportadas

| Marca | Modelos | SNMP Version | Características |
|-------|---------|--------------|-----------------|
| **HP** | LaserJet, OfficeJet, PageWide | v2c | Contadores, tóner, serial |
| **OKI** | C/MC/ES series | v2c | Contadores, tóner, estado |
| **Brother** | HL/MFC/DCP series | v2c | Contadores básicos |
| **Ricoh** | MP/IM series | v2c | Web scraping + SNMP |
| **Lexmark** | MX/CX series | v2c | Detección automática |
| **Genérico** | Compatible RFC 3805 | v2c | Funcionalidad básica |

### Configuración de Community String

Por defecto se usa `public`. Para cambiar:

```bash
# En .env
POLL_COMMUNITY=mi-community-string
```

### Requerimientos de Red

- Puerto SNMP: `161/UDP` (debe estar abierto)
- Impresoras deben tener SNMP habilitado
- Community string debe coincidir
- Impresoras deben ser accesibles por IP

## 📊 Ejemplos de Uso

## 📊 Ejemplos de Uso

### Agregar una Impresora
```bash
curl -X POST http://localhost:8000/printers \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "HP",
    "model": "LaserJet Pro 400",
    "ip": "192.168.1.50",
    "is_color": false,
    "snmp_profile": "hp",
    "sector": "Administración",
    "location": "Piso 1, Oficina 101"
  }'
```

### Forzar Recolección SNMP
```bash
curl -X POST http://localhost:8000/printers/1/poll
```

### Obtener Contadores del Mes
```bash
curl http://localhost:8000/counters?year=2025&month=11
```

### Crear un Contrato
```bash
curl -X POST http://localhost:8000/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contract_name": "Arrendamiento Oficina Central",
    "supplier": "HP Argentina",
    "contract_type": "cost_per_copy",
    "cost_bw_per_copy": 0.05,
    "cost_color_per_copy": 0.15,
    "currency": "ARS",
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2026-01-01T00:00:00",
    "printer_ids": [1, 2, 3]
  }'
```

## 🚀 Despliegue en Producción

Ver documentación detallada en [`deployment/README.md`](deployment/README.md)

### Pasos Rápidos
```bash
# 1. Copiar archivos de producción
cp deployment/docker-compose.prod.yml .
cp deployment/nginx.conf /etc/nginx/sites-available/
cp deployment/printer-manager.service /etc/systemd/system/

# 2. Configurar variables de entorno
cp .env.example .env.production
nano .env.production

# 3. Levantar servicios
docker compose -f docker-compose.prod.yml up -d

# 4. Habilitar servicio systemd
sudo systemctl enable printer-manager
sudo systemctl start printer-manager
```

## 🧪 Testing

## 🧪 Testing

```bash
# Tests de API
cd api
pytest tests/

# Tests específicos de marca
python tests/test_hp_supplies.py
python tests/test_oki_supplies.py
python tests/test_ricoh.py
```

## 📚 Documentación Adicional

- [📖 Guía de Despliegue en Producción](deployment/README.md)
- [🎨 Sistema de Diseño](docs/DESIGN_SYSTEM.md)
- [🔧 Scripts de Utilidad](scripts/README.md)
- [✅ Resumen de Limpieza](docs/CLEANUP_SUMMARY.md)

## 🤝 Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

### Estándares de Código

- **Backend**: PEP 8, type hints, docstrings
- **Frontend**: ESLint + Prettier, TypeScript strict
- **Commits**: Conventional Commits

## 📝 Licencia

MIT License - Ver archivo LICENSE para más detalles

## 👥 Autores

- **Equipo de Desarrollo** - [Tu Organización]

## 🙏 Agradecimientos

- FastAPI por el excelente framework
- Next.js team por App Router
- Recharts por las visualizaciones
- Comunidad open source

---

**Versión:** 1.0.0  
**Última actualización:** Noviembre 2025  
**Estado:** ✅ Producción