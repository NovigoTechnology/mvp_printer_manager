"""
Script para obtener los contadores del DRYPIX SMART automáticamente
"""
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime

BASE_URL = "http://10.1.10.20:20051"
LOGIN = "dryprinter"
PASSWORD = "fujifilm"
LANGUAGE = "en"
TRAY_CAPACITY = 100  # Capacidad de cada bandeja cuando está llena

def get_drypix_counters():
    """
    Obtiene los contadores de bandejas del DRYPIX SMART
    Returns: dict con los contadores o None si hay error
    """
    try:
        # Crear sesión autenticada
        session = requests.Session()
        login_url = f"{BASE_URL}/USER/chkin={LOGIN}&passwd={PASSWORD}&Language={LANGUAGE}"
        login_resp = session.get(login_url, timeout=10)
        
        if login_resp.status_code != 200:
            print(f"✗ Error en login: Status {login_resp.status_code}")
            return None
        
        # Acceder a Setting2 que contiene los contadores
        setting2_url = f"{BASE_URL}/SETTING/?settingMode=5"
        resp = session.get(setting2_url, timeout=10)
        
        if resp.status_code != 200:
            print(f"✗ Error accediendo a Setting2: Status {resp.status_code}")
            return None
        
        # Parsear HTML con BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Buscar la sección "Check Counters"
        counters = {}
        
        # Encontrar todas las tablas
        tables = soup.find_all('table', width="150", border="1")
        
        if not tables:
            # Intentar método alternativo: regex
            print("⚠ No se encontró tabla con BeautifulSoup, intentando regex...")
            
            # Buscar sección Check Counters
            match = re.search(r'<B>Check Counters</B>.*?<TABLE[^>]*>(.*?)</TABLE>', 
                            resp.text, re.DOTALL | re.IGNORECASE)
            
            if match:
                table_html = match.group(1)
                # Extraer filas Tray1-5
                tray_matches = re.findall(r'(Tray\d+).*?ALIGN="RIGHT"[^>]*>\s*(\d+)', 
                                         table_html, re.DOTALL)
                
                for tray_name, count in tray_matches:
                    counters[tray_name] = int(count)
            else:
                print("✗ No se pudo encontrar la sección Check Counters")
                return None
        else:
            # Usar BeautifulSoup
            counter_table = tables[0]  # Primera tabla de 150px de ancho
            rows = counter_table.find_all('tr')
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) == 2:
                    tray_name = cells[0].get_text().strip()
                    count = cells[1].get_text().strip()
                    
                    if tray_name.startswith('Tray'):
                        counters[tray_name] = int(count)
        
        return counters
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    print("=" * 80)
    print("DRYPIX SMART - Extracción Automática de Contadores")
    print("=" * 80)
    print()
    
    print(f"Impresora: {BASE_URL}")
    print(f"Usuario: {LOGIN}")
    print()
    
    print("Obteniendo contadores...")
    counters = get_drypix_counters()
    
    if counters:
        print()
        print("✓ Contadores obtenidos exitosamente:")
        print()
        print("  Bandeja  | Disponibles | Impresas")
        print("  " + "─" * 40)
        
        total_available = 0
        total_printed = 0
        tray_details = {}
        
        for tray, available in sorted(counters.items()):
            # Si hay placas disponibles, asumimos que la bandeja fue cargada con 100
            # Las impresas = capacidad - disponibles (solo si la bandeja tiene placas)
            if available > 0:
                printed = TRAY_CAPACITY - available
            else:
                printed = 0
            
            tray_details[tray] = {"available": available, "printed": printed}
            total_available += available
            total_printed += printed
            
            print(f"  {tray:<8} | {available:>11} | {printed:>8}")
        
        print(f"  {'─' * 40}")
        print(f"  Total    | {total_available:>11} | {total_printed:>8}")
        print()
        
        # Guardar en JSON para fácil integración
        import json
        data = {
            "printer_ip": "10.1.10.20",
            "printer_port": 20051,
            "model": "DRYPIX SMART",
            "timestamp": datetime.now().isoformat(),
            "tray_capacity": TRAY_CAPACITY,
            "trays": tray_details,
            "summary": {
                "total_available": total_available,
                "total_printed": total_printed,
                "total_trays_loaded": sum(1 for v in tray_details.values() if v["available"] > 0)
            }
        }
        
        with open('drypix_counters.json', 'w') as f:
            json.dump(data, f, indent=2)
        
        print("✓ Contadores guardados en: drypix_counters.json")
        
    else:
        print()
        print("✗ No se pudieron obtener los contadores")
        print("  Verificar:")
        print("  - Conexión a la impresora")
        print("  - Credenciales correctas")
        print("  - Estructura HTML no haya cambiado")
