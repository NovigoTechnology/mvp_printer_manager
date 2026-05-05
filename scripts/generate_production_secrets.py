#!/usr/bin/env python3
"""
Script para generar secretos seguros para producción
Uso: python scripts/generate_production_secrets.py
"""

import secrets
import argparse
from datetime import datetime

def generate_secrets(output_format='env'):
    """
    Genera secretos criptográficamente seguros para todas las credenciales del sistema
    
    Args:
        output_format: 'env' para formato .env, 'json' para JSON
    """
    
    secrets_config = {
        "JWT_SECRET": secrets.token_hex(32),           # 64 caracteres hexadecimales
        "SECRET_KEY": secrets.token_hex(32),           # 64 caracteres hexadecimales
        "POSTGRES_PASSWORD": secrets.token_urlsafe(32), # 32 bytes URL-safe
        "REDIS_PASSWORD": secrets.token_urlsafe(32),   # 32 bytes URL-safe
        "DRYPIX_PASSWORD": secrets.token_urlsafe(24),  # 24 bytes para DRYPIX
    }
    
    print("=" * 70)
    print("🔐 GENERADOR DE SECRETOS SEGUROS - Printer Fleet Manager")
    print("=" * 70)
    print(f"Fecha de generación: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("⚠️  IMPORTANTE:")
    print("   - Estos secretos son únicos y NO pueden ser regenerados")
    print("   - Guárdalos en un gestor de contraseñas (1Password, LastPass, etc.)")
    print("   - NUNCA los subas a Git")
    print("   - Cambia los secretos cada 90-180 días")
    print()
    print("=" * 70)
    print()
    
    if output_format == 'env':
        print("# Agregar a .env.production")
        print("# " + "=" * 66)
        print()
        print("# ----- SEGURIDAD -----")
        print(f"JWT_SECRET={secrets_config['JWT_SECRET']}")
        print(f"SECRET_KEY={secrets_config['SECRET_KEY']}")
        print()
        print("# ----- BASE DE DATOS -----")
        print(f"POSTGRES_PASSWORD={secrets_config['POSTGRES_PASSWORD']}")
        print(f'DATABASE_URL=postgresql://postgres:{secrets_config["POSTGRES_PASSWORD"]}@db:5432/printer_fleet')
        print()
        print("# ----- CACHE -----")
        print(f"REDIS_PASSWORD={secrets_config['REDIS_PASSWORD']}")
        print(f'REDIS_URL=redis://:{secrets_config["REDIS_PASSWORD"]}@redis:6379')
        print()
        print("# ----- IMPRESORAS MÉDICAS -----")
        print(f"DRYPIX_PASSWORD={secrets_config['DRYPIX_PASSWORD']}")
        print()
    
    elif output_format == 'json':
        import json
        print(json.dumps(secrets_config, indent=2))
    
    print()
    print("=" * 70)
    print("✅ SECRETOS GENERADOS EXITOSAMENTE")
    print()
    print("📝 Próximos pasos:")
    print("   1. Copia estos valores a .env.production en el servidor")
    print("   2. Asegura que el archivo tenga permisos restrictivos: chmod 600 .env.production")
    print("   3. Reinicia los contenedores: docker-compose down && docker-compose up -d")
    print("   4. Verifica la conexión: docker-compose exec api curl http://localhost:8000/health")
    print("=" * 70)

def generate_snmp_template():
    """
    Genera una plantilla de configuración SNMPv3 con contraseñas seguras
    """
    print("=" * 70)
    print("🔐 GENERADOR DE CREDENCIALES SNMPv3")
    print("=" * 70)
    print()
    
    printers = {
        "10.10.9.11": "OKI ES5162LP - Radiología",
        "10.10.9.7": "OKI ES5162LP MFP - Administración",
        "10.10.9.15": "OKI - Piso 2"
    }
    
    print("{")
    print('  "_comment": "SNMPv3 Credentials - CONFIDENTIAL",')
    for ip, description in printers.items():
        auth_key = secrets.token_urlsafe(16)
        priv_key = secrets.token_urlsafe(16)
        print(f'  "{ip}": {{')
        print(f'    "username": "snmp_admin",')
        print(f'    "auth_key": "{auth_key}",')
        print(f'    "priv_key": "{priv_key}",')
        print(f'    "context_name": "v3context",')
        print(f'    "_note": "{description}"')
        print(f'  }}{"," if ip != "10.10.9.15" else ""}')
    print("}")
    print()
    print("💾 Guarda este archivo como: /opt/printer-manager/config/snmp_credentials.json")
    print("🔒 Establece permisos: chmod 600 /opt/printer-manager/config/snmp_credentials.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generar secretos seguros para producción')
    parser.add_argument(
        '--format', 
        choices=['env', 'json'], 
        default='env',
        help='Formato de salida (default: env)'
    )
    parser.add_argument(
        '--snmp',
        action='store_true',
        help='Generar plantilla de credenciales SNMPv3'
    )
    
    args = parser.parse_args()
    
    if args.snmp:
        generate_snmp_template()
    else:
        generate_secrets(args.format)
