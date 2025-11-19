from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import subprocess
import socket
import time
import platform
from datetime import datetime
import json

from ..db import get_db
from ..models import Printer
from ..services.snmp import SNMPService

router = APIRouter()

def ping_host(host: str) -> Dict[str, Any]:
    """Ping a host and return connection status"""
    try:
        # Determine ping command based on OS
        if platform.system().lower() == "windows":
            cmd = ["ping", "-n", "1", "-w", "3000", host]
        else:
            cmd = ["ping", "-c", "1", "-W", "3", host]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        return {
            "success": result.returncode == 0,
            "response_time": "< 3000ms" if result.returncode == 0 else None,
            "output": result.stdout if result.returncode == 0 else result.stderr
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "response_time": None, "output": "Timeout"}
    except Exception as e:
        return {"success": False, "response_time": None, "output": str(e)}

# Instancia del servicio SNMP
snmp_service = SNMPService()

@router.get("/tools/connectivity/{printer_id}")
async def test_connectivity(printer_id: int, db: Session = Depends(get_db)):
    """
    Test de conectividad para una impresora específica.
    Incluye ping y test SNMP.
    """
    # Obtener la impresora
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    result = {
        "printer_id": printer_id,
        "ip": printer.ip,
        "brand": printer.brand,
        "model": printer.model,
        "tests": {},
        "timestamp": datetime.now().isoformat()
    }
    
    # Test de ping
    ping_result = await _test_ping(printer.ip)
    result["tests"]["ping"] = ping_result
    
    # Test SNMP
    snmp_result = await _test_snmp(printer.ip, printer.snmp_profile)
    result["tests"]["snmp"] = snmp_result
    
    # Test de puerto 80 (interfaz web)
    web_result = await _test_web_interface(printer.ip)
    result["tests"]["web_interface"] = web_result
    
    # Evaluación general
    overall_status = "success" if (
        ping_result["success"] and 
        snmp_result["success"]
    ) else "warning" if ping_result["success"] else "error"
    
    result["overall_status"] = overall_status
    
    return result

@router.get("/tools/status/{printer_id}")
async def get_printer_status(printer_id: int, db: Session = Depends(get_db)):
    """
    Obtener el estado actual de la impresora via SNMP.
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    try:
        # Obtener información completa del dispositivo (incluye contadores)
        poll_data = snmp_service.poll_printer(printer.ip, printer.snmp_profile)
        
        if not poll_data:
            raise HTTPException(status_code=500, detail="No se pudo obtener información SNMP")
        
        # Formatear respuesta
        result = {
            "printer_id": printer_id,
            "ip": printer.ip,
            "status": poll_data.get("status", "offline"),
            "pages_printed_mono": poll_data.get("pages_printed_mono", 0),
            "pages_printed_color": poll_data.get("pages_printed_color", 0),
            "total_pages": poll_data.get("pages_printed_mono", 0) + poll_data.get("pages_printed_color", 0),
            "toner_levels": {
                "black": poll_data.get("toner_level_black"),
                "cyan": poll_data.get("toner_level_cyan"),
                "magenta": poll_data.get("toner_level_magenta"),
                "yellow": poll_data.get("toner_level_yellow")
            },
            "paper_level": poll_data.get("paper_level"),
            "timestamp": datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estado: {str(e)}")

@router.get("/tools/counters/{printer_id}")
async def get_printer_counters(printer_id: int, db: Session = Depends(get_db)):
    """
    Obtener contadores de páginas de la impresora.
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    try:
        # Obtener contadores via SNMP
        counters = snmp_service.get_page_counts(printer.ip, printer.snmp_profile)
        
        if not counters:
            raise HTTPException(status_code=500, detail="No se pudieron obtener los contadores")
        
        result = {
            "printer_id": printer_id,
            "ip": printer.ip,
            "counters": counters,
            "timestamp": datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener contadores: {str(e)}")

@router.get("/tools/toner/{printer_id}")
async def get_toner_levels(printer_id: int, db: Session = Depends(get_db)):
    """
    Obtener niveles de tóner de la impresora.
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    try:
        # Obtener información de tóner via SNMP
        poll_data = snmp_service.poll_printer(printer.ip, printer.snmp_profile)
        
        result = {
            "printer_id": printer_id,
            "ip": printer.ip,
            "brand": printer.brand,
            "model": printer.model,
            "is_color": printer.is_color,
            "toner_level_black": poll_data.get("toner_level_black"),
            "toner_level_cyan": poll_data.get("toner_level_cyan"),
            "toner_level_magenta": poll_data.get("toner_level_magenta"),
            "toner_level_yellow": poll_data.get("toner_level_yellow"),
            "timestamp": datetime.now().isoformat()
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener niveles de tóner: {str(e)}")

@router.post("/tools/snmp-config/{printer_id}")
async def test_snmp_configuration(
    printer_id: int, 
    config_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Probar diferentes configuraciones SNMP.
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    communities = config_data.get("communities", ["public", "private"])
    versions = config_data.get("versions", ["2c", "1"])
    
    results = []
    
    for community in communities:
        for version in versions:
            test_result = {
                "community": community,
                "version": version,
                "success": False,
                "response_time": None,
                "error": None
            }
            
            try:
                start_time = time.time()
                device_info = snmp_service.get_device_info(printer.ip, community, version=version)
                end_time = time.time()
                
                if device_info:
                    test_result["success"] = True
                    test_result["response_time"] = round((end_time - start_time) * 1000, 2)
                    test_result["device_info"] = device_info
                else:
                    test_result["error"] = "No response"
                    
            except Exception as e:
                test_result["error"] = str(e)
            
            results.append(test_result)
    
    return {
        "printer_id": printer_id,
        "ip": printer.ip,
        "test_results": results,
        "timestamp": datetime.now().isoformat()
    }

@router.post("/tools/test-print/{printer_id}")
async def send_test_print(
    printer_id: int,
    print_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Enviar página de prueba a la impresora.
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    print_type = print_data.get("type", "basic")
    
    # Por ahora, simular el envío de página de prueba
    # En el futuro se puede implementar con protocolos de impresión reales
    
    result = {
        "printer_id": printer_id,
        "ip": printer.ip,
        "print_type": print_type,
        "status": "simulated",
        "message": "Funcionalidad de impresión en desarrollo. Se implementará con protocolos IPP/LPR.",
        "timestamp": datetime.now().isoformat()
    }
    
    return result

# Funciones auxiliares
async def _test_ping(ip: str) -> Dict[str, Any]:
    """Test de ping a la IP especificada."""
    try:
        start_time = time.time()
        
        # En Windows usar ping, en Linux/Mac usar ping
        import platform
        system = platform.system().lower()
        
        if system == "windows":
            result = subprocess.run(
                ["ping", "-n", "1", "-w", "3000", ip],
                capture_output=True,
                text=True,
                timeout=5
            )
        else:
            result = subprocess.run(
                ["ping", "-c", "1", "-W", "3", ip],
                capture_output=True,
                text=True,
                timeout=5
            )
        
        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)
        
        return {
            "success": result.returncode == 0,
            "response_time_ms": response_time if result.returncode == 0 else None,
            "output": result.stdout if result.returncode == 0 else result.stderr
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "response_time_ms": None,
            "output": "Timeout - No response within 5 seconds"
        }
    except Exception as e:
        return {
            "success": False,
            "response_time_ms": None,
            "output": f"Error: {str(e)}"
        }

async def _test_snmp(ip: str, community: str) -> Dict[str, Any]:
    """Test de conectividad SNMP."""
    try:
        start_time = time.time()
        device_info = snmp_service.get_device_info(ip, community)
        end_time = time.time()
        
        if device_info:
            return {
                "success": True,
                "response_time_ms": round((end_time - start_time) * 1000, 2),
                "community": community,
                "device_info": device_info
            }
        else:
            return {
                "success": False,
                "response_time_ms": None,
                "community": community,
                "error": "No SNMP response"
            }
            
    except Exception as e:
        return {
            "success": False,
            "response_time_ms": None,
            "community": community,
            "error": str(e)
        }

async def _test_web_interface(ip: str, port: int = 80, timeout: int = 3) -> Dict[str, Any]:
    """Test de conectividad al puerto web de la impresora."""
    try:
        start_time = time.time()
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        
        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)
        
        return {
            "success": result == 0,
            "port": port,
            "response_time_ms": response_time if result == 0 else None,
            "accessible": result == 0
        }
        
    except Exception as e:
        return {
            "success": False,
            "port": port,
            "response_time_ms": None,
            "accessible": False,
            "error": str(e)
        }