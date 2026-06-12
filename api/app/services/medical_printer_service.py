"""
Servicio para monitoreo de impresoras médicas (DRYPIX, etc.)
que no soportan SNMP y requieren web scraping
"""
import os
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import Dict, Optional, List
import socket
import concurrent.futures

from ..config import settings


class MedicalPrinterService:
    """Servicio principal para impresoras médicas"""
    
    def __init__(self):
        self.session = requests.Session()
    
    def poll_printer(self, printer) -> Optional[Dict]:
        """
        Obtiene datos de una impresora médica según su modelo
        
        Args:
            printer: Objeto Printer de la base de datos
            
        Returns:
            Dict con los datos obtenidos o None si hay error
        """
        if not printer.ip:
            return None
        
        # Determinar tipo de impresora médica por modelo
        model = printer.model.upper() if printer.model else ""
        
        if "DRYPIX" in model:
            return self._poll_drypix(printer)
        else:
            # Aquí se pueden agregar otros tipos de impresoras médicas
            return None
    
    def _poll_drypix(self, printer) -> Optional[Dict]:
        """Obtiene contadores del DRYPIX SMART"""
        scraper = DrypixScraper(printer.ip, 20051)
        return scraper.get_counters()


class DrypixScraper:
    """Web scraper específico para impresoras DRYPIX SMART"""
    
    # Constantes de configuración
    DEFAULT_LANGUAGE = "en"
    TRAY_CAPACITY = 100
    
    def __init__(self, ip_address: str, port: int = 20051,
                 login: str = None, password: str = None):
        """
        Inicializa el scraper para impresora DRYPIX.
        
        Args:
            ip_address: Dirección IP de la impresora
            port: Puerto (default: 20051)
            login: Usuario de mantenimiento (default: desde config)
            password: Contraseña de mantenimiento (default: desde config)
        """
        self.base_url = f"http://{ip_address}:{port}"
        # Credenciales desde config centralizado (lazy loading)
        self.login = login if login is not None else settings.drypix_login
        self.password = password if password is not None else settings.drypix_password
        self.session = requests.Session()
    
    def authenticate(self) -> bool:
        """
        Autentica en el modo de mantenimiento del DRYPIX
        
        Returns:
            True si el login fue exitoso
        """
        try:
            login_url = (f"{self.base_url}/USER/chkin={self.login}"
                        f"&passwd={self.password}&Language={self.DEFAULT_LANGUAGE}")
            
            response = self.session.get(login_url, timeout=10)
            
            # Verificar si el login fue exitoso
            if response.status_code == 200 and "main" in response.text.lower():
                return True
            return False
            
        except Exception as e:
            print(f"Error en autenticación DRYPIX: {e}")
            return False
    
    def logout(self) -> bool:
        """
        Cierra la sesión en el modo de mantenimiento del DRYPIX
        
        Returns:
            True si el logout fue exitoso
        """
        try:
            logout_url = f"{self.base_url}/USER/chkout"
            response = self.session.get(logout_url, timeout=5)
            
            # Cerrar la sesión de requests
            self.session.close()
            
            if response.status_code == 200:
                print(f"✅ Logout exitoso de DRYPIX en {self.base_url}")
                return True
            return False
            
        except Exception as e:
            print(f"Error en logout DRYPIX: {e}")
            # Intentar cerrar la sesión de todos modos
            try:
                self.session.close()
            except:
                pass
            return False
    
    def get_counters(self) -> Optional[Dict]:
        """
        Obtiene los contadores de bandejas del DRYPIX
        
        Returns:
            Dict con información de contadores o None si hay error
        """
        try:
            # Autenticar
            if not self.authenticate():
                return None
            
            # Acceder a la página Setting2 que contiene los contadores
            setting2_url = f"{self.base_url}/SETTING/?settingMode=5"
            response = self.session.get(setting2_url, timeout=10)
            
            if response.status_code != 200:
                return None
            
            # Parsear contadores
            counters = self._parse_counters(response.text)
            
            if not counters:
                return None
            
            # Calcular placas disponibles e impresas
            tray_details = {}
            total_available = 0
            total_printed = 0
            
            for tray, available in counters.items():
                if available > 0:
                    printed = self.TRAY_CAPACITY - available
                else:
                    printed = 0
                
                tray_details[tray] = {
                    "available": available,
                    "printed": printed
                }
                total_available += available
                total_printed += printed
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "tray_capacity": self.TRAY_CAPACITY,
                "trays": tray_details,
                "summary": {
                    "total_available": total_available,
                    "total_printed": total_printed,
                    "total_trays_loaded": sum(1 for v in tray_details.values() 
                                             if v["available"] > 0)
                },
                # Para compatibilidad con el sistema de impresoras
                "status": "online",
                "pages_printed": total_printed,  # Equivalente a films impresos
                "is_online": True
            }
            
            # Cerrar sesión antes de retornar
            self.logout()
            return result
            
        except Exception as e:
            print(f"Error obteniendo contadores DRYPIX: {e}")
            # Intentar hacer logout incluso si hay error
            try:
                self.logout()
            except:
                pass
            return None
    
    def _parse_counters(self, html: str) -> Optional[Dict[str, int]]:
        """
        Extrae los contadores del HTML de Setting2
        
        Args:
            html: Contenido HTML de la página
            
        Returns:
            Dict con {TrayN: cantidad_disponible}
        """
        try:
            # Intentar con BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            tables = soup.find_all('table', width="150", border="1")
            
            counters = {}
            
            if tables:
                # Parsear con BeautifulSoup
                counter_table = tables[0]
                rows = counter_table.find_all('tr')
                
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) == 2:
                        tray_name = cells[0].get_text().strip()
                        count = cells[1].get_text().strip()
                        
                        if tray_name.startswith('Tray'):
                            counters[tray_name] = int(count)
            else:
                # Método alternativo: regex
                match = re.search(
                    r'<B>Check Counters</B>.*?<TABLE[^>]*>(.*?)</TABLE>',
                    html, re.DOTALL | re.IGNORECASE
                )
                
                if match:
                    table_html = match.group(1)
                    tray_matches = re.findall(
                        r'(Tray\d+).*?ALIGN="RIGHT"[^>]*>\s*(\d+)',
                        table_html, re.DOTALL
                    )
                    
                    for tray_name, count in tray_matches:
                        counters[tray_name] = int(count)
            
            return counters if counters else None
            
        except Exception as e:
            print(f"Error parseando contadores: {e}")
            return None
    
    def get_device_info(self) -> Optional[Dict[str, str]]:
        """
        Intenta obtener información del dispositivo (serial, modelo, etc.)
        
        Returns:
            Dict con información del dispositivo o None si hay error
        """
        try:
            # Autenticar
            if not self.authenticate():
                return None
            
            info = {}
            
            # Intentar obtener información de diferentes páginas
            # Página de información del sistema (settingMode=0 a 8)
            for mode in [0, 1, 2, 3, 4, 6, 7, 8]:
                try:
                    info_url = f"{self.base_url}/SETTING/?settingMode={mode}"
                    response = self.session.get(info_url, timeout=5)
                    
                    if response.status_code == 200:
                        html = response.text
                        
                        # Buscar número de serie con varios patrones
                        serial_patterns = [
                            # Patrón para value en input después de "Serial No."
                            r'Serial\s*(?:No\.?|Number)?\s*</TD>.*?value="([A-Z0-9\-]+)"',
                            # Patrón para S/N en input
                            r'S/N\s*</TD>.*?value="([A-Z0-9\-]+)"',
                            # Patrón directo (texto)
                            r'Serial\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9\-]+)',
                            r'Machine\s*(?:ID|Number)\s*[:\-]?\s*([A-Z0-9\-]+)',
                            r'Device\s*(?:ID|Serial)\s*[:\-]?\s*([A-Z0-9\-]+)',
                        ]
                        
                        for pattern in serial_patterns:
                            match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
                            if match:
                                serial = match.group(1).strip()
                                if len(serial) > 3 and serial not in ['VALUE', 'TEXT', 'INPUT']:
                                    info['serial_number'] = serial
                                    print(f"✅ Serial encontrado para {self.base_url}: {serial}")
                                    # Cerrar sesión antes de retornar
                                    self.logout()
                                    return info
                except Exception as e:
                    continue
            
            # Cerrar sesión antes de retornar
            self.logout()
            return info if info else None
            
        except Exception as e:
            print(f"Error obteniendo información del dispositivo: {e}")
            # Intentar hacer logout incluso si hay error
            try:
                self.logout()
            except:
                pass
            return None


def is_medical_printer(printer) -> bool:
    """
    Determina si una impresora es médica (requiere web scraping)
    
    Args:
        printer: Objeto Printer
        
    Returns:
        True si es impresora médica
    """
    if hasattr(printer, "is_medical"):
        return bool(printer.is_medical)

    if not printer.model:
        return False

    model = printer.model.upper()
    medical_models = ["DRYPIX", "FCR", "CR", "DI-HL"]

    return any(medical_model in model for medical_model in medical_models)


def get_medical_printer_type(printer) -> Optional[str]:
    """
    Obtiene el tipo de impresora médica
    
    Args:
        printer: Objeto Printer
        
    Returns:
        Tipo de impresora médica o None
    """
    if not printer.model:
        return None
    
    model = printer.model.upper()
    
    if "DRYPIX" in model:
        return "drypix"
    elif "FCR" in model or "CR" in model:
        return "computed_radiography"
    elif "DI-HL" in model:
        return "dihl"
    
    return None


# ==================== DESCUBRIMIENTO DE IMPRESORAS MÉDICAS ====================

def check_drypix_web_interface(ip: str, port: int = 20051, timeout: int = 3) -> Optional[Dict]:
    """
    Verifica si existe una interfaz web DRYPIX en la IP y puerto especificados
    
    Args:
        ip: Dirección IP a verificar
        port: Puerto (por defecto 20051 para DRYPIX)
        timeout: Timeout en segundos
        
    Returns:
        Dict con información del dispositivo si es DRYPIX, None si no
    """
    try:
        # Intentar conexión al endpoint de login
        login_url = f"http://{ip}:{port}/USER/Login.htm"
        response = requests.get(login_url, timeout=timeout)
        
        if response.status_code == 200:
            html_lower = response.text.lower()
            
            # Verificar si contiene referencias a DRYPIX o FUJIFILM
            is_drypix = any(keyword in html_lower for keyword in [
                'drypix', 'fujifilm', 'fuji', 'dry imager'
            ])
            
            if is_drypix:
                # Intentar obtener más información autenticándose
                device_info = {
                    'ip': ip,
                    'port': port,
                    'brand': 'FUJIFILM',
                    'model': 'DRYPIX SMART',
                    'type': 'medical',
                    'protocol': 'web',
                    'is_online': True
                }
                
                # Intentar autenticación para confirmar
                scraper = DrypixScraper(ip, port)
                if scraper.authenticate():
                    device_info['authenticated'] = True
                    
                    # Intentar obtener número de serie
                    try:
                        info = scraper.get_device_info()
                        if info and 'serial_number' in info:
                            device_info['serial_number'] = info['serial_number']
                    except Exception as e:
                        print(f"No se pudo obtener serial de {ip}: {e}")
                    
                    # Intentar obtener información del modelo desde la interfaz
                    try:
                        # Intentar obtener contadores para validar funcionalidad
                        counters = scraper.get_counters()
                        if counters:
                            device_info['counters_available'] = True
                            device_info['trays'] = len(counters.get('trays', {}))
                    except:
                        pass
                
                return device_info
                
        return None
        
    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.ConnectionError:
        return None
    except Exception as e:
        print(f"Error verificando DRYPIX en {ip}:{port} - {str(e)}")
        return None


def discover_medical_printers(
    ip_list: List[str], 
    port: int = 20051, 
    timeout: int = 3,
    max_workers: int = 20
) -> List[Dict]:
    """
    Descubre impresoras médicas DRYPIX en una lista de IPs
    mediante escaneo de interfaz web
    
    Args:
        ip_list: Lista de IPs a escanear
        port: Puerto a verificar (por defecto 20051)
        timeout: Timeout por IP en segundos
        max_workers: Número de workers paralelos
        
    Returns:
        Lista de dispositivos médicos encontrados
    """
    discovered_medical = []
    
    print(f"🏥 Iniciando descubrimiento de impresoras médicas en {len(ip_list)} IPs...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Crear tasks para cada IP
        future_to_ip = {
            executor.submit(check_drypix_web_interface, ip, port, timeout): ip 
            for ip in ip_list
        }
        
        # Procesar resultados
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                device_info = future.result()
                if device_info:
                    discovered_medical.append(device_info)
                    print(f"✅ DRYPIX encontrado en {ip}:{port}")
            except Exception as e:
                print(f"❌ Error procesando {ip}: {str(e)}")
    
    print(f"🏥 Descubrimiento médico completado: {len(discovered_medical)} dispositivos encontrados")
    
    return discovered_medical


def discover_medical_printers_in_range(
    ip_range: str,
    port: int = 20051,
    timeout: int = 3,
    max_workers: int = 20
) -> List[Dict]:
    """
    Descubre impresoras médicas en un rango de IPs
    
    Args:
        ip_range: Rango de IPs (CIDR, rango, o IP individual)
        port: Puerto a verificar
        timeout: Timeout por IP
        max_workers: Workers paralelos
        
    Returns:
        Lista de dispositivos médicos encontrados
    """
    import ipaddress
    
    # Parsear rango de IPs
    ip_list = []
    
    try:
        if '-' in ip_range:
            # Formato: 192.168.1.1-192.168.1.100
            start_ip, end_ip = ip_range.split('-')
            start = ipaddress.IPv4Address(start_ip.strip())
            end = ipaddress.IPv4Address(end_ip.strip())
            
            current = start
            while current <= end:
                ip_list.append(str(current))
                current += 1
                
        elif '/' in ip_range:
            # Formato CIDR: 192.168.1.0/24
            network = ipaddress.IPv4Network(ip_range, strict=False)
            ip_list = [str(ip) for ip in network.hosts()]
            
        else:
            # IP individual
            ip = ipaddress.IPv4Address(ip_range.strip())
            ip_list = [str(ip)]
            
    except Exception as e:
        print(f"Error parseando rango de IPs: {e}")
        return []
    
    # Realizar descubrimiento
    return discover_medical_printers(ip_list, port, timeout, max_workers)
