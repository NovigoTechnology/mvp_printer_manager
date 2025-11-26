"""
Explorar frames del sistema de mantenimiento autenticado del DRYPIX
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
print("EXPLORANDO FRAMES DEL SISTEMA AUTENTICADO")
print("=" * 80)
print()

# Frames identificados
frames = [
    "/USER/enTree.htm",  # Menú del árbol
    "/USER/oceanbl.htm",  # Área de ejecución
    "/USER/enEndUtl.htm",  # Página de cierre
]

# También buscar variantes en japonés y otros idiomas
additional_pages = [
    "/USER/jpTree.htm",
    "/USER/Main.htm",
    "/USER/MainArea.htm",
    "/USER/Menu.htm",
    "/USER/Home.htm",
]

all_pages = frames + additional_pages

for page in all_pages:
    try:
        url = BASE_URL + page
        resp = session.get(url, timeout=5)
        size = len(resp.content)
        
        if size > 600:
            print(f"✓ {page}")
            print(f"  Tamaño: {size} bytes")
            
            # Guardar
            filename = page.replace('/', '_').replace('.', '_') + '_frame.html'
            with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                f.write(resp.text)
            print(f"  Guardado: {filename}")
            
            # Buscar enlaces a otras páginas
            links = re.findall(r'(?:src|href)=["\']([^"\']+\.htm[^"\']*)["\']', resp.text, re.IGNORECASE)
            if links:
                unique_links = set(links)
                print(f"  Enlaces encontrados: {len(unique_links)}")
                for link in sorted(unique_links)[:10]:
                    print(f"    - {link}")
            
            # Buscar texto "counter" o "film"
            if 'counter' in resp.text.lower() or 'film' in resp.text.lower():
                print(f"  ⚠ CONTIENE REFERENCIAS A COUNTER/FILM")
            
            print()
            
    except Exception as e:
        pass

print("=" * 80)
print("EXPLORANDO PÁGINAS DESCUBIERTAS EN LOS ENLACES")
print("=" * 80)
print()

# Buscar específicamente páginas que puedan tener contadores
counter_keywords = ['counter', 'count', 'film', 'total', 'status', 'info', 'device']

# Leer el archivo del menú para encontrar enlaces
try:
    with open('_USER_enTree_htm_frame.html', 'r', encoding='utf-8', errors='ignore') as f:
        tree_content = f.read()
        
    # Extraer todos los enlaces .htm
    all_links = re.findall(r'(?:src|href)=["\']([^"\']+\.htm[^"\']*)["\']', tree_content, re.IGNORECASE)
    unique_links = set(all_links)
    
    print(f"Total de enlaces únicos en el menú: {len(unique_links)}")
    print()
    
    interesting_pages = []
    
    for link in sorted(unique_links):
        # Construir URL completa
        if link.startswith('http'):
            url = link
        elif link.startswith('/'):
            url = BASE_URL + link
        else:
            url = BASE_URL + '/USER/' + link
        
        try:
            resp = session.get(url, timeout=5)
            size = len(resp.content)
            
            if size > 800:  # Contenido sustancial
                # Buscar números y palabras clave
                numbers = re.findall(r'\b(\d{3,})\b', resp.text)
                unique_numbers = set(n for n in numbers if n not in ['1994', '127', '255', '128', '071003', '100'])
                
                has_keywords = any(kw in resp.text.lower() for kw in counter_keywords)
                
                if unique_numbers or has_keywords:
                    print(f"✓ {link}")
                    print(f"  URL: {url}")
                    print(f"  Tamaño: {size} bytes")
                    
                    if unique_numbers:
                        sorted_nums = sorted(unique_numbers, key=lambda x: int(x), reverse=True)
                        print(f"  Números: {', '.join(sorted_nums[:5])}")
                    
                    if has_keywords:
                        found = [kw for kw in counter_keywords if kw in resp.text.lower()]
                        print(f"  Keywords: {', '.join(found)}")
                    
                    # Guardar páginas prometedoras
                    filename = link.replace('/', '_').replace('.', '_') + '_discovered.html'
                    with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                        f.write(resp.text)
                    print(f"  ⚠ Guardado: {filename}")
                    
                    interesting_pages.append((link, size, unique_numbers))
                    print()
                    
        except Exception as e:
            pass
    
    print("=" * 80)
    print(f"PÁGINAS INTERESANTES: {len(interesting_pages)}")
    print("=" * 80)
    
except FileNotFoundError:
    print("⚠ No se pudo leer el archivo del menú. Revisar los archivos guardados manualmente.")
