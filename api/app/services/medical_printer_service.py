"""
Servicio para monitoreo de impresoras médicas (DRYPIX, etc.)
que no soportan SNMP y requieren web scraping
"""
import requests
from bs4 import BeautifulSoup
import re
import socket
import asyncio
import concurrent.futures
from datetime import datetime
from typing import Dict, Optional, List
from ipaddress import IPv4Address, IPv4Network


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
        if not printer.ip_address:
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
        scraper = DrypixScraper(printer.ip_address, printer.port or 20051)
        return scraper.get_counters()
    
    @staticmethod
    def discover_medical_printer(ip: str, port: int = 20051, timeout: int = 3) -> Optional[Dict]:
        """
        Intenta descubrir una impresora médica en la IP especificada
        
        Args:
            ip: Dirección IP a verificar
            port: Puerto de la interfaz web (default: 20051 para DRYPIX)
            timeout: Timeout en segundos para la conexión
            
        Returns:
            Dict con información de la impresora si se detecta, None si no
        """
        try:
            # Intentar acceder a la página de login DRYPIX
            login_url = f"http://{ip}:{port}/USER/Login.htm"
            
            response = requests.get(login_url, timeout=timeout)
            
            if response.status_code == 200:
                content = response.text.upper()
                
                # Verificar si es una interfaz DRYPIX
                if "DRYPIX" in content or "FUJIFILM" in content:
                    # Intentar autenticación para obtener más información
                    scraper = DrypixScraper(ip, port)
                    if scraper.authenticate():
                        # Obtener contadores para confirmar
                        counters = scraper.get_counters()
                        
                        if counters:
                            return {
                                "ip": ip,
                                "port": port,
                                "type": "medical",
                                "model": "FUJI DRYPIX SMART",
                                "brand": "FUJIFILM",
                                "is_medical": True,
                                "connection_method": "web_interface",
                                "status": counters.get("status", "online"),
                                "trays_info": counters.get("summary", {}),
                                "authenticated": True
                            }
                    
                    # Si no pudo autenticar pero detectó DRYPIX
                    return {
                        "ip": ip,
                        "port": port,
                        "type": "medical",
                        "model": "FUJI DRYPIX SMART",
                        "brand": "FUJIFILM",
                        "is_medical": True,
                        "connection_method": "web_interface",
                        "authenticated": False,
                        "note": "Detectado pero no se pudo autenticar"
                    }
                
                # Verificar otros tipos de impresoras médicas
                if "FCR" in content or "CR" in content:
                    return {
                        "ip": ip,
                        "port": port,
                        "type": "medical",
                        "model": "Computed Radiography",
                        "brand": "Unknown",
                        "is_medical": True,
                        "connection_method": "web_interface",
                        "note": "FCR/CR detectado - requiere implementación específica"
                    }
                    
        except requests.Timeout:
            pass  # Timeout normal, no es impresora médica
        except requests.ConnectionError:
            pass  # No hay servicio en este puerto
        except Exception as e:
            # Error inesperado - registrar pero no fallar
            print(f"Error al descubrir impresora médica en {ip}:{port} - {str(e)}")
        
        return None
    
    @staticmethod
    def discover_medical_printers_in_range(
        ip_range: str, 
        port: int = 20051, 
        timeout: int = 2,
        max_workers: int = 50
    ) -> List[Dict]:
        """
        Escanea un rango de IPs buscando impresoras médicas
        
        Args:
            ip_range: Rango de IPs en formato CIDR (ej: "10.1.10.0/24") 
                     o rango (ej: "10.1.10.1-10.1.10.50")
            port: Puerto a escanear (default: 20051)
            timeout: Timeout por IP en segundos
            max_workers: Número de workers paralelos
            
        Returns:
            Lista de impresoras médicas descubiertas
        """
        discovered = []
        
        # Parsear rango de IPs
        ip_list = []
        try:
            if '-' in ip_range:
                # Formato: 10.1.10.1-10.1.10.50
                start_ip, end_ip = ip_range.split('-')
                start = IPv4Address(start_ip.strip())
                end = IPv4Address(end_ip.strip())
                
                current = start
                while current <= end:
                    ip_list.append(str(current))
                    current += 1
                    
            elif '/' in ip_range:
                # Formato CIDR: 10.1.10.0/24
                network = IPv4Network(ip_range, strict=False)
                ip_list = [str(ip) for ip in network.hosts()]
                
            else:
                # IP individual
                ip_list = [ip_range.strip()]
                
        except Exception as e:
            print(f"Error parseando rango de IPs: {str(e)}")
            return []
        
        print(f"🔍 Escaneando {len(ip_list)} IPs en busca de impresoras médicas en puerto {port}...")
        
        # Escanear en paralelo
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_ip = {
                executor.submit(
                    MedicalPrinterService.discover_medical_printer, 
                    ip, 
                    port, 
                    timeout
                ): ip 
                for ip in ip_list
            }
            
            for future in concurrent.futures.as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    result = future.result()
                    if result:
                        discovered.append(result)
                        print(f"✅ Impresora médica encontrada en {ip}:{port} - {result.get('model')}")
                except Exception as e:
                    print(f"❌ Error escaneando {ip}: {str(e)}")
        
        print(f"🎯 Descubrimiento completado: {len(discovered)} impresoras médicas encontradas")
        return discovered


class DrypixScraper:
    """Web scraper específico para impresoras DRYPIX SMART"""
    
    # Credenciales estándar de mantenimiento DRYPIX
    DEFAULT_LOGIN = "dryprinter"
    DEFAULT_PASSWORD = "fujifilm"
    DEFAULT_LANGUAGE = "en"
    TRAY_CAPACITY = 100
    
    def __init__(self, ip_address: str, port: int = 20051,
                 login: str = None, password: str = None):
        self.base_url = f"http://{ip_address}:{port}"
        self.login = login or self.DEFAULT_LOGIN
        self.password = password or self.DEFAULT_PASSWORD
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
            
            return {
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
            
        except Exception as e:
            print(f"Error obteniendo contadores DRYPIX: {e}")
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


def is_medical_printer(printer) -> bool:
    """
    Determina si una impresora es médica (requiere web scraping)
    
    Args:
        printer: Objeto Printer
        
    Returns:
        True si es impresora médica
    """
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
