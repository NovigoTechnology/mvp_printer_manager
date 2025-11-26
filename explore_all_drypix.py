"""
Exploración exhaustiva de todas las páginas del DRYPIX SMART
para encontrar los contadores reales
"""
import requests
import re

BASE_URL = "http://10.1.10.20:20051"

# Lista exhaustiva de posibles rutas
pages_to_try = [
    # Login y main
    "/USER/Login.htm",
    "/USER/Login_x.htm",
    "/USER/Main.htm",
    "/USER/MainArea.htm",
    "/USER/index.htm",
    
    # Setting
    "/SETTING/Counter.htm",
    "/SETTING/CounterArea.htm",
    "/SETTING/Status.htm",
    "/SETTING/StatusArea.htm",
    "/SETTING/Main.htm",
    "/SETTING/MainArea.htm",
    "/SETTING/Info.htm",
    "/SETTING/Information.htm",
    "/SETTING/Device.htm",
    "/SETTING/DeviceInfo.htm",
    
    # Admin
    "/ADMIN/Counter.htm",
    "/ADMIN/Status.htm",
    "/ADMIN/Main.htm",
    
    # Maintenance
    "/MAINT/Counter.htm",
    "/MAINT/Status.htm",
    "/MAINT/Main.htm",
    
    # Service
    "/SERVICE/Counter.htm",
    "/SERVICE/Status.htm",
    "/SERVICE/Main.htm",
    
    # Root level
    "/Counter.htm",
    "/Status.htm",
    "/Main.htm",
    "/Info.htm",
    "/Information.htm",
    "/index.htm",
    "/default.htm",
]

print("=" * 80)
print("EXPLORANDO TODAS LAS PÁGINAS POSIBLES DEL DRYPIX SMART")
print("=" * 80)
print()

accessible_pages = []

for page in pages_to_try:
    try:
        url = BASE_URL + page
        response = requests.get(url, timeout=5)
        size = len(response.content)
        
        # Solo mostrar páginas con contenido sustancial
        if size > 600:  # Más que un simple frame de 535 bytes
            print(f"✓ {page}")
            print(f"  Tamaño: {size} bytes")
            
            # Buscar números de 3+ dígitos
            text = response.text
            numbers = re.findall(r'\b(\d{3,})\b', text)
            # Filtrar duplicados y números comunes (1994, 127, etc)
            unique_numbers = set(n for n in numbers if n not in ['1994', '127', '255', '128', '071003'])
            
            if unique_numbers:
                print(f"  Números encontrados: {', '.join(sorted(unique_numbers))}")
            
            # Buscar palabras clave de contadores
            keywords = ['counter', 'count', 'total', 'film', 'print', 'sheet', 
                       'カウンタ', '総数', 'フィルム', '枚数']  # Japonés también
            found_keywords = [kw for kw in keywords if kw.lower() in text.lower()]
            if found_keywords:
                print(f"  Palabras clave: {', '.join(found_keywords)}")
            
            # Guardar páginas interesantes
            if unique_numbers or found_keywords:
                filename = page.replace('/', '_').replace('.', '_') + '.html'
                with open(filename, 'w', encoding='utf-8', errors='ignore') as f:
                    f.write(text)
                print(f"  ⚠ Guardado en: {filename}")
                accessible_pages.append((page, size, unique_numbers, found_keywords))
            
            print()
            
    except requests.exceptions.RequestException as e:
        # Silenciar errores de páginas no encontradas
        pass

print("=" * 80)
print(f"RESUMEN: {len(accessible_pages)} páginas con contenido potencial de contadores")
print("=" * 80)

if accessible_pages:
    for page, size, numbers, keywords in accessible_pages:
        print(f"\n{page}:")
        print(f"  - {size} bytes")
        if numbers:
            print(f"  - Números: {', '.join(sorted(numbers))}")
        if keywords:
            print(f"  - Keywords: {', '.join(keywords)}")
else:
    print("\n⚠ No se encontraron páginas con contadores evidentes")
    print("Los contadores podrían estar:")
    print("  1. Detrás del login de mantenimiento")
    print("  2. En un frame o iframe no explorado")
    print("  3. Cargados dinámicamente con JavaScript")
    print("  4. En una ruta no estándar")
