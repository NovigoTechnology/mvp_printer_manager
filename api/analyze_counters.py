#!/usr/bin/env python3
import sys
sys.path.insert(0, '/app')

from app.database import get_db
from app.models import MedicalPrinterCounter, Printer
from collections import Counter as PyCounter
from datetime import datetime

db = next(get_db())

printer = db.query(Printer).filter(Printer.name.like('%DRYPIX%')).first()
if not printer:
    print("No se encontró DRYPIX")
    sys.exit(1)

print(f"=== Análisis de medical_printer_counters ===")
print(f"Impresora: {printer.name} (ID: {printer.id})")
print()

# Obtener últimos 100 registros
counters = db.query(MedicalPrinterCounter)\
    .filter(MedicalPrinterCounter.printer_id == printer.id)\
    .order_by(MedicalPrinterCounter.timestamp.desc())\
    .limit(100)\
    .all()

print(f"Total registros (últimos 100): {len(counters)}")

# Agrupar por fecha
dates = [c.timestamp.date() for c in counters]
date_counts = PyCounter(dates)
print(f"Fechas únicas: {len(date_counts)}")
print()

# Mostrar registros por fecha
print("📅 REGISTROS POR FECHA (últimas 10 fechas):")
print("-" * 80)
for date, count in sorted(date_counts.items(), reverse=True)[:10]:
    symbol = "⚠️ " if count > 1 else "✓ "
    print(f"{symbol} {date}: {count} registros")

# Agrupar por método de recolección
methods = [c.collection_method or 'N/A' for c in counters]
method_counts = PyCounter(methods)
print()
print("📊 REGISTROS POR MÉTODO:")
print("-" * 80)
for method, count in method_counts.most_common():
    print(f"  {method:15s}: {count:3d} registros")

# Mostrar últimos 25 registros con detalle
print()
print("📋 ÚLTIMOS 25 REGISTROS:")
print("-" * 100)
print(f"{'Timestamp':<20} {'Method':<12} {'Printed':>8} {'Available':>10} {'Cambio':>8}")
print("-" * 100)

for c in counters[:25]:
    timestamp_str = c.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    method = c.collection_method or 'N/A'
    cambio = "🔄 SÍ" if c.cartridge_change_detected else ""
    print(f"{timestamp_str:<20} {method:<12} {c.total_printed:>8} {c.total_available:>10} {cambio:>8}")

# Detectar duplicados del mismo día
print()
print("🔍 ANÁLISIS DE DUPLICADOS:")
print("-" * 80)

from collections import defaultdict
by_date = defaultdict(list)
for c in counters:
    by_date[c.timestamp.date()].append(c)

duplicates_found = False
for date in sorted(by_date.keys(), reverse=True)[:10]:
    records = by_date[date]
    if len(records) > 1:
        duplicates_found = True
        print(f"\n⚠️  {date} - {len(records)} registros:")
        for i, c in enumerate(records, 1):
            time_str = c.timestamp.strftime('%H:%M:%S')
            method = c.collection_method or 'N/A'
            cambio = "🔄" if c.cartridge_change_detected else "  "
            print(f"    {i}. {time_str} | {method:10s} | {cambio} | Printed: {c.total_printed:4d} | Available: {c.total_available:4d}")

if not duplicates_found:
    print("\n✅ No se encontraron duplicados en las últimas 10 fechas")
