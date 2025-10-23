# API - Printer Fleet Manager

FastAPI backend for the Printer Fleet Manager application.

## Features

- SNMP monitoring for multiple printer brands
- RESTful API endpoints
- Automated scheduled polling
- Authentication system
- Incident management
- Usage reporting

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/printer_fleet"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-secret-key"
```

3. Run the server:
```bash
uvicorn app.main:app --reload
```

## API Documentation

Visit http://localhost:8000/docs for interactive API documentation.

## SNMP Profiles

Supported printer profiles:
- `hp` - HP LaserJet series
- `oki` - OKI printers
- `brother` - Brother printers
- `generic_v2c` - Generic SNMP v2c compatible

## Scheduled Tasks

The application runs background tasks:
- Printer status polling (every 30 minutes)
- Data cleanup tasks
- Health checks