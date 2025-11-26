"""
Servicio para monitoreo de impresoras médicas (DRYPIX, etc.)
que no soportan SNMP y requieren web scraping
"""
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import Dict, Optional, List


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
