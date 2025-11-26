"""
Script para obtener contadores del DRYPIX desde la página web
"""

import requests
import re

DRYPIX_IP = "10.1.10.20"
DRYPIX_PORT = 20051

print("=" * 80)
print("OBTENIENDO CONTADORES DEL DRYPIX")
print("=" * 80)

session = requests.Session()

# Las páginas más prometedoras
pages = [
    "/SETTING/Counter.htm",
    "/USER/Login_x.htm",
]

for page in pages:
    try:
        url = f"http://{DRYPIX_IP}:{DRYPIX_PORT}{page}"
        response = session.get(url, timeout=5)
        
        print(f"\n[{page}]")
        print(f"Status: {response.status_code}")
        print(f"Tamaño: {len(response.content)} bytes")
        
        # Guardar el HTML para análisis
        filename = page.replace("/", "_").replace(".", "_") + ".html"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(response.text)
        print(f"✓ Guardado en: {filename}")
        
        # Buscar números que parezcan contadores
        numbers = re.findall(r'\b(\d{4,})\b', response.text)
        if numbers:
            unique_numbers = list(set(numbers))
            unique_numbers.sort(key=lambda x: int(x), reverse=True)
            print(f"\nNúmeros encontrados (posibles contadores):")
            for num in unique_numbers[:10]:
                print(f"  {num}")
        
        # Buscar tablas con datos
        tables = re.findall(r'<table[^>]*>(.*?)</table>', response.text, re.I | re.S)
        if tables:
            print(f"\nSe encontraron {len(tables)} tablas en la página")
        
        # Buscar texto relacionado con contadores
        keywords = ['film', 'counter', 'total', 'count', 'sheet', 'print']
        print(f"\nPalabras clave encontradas:")
        for keyword in keywords:
            matches = re.findall(f'[^>]*{keyword}[^<]*', response.text, re.I)
            if matches:
                print(f"  {keyword}: {len(matches)} ocurrencias")
                # Mostrar algunas
                for match in matches[:2]:
                    clean = re.sub(r'<[^>]+>', '', match).strip()
                    if clean and len(clean) < 100:
                        print(f"    → {clean}")
        
    except Exception as e:
        print(f"✗ Error: {e}")

print("\n" + "=" * 80)
print("SIGUIENTE PASO")
print("=" * 80)
print("""
Revisa los archivos HTML guardados para identificar exactamente
dónde están los contadores.

Archivos guardados:
- _SETTING_Counter_htm.html
- _USER_Login_x_htm.html

Ábrelos con un navegador o editor de texto y busca los valores
de los contadores para crear un scraper específico.
""")
print("=" * 80)
