# Production Deployment Guide

## Overview
This guide covers deploying the Printer Fleet Manager application to a production VMware environment.

## System Requirements

### Hardware Requirements
- **CPU**: 4+ cores (for concurrent SNMP polling)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 100GB+ SSD (for database and logs)
- **Network**: Reliable connection to printer subnets

### Software Requirements
- **OS**: Ubuntu 22.04 LTS or CentOS Stream 9
- **Docker**: Version 24.0+
- **Docker Compose**: Version 2.20+
- **PostgreSQL**: 15+ (if using external database)
- **Redis**: 7+ (if using external cache)

## Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] VMware VM provisioned with adequate resources
- [ ] Operating system installed and updated
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 3000, 8000, 5432, 6379)
- [ ] Network access to printer subnets verified

### 2. Application Configuration
- [ ] Production environment variables configured
- [ ] Database connection strings updated
- [ ] SNMP community strings secured
- [ ] SSL certificates obtained (if HTTPS required)
- [ ] Backup strategy implemented

## Deployment Steps

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd mvp_printer_manager
```

### Step 2: Environment Configuration
Create production environment file:
```bash
cp .env.example .env.production
```

Configure production variables:
```env
# Database Configuration
POSTGRES_DB=printer_fleet_prod
POSTGRES_USER=printer_admin
POSTGRES_PASSWORD=<secure-password>
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
SECRET_KEY=<generate-secure-key>

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=production

# SNMP Configuration
DEFAULT_SNMP_COMMUNITY=public
SNMP_TIMEOUT=5
SNMP_RETRIES=3

# Polling Configuration
POLLING_INTERVAL_MINUTES=15
MAX_CONCURRENT_POLLS=10
```

### Step 3: Production Docker Compose
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    networks:
      - printer_network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped
    networks:
      - printer_network

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - printer_network

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000
    depends_on:
      - api
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - printer_network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - web
      - api
    restart: unless-stopped
    networks:
      - printer_network

volumes:
  postgres_data:

networks:
  printer_network:
    driver: bridge
```

### Step 4: Nginx Configuration
Create `nginx/nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8000;
    }
    
    upstream web {
        server web:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;
        
        ssl_certificate /etc/ssl/certs/certificate.crt;
        ssl_certificate_key /etc/ssl/certs/private.key;
        
        # API routes
        location /api/ {
            proxy_pass http://api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Frontend routes
        location / {
            proxy_pass http://web/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Step 5: Deploy Application
```bash
# Build and start services
docker compose -f docker-compose.prod.yml up -d --build

# Verify services are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### Step 6: Database Migration
```bash
# Run database migrations
docker compose -f docker-compose.prod.yml exec api python -m alembic upgrade head

# Create initial admin user (optional)
docker compose -f docker-compose.prod.yml exec api python scripts/create_admin.py
```

## VMware-Specific Considerations

### 1. VM Configuration
- **CPU**: Enable hardware virtualization if available
- **Memory**: Configure memory reservation to prevent swapping
- **Network**: Use VMXNET3 adapter for better performance
- **Storage**: Use thick provisioned disks for database volumes

### 2. Backup Strategy
```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump \
  -U ${POSTGRES_USER} ${POSTGRES_DB} > $BACKUP_DIR/database.sql

# Compress backup
gzip $BACKUP_DIR/database.sql

# Retain backups for 30 days
find /backups -type f -name "*.sql.gz" -mtime +30 -delete
```

### 3. Monitoring Setup
```bash
# System monitoring with crontab
*/5 * * * * docker stats --no-stream >> /var/log/docker-stats.log
0 2 * * * /opt/scripts/backup-database.sh
0 3 * * * docker system prune -f
```

## Security Hardening

### 1. Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow from 10.0.0.0/8 to any port 161   # SNMP (internal networks only)
ufw enable
```

### 2. SSL/TLS Setup
```bash
# Generate self-signed certificate (or use Let's Encrypt)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/private.key -out ssl/certificate.crt
```

### 3. Environment Security
- Use strong passwords for database and Redis
- Rotate secrets regularly
- Implement log monitoring
- Regular security updates

## Maintenance Tasks

### Daily
- [ ] Check application logs for errors
- [ ] Verify SNMP polling is active
- [ ] Monitor disk space usage

### Weekly
- [ ] Review printer discovery logs
- [ ] Check database performance
- [ ] Validate backup integrity

### Monthly
- [ ] Update Docker images
- [ ] Review security logs
- [ ] Performance optimization review

## Troubleshooting

### Common Issues

1. **SNMP Timeouts**
   - Verify network connectivity to printers
   - Check SNMP community strings
   - Adjust timeout and retry settings

2. **Database Connection Issues**
   - Check PostgreSQL container health
   - Verify database credentials
   - Review connection pool settings

3. **Memory Issues**
   - Monitor container resource usage
   - Adjust Docker memory limits
   - Check for memory leaks in logs

### Log Locations
- Application logs: `docker compose logs api`
- Database logs: `docker compose logs postgres`
- Web server logs: `docker compose logs nginx`
- System logs: `/var/log/syslog`

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_printers_ip_address ON printers(ip_address);
CREATE INDEX idx_contracts_status ON lease_contracts(status);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
```

### Application Tuning
- Adjust SNMP polling intervals based on network capacity
- Configure Redis cache expiration appropriately
- Use connection pooling for database connections
- Enable gzip compression in Nginx

## Support and Maintenance

For ongoing support and maintenance:
1. Monitor application performance metrics
2. Keep security patches up to date
3. Regular database maintenance and optimization
4. Capacity planning for printer fleet growth

## Migration from Development

When migrating from the development environment:
1. Export development data if needed
2. Update printer IP addresses for production network
3. Reconfigure SNMP settings for production printers
4. Test all functionality in production environment
5. Train users on production system access