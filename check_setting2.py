"""
Acceder a la página Setting2 para encontrar Check Counters
"""
import requests
import re

BASE_URL = "http://10.1.10.20:20051"
LOGIN = "dryprinter"
PASSWORD = "fujifilm"
LANGUAGE = "en"

# Crear sesión autenticada
session = requests.Session()
login_url = f"{BASE_URL}/USER/chkin={LOGIN}&passwd={PASSWORD}&Language={LANGUAGE}"
session.get(login_url, timeout=10)

print("=" * 80)
print("ACCEDIENDO A SETTING2 PARA ENCONTRAR CHECK COUNTERS")
print("=" * 80)
print()

# Acceder a Setting2
setting2_url = f"{BASE_URL}/SETTING/?settingMode=5"

print(f"1. Accediendo a Setting2...")
print(f"   URL: {setting2_url}")

try:
    resp = session.get(setting2_url, timeout=10)
    print(f"   Status: {resp.status_code}")
    print(f"   Tamaño: {len(resp.content)} bytes")
    print()
    
    # Guardar
    with open('setting2_page.html', 'w', encoding='utf-8', errors='ignore') as f:
        f.write(resp.text)
    print(f"   ✓ Guardado en: setting2_page.html")
    print()
    
    # Buscar enlaces que contengan "counter"
    counter_links = re.findall(r'(href|src)=["\']([^"\']*counter[^"\']*)["\']', resp.text, re.IGNORECASE)
    
    if counter_links:
        print(f"   ✓ Enlaces con 'counter' encontrados:")
        for link_type, link in counter_links:
            print(f"     - {link}")
        print()
    
    # Buscar todos los enlaces .htm
    all_links = re.findall(r'(?:href|src)=["\']([^"\']+\.htm[^"\']*)["\']', resp.text, re.IGNORECASE)
    unique_links = set(all_links)
    
    print(f"   Total de enlaces .htm: {len(unique_links)}")
    for link in sorted(unique_links):
        print(f"     - {link}")
    print()
    
    # Buscar números significativos
    numbers = re.findall(r'\b(\d{3,})\b', resp.text)
    unique_numbers = set(n for n in numbers if n not in ['1994', '127', '255', '128', '071003', '100', '2022'])
    
    if unique_numbers:
        print(f"   Números encontrados: {', '.join(sorted(unique_numbers, key=int, reverse=True)[:10])}")
    
    # Buscar palabras clave counter/film
    if 'counter' in resp.text.lower():
        print(f"   ✓ Página contiene la palabra 'counter'")
        # Extraer líneas con "counter"
        lines_with_counter = [line.strip() for line in resp.text.split('\n') if 'counter' in line.lower()]
        print(f"   Líneas con 'counter':")
        for line in lines_with_counter[:5]:
            print(f"     {line[:100]}")
    
except Exception as e:
    print(f"   ✗ Error: {e}")

print()
print("=" * 80)
print("2. EXPLORANDO ENLACES ENCONTRADOS")
print("=" * 80)
print()

# Probar rutas comunes de counter
counter_paths = [
    "/SETTING/Counter.htm",
    "/SETTING/CheckCounter.htm",
    "/SETTING/CheckCounters.htm",
    "/SETTING/Counters.htm",
    "/USER/Counter.htm",
    "/USER/CheckCounter.htm",
    "/USER/enCounter.htm",
    "/USER/enCheckCounter.htm",
]

for path in counter_paths:
    try:
        url = BASE_URL + path
        resp = session.get(url, timeout=5)
        size = len(resp.content)
        
        if size > 1000:  # Contenido sustancial
            print(f"✓ {path}")
            print(f"  Tamaño: {size} bytes")
            
            # Buscar números
            numbers = re.findall(r'\b(\d{3,})\b', resp.text)
            unique_numbers = set(n for n in numbers if n not in ['1994', '127', '255', '128', '071003', '100', '2022'])
            
            if unique_numbers:
                sorted_nums = sorted(unique_numbers, key=int, reverse=True)
                print(f"  Números: {', '.join(sorted_nums[:10])}")
            
            # Guardar
            filename = path.replace('/', '_').replace('.', '_') + '_counter_page.html'
            with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                f.write(resp.text)
            print(f"  ⚠ Guardado: {filename}")
            print()
            
    except Exception as e:
        pass
