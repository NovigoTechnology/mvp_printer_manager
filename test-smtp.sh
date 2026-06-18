#!/bin/bash
# Script para probar el endpoint SMTP
# Uso: bash test-smtp.sh <token> <api_host>

TOKEN="${1:-your_token_here}"
API_HOST="${2:-http://localhost:8000}"

echo "🧪 Testing SMTP endpoint..."
echo "API Host: $API_HOST"
echo ""

# Primero, guardar configuración
echo "1️⃣ Saving SMTP configuration..."
curl -X POST "$API_HOST/api/settings/smtp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true,
    "host": "smtp.gmail.com",
    "port": 587,
    "use_tls": true,
    "username": "test@gmail.com",
    "password": "test_password",
    "from_email": "sender@gmail.com",
    "from_name": "Test"
  }' \
  -v

echo ""
echo ""

# Luego, probar conexión
echo "2️⃣ Testing SMTP connection..."
curl -X POST "$API_HOST/api/settings/smtp/test" \
  -H "Authorization: Bearer $TOKEN" \
  -v
