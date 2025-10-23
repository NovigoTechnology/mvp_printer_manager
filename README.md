# Printer Fleet Manager

A comprehensive printer fleet management application built with FastAPI and Next.js.

## Features

- **SNMP Monitoring**: Real-time monitoring of HP, OKI, Brother, and generic printers
- **Incident Management**: Track and manage printer incidents
- **Usage Reports**: Analytics and reporting with visual charts
- **Authentication**: Secure user authentication system
- **Automated Polling**: Scheduled data collection from printers

## Tech Stack

- **Backend**: FastAPI + Python
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Infrastructure**: Docker Compose

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd printer-fleet-manager
```

2. Build and start with Docker Compose:
```bash
docker compose build
docker compose up
```

3. Access the applications:
- Web UI: http://localhost:3000
- API Documentation: http://localhost:8000/docs

## API Endpoints

- `GET /printers` - List all printers
- `POST /printers` - Create a new printer
- `POST /printers/{id}/poll` - Force SNMP poll for a specific printer
- `GET /incidents` - List incidents
- `POST /incidents` - Create incident
- `GET /reports/usage` - Get usage reports

## Environment Variables

### API Service
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `CORS_ORIGINS` - Allowed CORS origins
- `POLL_COMMUNITY` - SNMP community string (default: public)

### Web Service
- `NEXT_PUBLIC_API_BASE` - API base URL

## Development

### Backend (API)
```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (Web)
```bash
cd web
npm install
npm run dev
```

## SNMP Configuration

The application supports multiple printer brands:
- **HP**: LaserJet series
- **OKI**: Color and mono printers
- **Brother**: Various models
- **Generic**: Standard SNMP v2c compatible printers

SNMP community is configurable via the `POLL_COMMUNITY` environment variable.

## Usage Examples

### Create a Printer
```bash
curl -X POST http://localhost:8000/printers \
  -H "Content-Type: application/json" \
  -d '{
    "brand":"HP","model":"LaserJet 400",
    "ip":"192.168.1.50","is_color":false,
    "snmp_profile":"hp","sector":"Administración","location":"Piso 1"
  }'
```

### Force SNMP Poll
```bash
curl -X POST http://localhost:8000/printers/{id}/poll
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Submit a pull request

## License

MIT License