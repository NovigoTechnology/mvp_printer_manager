"""
Script para configurar las fuentes de tasas de cambio
"""
import psycopg2
from datetime import datetime

# Conexión a la base de datos
conn = psycopg2.connect(
    host="db",  # Nombre del servicio en docker-compose
    port=5432,
    database="printer_fleet",
    user="postgres",
    password="postgres"
)

cur = conn.cursor()

# Limpiar fuentes existentes
cur.execute("DELETE FROM exchange_rate_sources;")

# Fuentes de tasas de cambio para Argentina
sources = [
    {
        "name": "DolarAPI Blue",
        "description": "Cotización del dólar blue desde DolarAPI",
        "api_url": "https://dolarapi.com/v1/dolares/blue",
        "response_path": "venta",  # Usar precio de venta
        "base_currency": "USD",
        "target_currency": "ARS",
        "update_frequency_hours": 1,
        "is_active": True,
        "priority": 1
    },
    {
        "name": "DolarAPI Oficial",
        "description": "Cotización del dólar oficial desde DolarAPI",
        "api_url": "https://dolarapi.com/v1/dolares/oficial",
        "response_path": "venta",
        "base_currency": "USD",
        "target_currency": "ARS",
        "update_frequency_hours": 1,
        "is_active": False,  # Desactivado por defecto, usar blue como principal
        "priority": 2
    },
    {
        "name": "DolarAPI MEP",
        "description": "Cotización del dólar MEP desde DolarAPI",
        "api_url": "https://dolarapi.com/v1/dolares/bolsa",
        "response_path": "venta",
        "base_currency": "USD",
        "target_currency": "ARS",
        "update_frequency_hours": 1,
        "is_active": False,
        "priority": 3
    }
]

# Insertar fuentes
for source in sources:
    cur.execute("""
        INSERT INTO exchange_rate_sources 
        (name, description, api_url, response_path, base_currency, target_currency, 
         update_frequency_hours, is_active, priority, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        source["name"],
        source["description"],
        source["api_url"],
        source["response_path"],
        source["base_currency"],
        source["target_currency"],
        source["update_frequency_hours"],
        source["is_active"],
        source["priority"],
        datetime.now()
    ))
    print(f"✅ Agregada fuente: {source['name']} - Activa: {source['is_active']}")

# Confirmar cambios
conn.commit()

print("\n✅ Fuentes de tasas de cambio configuradas correctamente")
print("💡 Para actualizar tasas manualmente, ejecuta:")
print("   docker exec mvp_printer_manager-api-1 python -c \"import asyncio; from app.services.exchange_rate_service import update_exchange_rates_task; asyncio.run(update_exchange_rates_task())\"")

# Cerrar conexión
cur.close()
conn.close()
