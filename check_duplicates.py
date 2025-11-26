import sys
sys.path.append('/app')

from app.database import get_db
from app.models import MedicalPrinterCounter, Printer
from datetime import datetime, timedelta

db = next(get_db())

printer = db.query(Printer).filter(Printer.name.like('%DRYPIX%')).first()
if not printer:
    print("No se encontró impresora DRYPIX")
    exit()

print(f"Impresora: {printer.name}")
print("=" * 120)

counters = db.query(MedicalPrinterCounter)\
    .filter(MedicalPrinterCounter.printer_id == printer.id)\
    .order_by(
        MedicalPrinterCounter.counter_date.desc(), 
        MedicalPrinterCounter.tray_number,
        MedicalPrinterCounter.created_at.desc()
    )\
    .limit(50)\
    .all()

print(f"Total registros (últimos 50): {len(counters)}\n")

# Agrupar por fecha
from collections import defaultdict
by_date = defaultdict(list)
for c in counters:
    by_date[c.counter_date].append(c)

print(f"Fechas únicas: {len(by_date)}\n")

# Mostrar registros por fecha
for date in sorted(by_date.keys(), reverse=True)[:10]:
    records = by_date[date]
    print(f"\n📅 {date} - {len(records)} registros:")
    print("-" * 120)
    
    for c in sorted(records, key=lambda x: (x.tray_number, x.created_at.time())):
        time_str = c.created_at.strftime('%H:%M:%S')
        cambio = "🔄" if c.cartridge_change_detected else "  "
        print(f"  {cambio} Tray {c.tray_number} | Disp: {c.disponibles:3d} | Imp: {c.impresos:4d} | "
              f"Total: {c.total_printed:4d} | Creado: {time_str}")

# Detectar duplicados exactos (misma fecha, mismo tray, múltiples registros)
print("\n\n🔍 ANÁLISIS DE DUPLICADOS:")
print("=" * 120)

duplicates_found = False
for date in sorted(by_date.keys(), reverse=True)[:10]:
    records = by_date[date]
    
    # Agrupar por tray
    by_tray = defaultdict(list)
    for c in records:
        by_tray[c.tray_number].append(c)
    
    for tray, tray_records in by_tray.items():
        if len(tray_records) > 1:
            duplicates_found = True
            print(f"\n⚠️  {date} - Tray {tray}: {len(tray_records)} registros")
            for i, c in enumerate(sorted(tray_records, key=lambda x: x.created_at), 1):
                time_str = c.created_at.strftime('%H:%M:%S')
                cambio = "🔄" if c.cartridge_change_detected else "  "
                print(f"    {i}. {cambio} Disp: {c.disponibles:3d} | Imp: {c.impresos:4d} | "
                      f"Total: {c.total_printed:4d} | Creado: {time_str}")

if not duplicates_found:
    print("\n✅ No se encontraron duplicados (múltiples registros para la misma fecha y tray)")
