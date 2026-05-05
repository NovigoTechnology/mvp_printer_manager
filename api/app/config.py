"""
Configuración centralizada de la aplicación usando Pydantic Settings.
Todas las variables de entorno se definen aquí con validación y valores por defecto apropiados.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import secrets


class Settings(BaseSettings):
    """
    Configuración de la aplicación.
    
    Las variables de entorno se cargan automáticamente desde:
    1. Variables de entorno del sistema
    2. Archivo .env en el directorio raíz
    
    Variables críticas (sin default) lanzarán error si no están configuradas.
    """
    
    # ========================================================================
    # DATABASE CONFIGURATION (CRITICAL - Required)
    # ========================================================================
    database_url: str
    """
    URL de conexión a PostgreSQL.
    Formato: postgresql://user:password@host:port/database
    REQUERIDO - No hay valor por defecto por seguridad.
    """
    
    # ========================================================================
    # JWT AUTHENTICATION (CRITICAL - Required)
    # ========================================================================
    jwt_secret: str
    """
    Clave secreta para firmar tokens JWT.
    REQUERIDO - No hay valor por defecto por seguridad.
    Generar con: python -c 'import secrets; print(secrets.token_hex(32))'
    """
    
    jwt_algorithm: str = "HS256"
    """Algoritmo de encriptación para JWT (default: HS256)"""
    
    jwt_expiry_minutes: int = 120
    """
    Tiempo de expiración del token JWT en minutos.
    Default: 120 minutos (2 horas)
    Producción recomendado: 60-120 minutos
    Desarrollo: 480 minutos (8 horas) para comodidad
    """
    
    # ========================================================================
    # CORS CONFIGURATION (CRITICAL)
    # ========================================================================
    cors_origins: str = "http://localhost:3000"
    """
    Orígenes permitidos para CORS (separados por comas).
    Default: http://localhost:3000 (desarrollo)
    Producción: Especificar dominios exactos, ej: https://printer.imsa.local,https://10.10.10.193
    NUNCA usar "*" en producción.
    """
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte CORS_ORIGINS string a lista de orígenes."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    # ========================================================================
    # MEDICAL PRINTERS - DRYPIX CREDENTIALS (CRITICAL)
    # ========================================================================
    drypix_login: str
    """
    Usuario para autenticación en impresoras DRYPIX.
    REQUERIDO - Credenciales específicas del fabricante.
    """
    
    drypix_password: str
    """
    Contraseña para autenticación en impresoras DRYPIX.
    REQUERIDO - Credenciales específicas del fabricante.
    """
    
    # ========================================================================
    # SNMP CONFIGURATION
    # ========================================================================
    snmp_config_path: str = "/app/config/snmp_credentials.json"
    """
    Ruta al archivo de credenciales SNMPv3.
    Default: /app/config/snmp_credentials.json (dentro del contenedor)
    """
    
    # ========================================================================
    # RATE LIMITING
    # ========================================================================
    rate_limit_default: str = "1000/hour"
    """Límite de peticiones por defecto para todos los endpoints."""
    
    rate_limit_auth: str = "5/minute"
    """Límite de peticiones para endpoint de autenticación (anti-brute force)."""
    
    # ========================================================================
    # APPLICATION SETTINGS
    # ========================================================================
    app_name: str = "Printer Fleet Manager API"
    """Nombre de la aplicación."""
    
    app_version: str = "1.0.0"
    """Versión de la aplicación."""
    
    debug: bool = False
    """
    Modo debug (activa logging detallado).
    Default: False
    NUNCA activar en producción.
    """
    
    # ========================================================================
    # REDIS CONFIGURATION
    # ========================================================================
    redis_host: str = "redis"
    """Host de Redis (default: redis - nombre del servicio en docker-compose)."""
    
    redis_port: int = 6379
    """Puerto de Redis (default: 6379)."""
    
    redis_password: str | None = None
    """Contraseña de Redis (opcional, None si no tiene contraseña)."""
    
    # ========================================================================
    # PYDANTIC SETTINGS CONFIGURATION
    # ========================================================================
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # Las variables de entorno no son case-sensitive
        extra="ignore"  # Ignorar variables de entorno extra no definidas aquí
    )


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================
# Crear una instancia única de configuración que se importa en toda la app
# Esto valida todas las variables de entorno al iniciar la aplicación
settings = Settings()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def get_settings() -> Settings:
    """
    Obtiene la configuración de la aplicación (singleton).
    Útil para dependency injection en FastAPI.
    
    Usage:
        from fastapi import Depends
        from .config import get_settings, Settings
        
        @app.get("/")
        def root(config: Settings = Depends(get_settings)):
            return {"app": config.app_name}
    """
    return settings


def validate_production_config():
    """
    Valida que la configuración sea segura para producción.
    Lanza ValueError si detecta configuraciones inseguras.
    """
    errors = []
    
    # Validar JWT_SECRET no es un valor de desarrollo común
    insecure_secrets = [
        "your-secret-key",
        "change-me",
        "secret",
        "dev-secret",
        "test-secret"
    ]
    if settings.jwt_secret.lower() in insecure_secrets:
        errors.append(
            "JWT_SECRET parece ser un valor de desarrollo. "
            "Generar uno seguro con: python -c 'import secrets; print(secrets.token_hex(32))'"
        )
    
    # Validar CORS no incluye "*"
    if "*" in settings.cors_origins_list:
        errors.append(
            "CORS_ORIGINS contiene '*' (wildcard). "
            "En producción debe especificar dominios exactos."
        )
    
    # Validar JWT_EXPIRY no es excesivamente largo
    if settings.jwt_expiry_minutes > 480:
        errors.append(
            f"JWT_EXPIRY_MINUTES es {settings.jwt_expiry_minutes} minutos (>{8} horas). "
            "En producción se recomienda 60-120 minutos."
        )
    
    # Validar DEBUG está desactivado
    if settings.debug:
        errors.append(
            "DEBUG=True está activado. En producción debe ser False."
        )
    
    if errors:
        raise ValueError(
            "⚠️ CONFIGURACIÓN INSEGURA PARA PRODUCCIÓN:\n" + 
            "\n".join(f"  - {error}" for error in errors)
        )
    
    return True
