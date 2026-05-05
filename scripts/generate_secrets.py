#!/usr/bin/env python3
"""
Script para generar secretos seguros para producción
Printer Fleet Manager - Security Setup
"""

import secrets
import string

def generate_secure_password(length=32):
    """Genera una contraseña segura con caracteres alfanuméricos y especiales"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_url_safe_token(length=32):
    """Genera un token seguro URL-safe (para JWT, API keys)"""
    return secrets.token_urlsafe(length)

def generate_hex_token(length=32):
    """Genera un token hexadecimal (para SECRET_KEY)"""
    return secrets.token_hex(length)

def main():
    print("=" * 80)
    print("🔐 GENERADOR DE SECRETOS SEGUROS - Printer Fleet Manager")
    print("=" * 80)
    print()
    
    # Generar secretos
    secrets_config = {
        "JWT_SECRET": generate_hex_token(32),
        "SECRET_KEY": generate_hex_token(32),
        "POSTGRES_PASSWORD": generate_secure_password(32),
        "REDIS_PASSWORD": generate_secure_password(32),
        "POLL_COMMUNITY": generate_secure_password(16),
    }
    
    print("📝 Copie estos valores a su archivo .env.production:")
    print()
    print("# ============================================")
    print("# SECRETOS GENERADOS AUTOMÁTICAMENTE")
    print(f"# Fecha: {__import__('datetime').datetime.now().isoformat()}")
    print("# ============================================")
    print()
    
    for key, value in secrets_config.items():
        print(f"{key}={value}")
    
    print()
    print("# ============================================")
    print("# CREDENCIALES ADICIONALES (CONFIGURAR MANUALMENTE)")
    print("# ============================================")
    print()
    print("# Medical Printers - DRYPIX")
    print("DRYPIX_LOGIN=<usuario_real_impresora_medica>")
    print("DRYPIX_PASSWORD=<password_real_impresora_medica>")
    print()
    print("# SNMPv3 Configuration Path")
    print("SNMP_CONFIG_PATH=/app/config/snmp_credentials.json")
    print()
    
    print("=" * 80)
    print("⚠️  IMPORTANTE - INSTRUCCIONES DE SEGURIDAD")
    print("=" * 80)
    print()
    print("1. ❌ NO commitear estos valores a Git")
    print("2. ✅ Copiar manualmente a .env.production en el servidor")
    print("3. ✅ Configurar permisos restrictivos:")
    print("   chmod 600 .env.production")
    print("4. ✅ Configurar credenciales DRYPIX reales")
    print("5. ✅ Crear archivo api/config/snmp_credentials.json con credenciales SNMPv3")
    print("   chmod 600 api/config/snmp_credentials.json")
    print()
    print("📚 Ver documentación completa en:")
    print("   docs/AUDITORIA_HARDCODED_VALUES.md")
    print("   docs/DEPLOYMENT_SECURITY_CHECKLIST.md")
    print()
    
    # Guardar en archivo temporal (para referencia local, NO commitear)
    output_file = ".env.secrets.generated"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# ============================================\n")
        f.write("# SECRETOS GENERADOS AUTOMÁTICAMENTE\n")
        f.write(f"# Fecha: {__import__('datetime').datetime.now().isoformat()}\n")
        f.write("# WARNING: NO COMMITEAR ESTE ARCHIVO A GIT\n")
        f.write("# ============================================\n\n")
        
        for key, value in secrets_config.items():
            f.write(f"{key}={value}\n")
        
        f.write("\n# CREDENCIALES ADICIONALES (CONFIGURAR MANUALMENTE)\n")
        f.write("DRYPIX_LOGIN=<usuario_real_impresora_medica>\n")
        f.write("DRYPIX_PASSWORD=<password_real_impresora_medica>\n")
        f.write("SNMP_CONFIG_PATH=/app/config/snmp_credentials.json\n")
    
    print(f"✅ Secretos también guardados en: {output_file}")
    print(f"   (Este archivo está en .gitignore - NO se commiteará)")
    print()

if __name__ == "__main__":
    main()
