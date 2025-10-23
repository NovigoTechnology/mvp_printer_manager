<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Printer Fleet Manager - Copilot Instructions

This is a printer fleet management application with the following architecture:

## Tech Stack
- **Backend**: FastAPI with Python
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Infrastructure**: Docker Compose
- **Monitoring**: SNMP for printer status

## Project Structure
- `api/` - FastAPI backend with routers, models, and SNMP services
- `web/` - Next.js frontend with app router structure
- `docker-compose.yml` - Container orchestration

## Key Features
- SNMP-based printer monitoring (HP, OKI, Brother)
- Incident management system
- Usage reports and analytics
- Authentication system
- Automated polling with APScheduler

## Development Guidelines
- Use TypeScript for frontend development
- Follow FastAPI patterns for backend APIs
- Use Tailwind for styling
- Implement proper error handling
- Follow Docker best practices