#!/bin/bash
set -e
cd /home/im/mvp_printer_manager/deployment

echo "=== Pulling latest code ==="
cd /home/im/mvp_printer_manager
git pull origin main

echo "=== Rebuilding web container with correct NEXT_PUBLIC_API_BASE ==="
cd /home/im/mvp_printer_manager/deployment
NEXT_PUBLIC_API_BASE=http://10.10.10.193/api docker compose -f docker-compose.prod.yml build --no-cache web

echo "=== Restarting web container ==="
NEXT_PUBLIC_API_BASE=http://10.10.10.193/api docker compose -f docker-compose.prod.yml up -d web

echo "=== Done ==="
