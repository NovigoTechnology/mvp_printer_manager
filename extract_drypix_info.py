"""
Script para actualizar información de DRYPIX SMART
Ya que SNMP no está disponible en este equipo médico
"""

import requests
import json

DRYPIX_IP = "10.1.10.20"
DRYPIX_PORT = 20051
API_URL = "http://localhost:8000"

print("=" * 80)
print("EXTRAYENDO INFORMACIÓN DE DRYPIX SMART")
print("=" * 80)

# Datos conocidos de la imagen
known_data = {
    "serial": "17155942",
    "scanner_sn": "Y078808",
    "software_version": "V10.9",
    "model": "DRYPIX SMART",
    "brand": "Fuji"
}

print("\n[DATOS EXTRAÍDOS DE LA INTERFAZ WEB]")
for key, value in known_data.items():
    print(f"{key}: {value}")

# Intentar obtener más información desde páginas web
print("\n[INTENTANDO SCRAPING DE PÁGINAS WEB]")

pages_to_try = [
    "/USER/Login.htm",
    "/",
    "/status",
    "/info",
    "/system",
]

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

for page in pages_to_try:
    try:
        url = f"http://{DRYPIX_IP}:{DRYPIX_PORT}{page}"
        response = session.get(url, timeout=5)
        if response.status_code == 200:
            print(f"\n✓ {page} - Status: {response.status_code}")
            
            # Buscar información relevante en el HTML
            if 'serial' in response.text.lower():
                print("  Contiene: información de serial")
            if 'counter' in response.text.lower() or 'count' in response.text.lower():
                print("  Contiene: información de contadores")
            if 'film' in response.text.lower():
                print("  Contiene: información de películas/films")
                
    except Exception as e:
        print(f"✗ {page} - Error: {str(e)[:50]}")

# Actualizar la impresora en la base de datos con los datos conocidos
print("\n[ACTUALIZANDO INFORMACIÓN EN LA BASE DE DATOS]")

try:
    # Buscar la impresora por IP
    response = requests.get(f"{API_URL}/printers")
    if response.status_code == 200:
        printers = response.json()
        drypix = None
        
        for printer in printers:
            if printer.get('ip') == DRYPIX_IP:
                drypix = printer
                break
        
        if drypix:
            printer_id = drypix['id']
            print(f"✓ Impresora encontrada - ID: {printer_id}")
            
            # Actualizar con los datos conocidos
            update_data = {
                "brand": "Fuji",
                "model": "DRYPIX SMART",
                "serial_number": "17155942",
                "is_color": False,  # DRYPIX imprime en escala de grises
                "notes": "Sistema de impresión médica DRYPIX SMART. Scanner S/N: Y078808. Software V10.9. SNMP no disponible - equipo médico usa DICOM.",
            }
            
            update_response = requests.put(
                f"{API_URL}/printers/{printer_id}",
                json=update_data,
                timeout=10
            )
            
            if update_response.status_code == 200:
                print("✓ Información actualizada exitosamente")
                updated = update_response.json()
                print(f"\nDatos actualizados:")
                print(f"  Marca: {updated.get('brand')}")
                print(f"  Modelo: {updated.get('model')}")
                print(f"  Serial: {updated.get('serial_number')}")
                print(f"  Es Color: {updated.get('is_color')}")
            else:
                print(f"✗ Error actualizando: {update_response.status_code}")
                print(update_response.text)
        else:
            print(f"✗ No se encontró impresora con IP {DRYPIX_IP}")
            
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 80)
print("INFORMACIÓN SOBRE DRYPIX SMART")
print("=" * 80)
print("""
El DRYPIX SMART es un sistema de impresión médica de Fujifilm para placas 
radiográficas. Características:

- Usa protocolo DICOM (Digital Imaging and Communications in Medicine)
- NO usa SNMP (protocolo de impresoras de oficina)
- Imprime imágenes médicas en película seca
- Típicamente se integra con sistemas PACS (Picture Archiving System)

DATOS DISPONIBLES:
- Serial Number: 17155942
- Scanner S/N: Y078808
- Software Version: V10.9
- AE Title: AEP01
- Fine-PRT Title: DRYPIXHIGH
- Puerto DICOM: 5040

LIMITACIONES:
- No tiene contadores de páginas como impresoras convencionales
- No tiene niveles de tóner (usa película seca)
- No soporta SNMP
- Los "contadores" serían número de films impresos (requiere acceso DICOM)

RECOMENDACIONES:
1. Para monitoreo, usar la interfaz web manual
2. Los contadores de films están en "Check Counters" del menú web
3. Para integración automática, se requeriría cliente DICOM
4. Considerar registrar manualmente los contadores mensualmente
""")
print("=" * 80)
