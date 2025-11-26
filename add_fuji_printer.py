"""Script para agregar y probar impresora Fuji"""
import requests
import json
import time

API_URL = "http://localhost:8000"
FUJI_IP = "10.1.10.20"

print("=" * 80)
print("AGREGANDO Y PROBANDO IMPRESORA FUJI")
print("=" * 80)

# 1. Agregar impresora
print("\n[1. AGREGANDO IMPRESORA]")
printer_data = {
    "brand": "Fuji",
    "model": "A determinar por SNMP",
    "ip": FUJI_IP,
    "asset_tag": "FUJI-001",
    "is_color": True,
    "snmp_profile": "generic",
    "sector": "Producción",
    "location": "Área de Placas",
    "snmp_community": "public"
}

try:
    response = requests.post(f"{API_URL}/printers", json=printer_data, timeout=10)
    if response.status_code in [200, 201]:
        printer = response.json()
        printer_id = printer['id']
        print(f"✓ Impresora agregada exitosamente")
        print(f"  ID: {printer_id}")
        print(f"  Brand: {printer.get('brand')}")
        print(f"  Model: {printer.get('model')}")
        print(f"  IP: {printer.get('ip')}")
        
        # 2. Hacer polling SNMP
        print(f"\n[2. HACIENDO POLLING SNMP]")
        print(f"Esperando 2 segundos...")
        time.sleep(2)
        
        poll_response = requests.post(
            f"{API_URL}/printers/{printer_id}/poll",
            timeout=30
        )
        
        if poll_response.status_code == 200:
            poll_data = poll_response.json()
            print(f"✓ Polling SNMP exitoso!")
            print(f"\nDatos obtenidos:")
            print(json.dumps(poll_data, indent=2, ensure_ascii=False))
            
            # 3. Obtener datos actualizados
            print(f"\n[3. DATOS ACTUALIZADOS DE LA IMPRESORA]")
            get_response = requests.get(f"{API_URL}/printers/{printer_id}")
            if get_response.status_code == 200:
                updated_printer = get_response.json()
                print(f"Marca: {updated_printer.get('brand')}")
                print(f"Modelo: {updated_printer.get('model')}")
                print(f"Serial: {updated_printer.get('serial_number', 'No disponible')}")
                print(f"Es Color: {updated_printer.get('is_color')}")
                print(f"Estado: {updated_printer.get('status')}")
        else:
            print(f"✗ Error en polling: {poll_response.status_code}")
            print(poll_response.text)
            
    else:
        print(f"✗ Error agregando impresora: {response.status_code}")
        print(response.text)
        
except requests.exceptions.ConnectionError:
    print("✗ No se puede conectar a la API")
    print("  Asegúrate de que Docker esté corriendo:")
    print("  docker compose up -d")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "=" * 80)
print("RESUMEN")
print("=" * 80)
print(f"""
Impresora Fuji en {FUJI_IP}:20051
- Web UI: http://{FUJI_IP}:20051/USER/Login.htm
- SNMP: Puerto 161 (UDP)
- Community: public

Si el polling SNMP falló, verifica:
1. Que SNMP esté habilitado en la interfaz web
2. El community string correcto
3. Que no haya firewall bloqueando UDP 161

Puedes ver la impresora en:
http://localhost:3000/printers
""")
print("=" * 80)
