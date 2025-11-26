"""
Script para hacer login en DRYPIX SMART y acceder a los contadores
"""
import requests
import re

BASE_URL = "http://10.1.10.20:20051"

# Credenciales
LOGIN = "dryprinter"
PASSWORD = "fujifilm"
LANGUAGE = "en"

print("=" * 80)
print("ACCEDIENDO AL MODO DE MANTENIMIENTO DEL DRYPIX SMART")
print("=" * 80)
print()

# Crear sesión para mantener cookies
session = requests.Session()

# Construir URL de login según el JavaScript del formulario
login_url = f"{BASE_URL}/USER/chkin={LOGIN}&passwd={PASSWORD}&Language={LANGUAGE}"

print(f"1. Intentando login...")
print(f"   URL: {login_url}")

try:
    response = session.get(login_url, timeout=10)
    print(f"   Status: {response.status_code}")
    print(f"   Tamaño: {len(response.content)} bytes")
    
    # Guardar respuesta
    with open('drypix_login.html', 'w', encoding='utf-8', errors='ignore') as f:
        f.write(response.text)
    print(f"   ✓ Guardado en: drypix_login.html")
    print()
    
    # Buscar indicios de éxito/fallo
    if 'error' in response.text.lower() or 'invalid' in response.text.lower():
        print("   ⚠ Posible error de login")
    elif 'main' in response.text.lower() or 'menu' in response.text.lower():
        print("   ✓ Login exitoso - página principal detectada")
    
    print()
    
    # Ahora intentar acceder a páginas de contador con la sesión autenticada
    counter_pages = [
        "/SETTING/Counter.htm",
        "/SETTING/CounterArea.htm",
        "/USER/Counter.htm",
        "/MAINT/Counter.htm",
        "/SERVICE/Counter.htm",
        "/Counter.htm",
        "/SETTING/Status.htm",
        "/SETTING/Info.htm",
        "/SETTING/MainArea.htm",
    ]
    
    print("2. Buscando páginas de contadores con sesión autenticada...")
    print()
    
    interesting_pages = []
    
    for page in counter_pages:
        try:
            url = BASE_URL + page
            resp = session.get(url, timeout=5)
            size = len(resp.content)
            
            # Buscar números significativos (excluyendo fechas y constantes comunes)
            numbers = re.findall(r'\b(\d{3,})\b', resp.text)
            unique_numbers = set(n for n in numbers if n not in ['1994', '127', '255', '128', '071003', '100'])
            
            # Buscar palabras clave
            keywords = ['counter', 'count', 'total', 'film', 'print', 'sheet', 'exposed', 
                       'カウンタ', '総数', 'フィルム', '枚数']
            found_keywords = [kw for kw in keywords if kw.lower() in resp.text.lower()]
            
            if size > 600 and (unique_numbers or found_keywords or size > 2000):
                print(f"✓ {page}")
                print(f"  Tamaño: {size} bytes")
                
                if unique_numbers:
                    print(f"  Números: {', '.join(sorted(unique_numbers, key=int, reverse=True)[:10])}")
                
                if found_keywords:
                    print(f"  Keywords: {', '.join(found_keywords)}")
                
                # Guardar páginas con contenido sustancial
                if size > 1500 or unique_numbers or found_keywords:
                    filename = page.replace('/', '_').replace('.', '_') + '_auth.html'
                    with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                        f.write(resp.text)
                    print(f"  ⚠ Guardado en: {filename}")
                    interesting_pages.append((page, size, unique_numbers, found_keywords))
                
                print()
                
        except Exception as e:
            pass
    
    print("=" * 80)
    print(f"RESUMEN: {len(interesting_pages)} páginas encontradas")
    print("=" * 80)
    
    if interesting_pages:
        print()
        for page, size, numbers, keywords in interesting_pages:
            print(f"{page}: {size} bytes")
            if numbers:
                sorted_nums = sorted(numbers, key=int, reverse=True)
                print(f"  Números: {', '.join(sorted_nums[:5])}")
    else:
        print("\n⚠ No se encontraron páginas con contadores después del login")
        print("Puede que necesitemos navegar a través de frames o menús")
        
except Exception as e:
    print(f"✗ Error: {e}")
