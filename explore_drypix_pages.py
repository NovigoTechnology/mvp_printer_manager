"""
Script para explorar la estructura web del DRYPIX y encontrar páginas de contadores
"""

import requests
from urllib.parse import urljoin
import re

DRYPIX_IP = "10.1.10.20"
DRYPIX_PORT = 20051
BASE_URL = f"http://{DRYPIX_IP}:{DRYPIX_PORT}"

print("=" * 80)
print("EXPLORANDO ESTRUCTURA WEB DEL DRYPIX SMART")
print("=" * 80)

# Páginas comunes en equipos similares
pages_to_try = [
    "/USER/Login_x.htm",
    "/USER/Status.htm",
    "/USER/Counter.htm",
    "/USER/Counters.htm",
    "/USER/Info.htm",
    "/USER/System.htm",
    "/USER/Check.htm",
    "/USER/CheckCounter.htm",
    "/USER/Menu.htm",
    "/USER/Main.htm",
    "/USER/Frame.htm",
    "/SETTING/Counter.htm",
    "/SETTING/Status.htm",
    "/STATUS/Counter.htm",
    "/STATUS/Info.htm",
    "/counter.htm",
    "/status.htm",
    "/info.htm",
]

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

found_pages = []

print("\n[BUSCANDO PÁGINAS DISPONIBLES]")
for page in pages_to_try:
    try:
        url = urljoin(BASE_URL, page)
        response = session.get(url, timeout=3)
        
        if response.status_code == 200:
            size = len(response.content)
            print(f"✓ {page:<30} - {size:>6} bytes")
            found_pages.append({
                'url': page,
                'size': size,
                'content': response.text
            })
            
            # Buscar palabras clave en el contenido
            keywords = []
            if re.search(r'counter|count|total|film', response.text, re.I):
                keywords.append('COUNTER')
            if re.search(r'serial|s/n|number', response.text, re.I):
                keywords.append('SERIAL')
            if re.search(r'status|state|condition', response.text, re.I):
                keywords.append('STATUS')
            if re.search(r'\d{6,}', response.text):  # Números largos (posibles contadores)
                keywords.append('NUMBERS')
                
            if keywords:
                print(f"  └─ Contiene: {', '.join(keywords)}")
                
    except requests.exceptions.Timeout:
        pass
    except requests.exceptions.ConnectionError:
        pass
    except Exception:
        pass

# Analizar las páginas encontradas con más detalle
print("\n" + "=" * 80)
print("ANÁLISIS DETALLADO DE PÁGINAS ENCONTRADAS")
print("=" * 80)

for page_data in found_pages:
    content = page_data['content']
    
    # Buscar números que parezcan contadores
    numbers = re.findall(r'\b\d{4,}\b', content)
    if numbers:
        print(f"\n[{page_data['url']}]")
        print(f"Números encontrados (posibles contadores): {', '.join(set(numbers)[:10])}")
    
    # Buscar campos de formulario o tablas
    inputs = re.findall(r'<input[^>]*name=["\']([^"\']+)', content, re.I)
    if inputs:
        print(f"Campos de formulario: {', '.join(set(inputs)[:5])}")
    
    # Buscar frames adicionales
    frames = re.findall(r'src=["\']([^"\']+\.htm[^"\']*)', content, re.I)
    if frames:
        print(f"Frames/páginas referenciadas: {', '.join(set(frames)[:5])}")

print("\n" + "=" * 80)
print("RECOMENDACIONES")
print("=" * 80)

if found_pages:
    print("""
Páginas encontradas que podrían contener contadores.
Revisa manualmente cada una en el navegador para identificar
cuál tiene los contadores de films.

Para automatizar la extracción:
1. Identifica la página exacta con los contadores
2. Analiza el HTML para encontrar los selectores CSS o patrones
3. Crea un scraper específico para esa página

Ejemplo de código una vez identificada la página:
    response = requests.get('http://10.1.10.20:20051/USER/[PAGINA]')
    # Extraer datos específicos del HTML
""")
else:
    print("""
No se encontraron páginas accesibles directamente.
El sistema puede requerir autenticación.

Opciones:
1. Revisar manualmente la interfaz web
2. Buscar en el menú "Check Counters" o similar
3. Verificar si requiere login
4. Consultar manual del equipo para API o endpoint de datos
""")

print("=" * 80)
