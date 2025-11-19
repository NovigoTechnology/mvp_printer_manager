from pysnmp.hlapi import *
import os
import re
import requests
import urllib3
from bs4 import BeautifulSoup
from typing import Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SNMPService:
    def __init__(self, community: str = None):
        self.community = community or os.getenv('POLL_COMMUNITY', 'public')
        
        # SNMPv3 credentials for specific printers
        self.v3_credentials = {
            '10.10.9.11': {  # OKI ES5162LP
                'username': 'root',
                'auth_key': '12345678',
                'priv_key': '12345678',
                'context_name': 'v3context',
                'auth_protocol': usmHMACMD5AuthProtocol,
                'priv_protocol': usmDESPrivProtocol
            },
            '10.10.9.7': {  # OKI ES5162LP MFP - Nueva configuración
                'username': 'root',
                'auth_key': '12345678',  # Cambia por la contraseña real si es diferente
                'priv_key': '12345678',  # Cambia por la contraseña real si es diferente
                'context_name': 'v3context',
                'auth_protocol': usmHMACMD5AuthProtocol,
                'priv_protocol': usmDESPrivProtocol
            },
            '10.10.9.15': {  # OKI - SNMPv3 configurada según imagen
                'username': 'root',
                'auth_key': '12345678',  # Usar la misma configuración estándar
                'priv_key': '12345678',  # Usar la misma configuración estándar
                'context_name': 'v3context',
                'auth_protocol': usmHMACMD5AuthProtocol,
                'priv_protocol': usmDESPrivProtocol
            }
        }
        
        # OID mappings for different printer profiles
        self.profiles = {
            'hp': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',
                'pages_mono': '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.1',  # HP specific
                'pages_color': '1.3.6.1.4.1.11.2.3.9.4.2.1.1.16.1.2', # HP specific
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0',        # sysLocation
                # Color detection OIDs
                'colorant_1': '1.3.6.1.2.1.43.12.1.1.4.1.1',   # prtMarkerColorantValue
                'colorant_2': '1.3.6.1.2.1.43.12.1.1.4.1.2',
                'colorant_3': '1.3.6.1.2.1.43.12.1.1.4.1.3', 
                'colorant_4': '1.3.6.1.2.1.43.12.1.1.4.1.4',
                'marker_supply_1': '1.3.6.1.2.1.43.11.1.1.6.1.1', # prtMarkerSupplyDescription
                'marker_supply_2': '1.3.6.1.2.1.43.11.1.1.6.1.2',
                'marker_supply_3': '1.3.6.1.2.1.43.11.1.1.6.1.3',
                'marker_supply_4': '1.3.6.1.2.1.43.11.1.1.6.1.4'
            },
            'oki': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',
                'pages_mono': '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.1',  # OKI specific
                'pages_color': '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.999.2', # OKI specific
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0',        # sysLocation
                # Color detection OIDs
                'colorant_1': '1.3.6.1.2.1.43.12.1.1.4.1.1',   # prtMarkerColorantValue
                'colorant_2': '1.3.6.1.2.1.43.12.1.1.4.1.2',
                'colorant_3': '1.3.6.1.2.1.43.12.1.1.4.1.3', 
                'colorant_4': '1.3.6.1.2.1.43.12.1.1.4.1.4',
                'marker_supply_1': '1.3.6.1.2.1.43.11.1.1.6.1.1', # prtMarkerSupplyDescription
                'marker_supply_2': '1.3.6.1.2.1.43.11.1.1.6.1.2',
                'marker_supply_3': '1.3.6.1.2.1.43.11.1.1.6.1.3',
                'marker_supply_4': '1.3.6.1.2.1.43.11.1.1.6.1.4'
            },
            'brother': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',
                'pages_mono': '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0',  # Brother specific
                'pages_color': '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0', # Brother specific
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0'         # sysLocation
            },
            'lexmark': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',   # Standard total impressions (235,911)
                'pages_mono': '1.3.6.1.2.1.43.10.2.1.4.1.1',    # Use total for mono (Lexmark MX611 is mono)
                'pages_color': '1.3.6.1.4.1.641.2.1.2.1.5.1',   # Lexmark specific (returns 0 for mono)
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0',        # sysLocation
                # Lexmark specific OIDs
                'lexmark_total_pages': '1.3.6.1.4.1.641.2.1.2.1.6.1',  # Returns coded value
                'lexmark_impressions': '1.3.6.1.4.1.641.2.1.2.1.5.1',  # Returns 0
                # Color detection OIDs
                'colorant_1': '1.3.6.1.2.1.43.12.1.1.4.1.1',   # prtMarkerColorantValue
                'colorant_2': '1.3.6.1.2.1.43.12.1.1.4.1.2',
                'colorant_3': '1.3.6.1.2.1.43.12.1.1.4.1.3', 
                'colorant_4': '1.3.6.1.2.1.43.12.1.1.4.1.4',
                'marker_supply_1': '1.3.6.1.2.1.43.11.1.1.6.1.1', # prtMarkerSupplyDescription
                'marker_supply_2': '1.3.6.1.2.1.43.11.1.1.6.1.2',
                'marker_supply_3': '1.3.6.1.2.1.43.11.1.1.6.1.3',
                'marker_supply_4': '1.3.6.1.2.1.43.11.1.1.6.1.4'
            },
            'epson': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',   # Standard total impressions
                'pages_mono': '1.3.6.1.2.1.43.10.2.1.4.1.1',    # Use total for mono/color detection
                'pages_color': '1.3.6.1.2.1.43.10.2.1.4.1.2',   # Standard color pages
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0',        # sysLocation
                # EPSON specific OIDs
                'device_description': '1.3.6.1.2.1.25.3.2.1.3.1',  # hrDeviceDescr (EPSON UB-E02)
                # Color detection OIDs
                'colorant_1': '1.3.6.1.2.1.43.12.1.1.4.1.1',   # prtMarkerColorantValue
                'colorant_2': '1.3.6.1.2.1.43.12.1.1.4.1.2',
                'colorant_3': '1.3.6.1.2.1.43.12.1.1.4.1.3', 
                'colorant_4': '1.3.6.1.2.1.43.12.1.1.4.1.4',
                'marker_supply_1': '1.3.6.1.2.1.43.11.1.1.6.1.1', # prtMarkerSupplyDescription
                'marker_supply_2': '1.3.6.1.2.1.43.11.1.1.6.1.2',
                'marker_supply_3': '1.3.6.1.2.1.43.11.1.1.6.1.3',
                'marker_supply_4': '1.3.6.1.2.1.43.11.1.1.6.1.4'
            },
            'ricoh': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',   # Standard total impressions
                'pages_mono': '1.3.6.1.2.1.43.10.2.1.4.1.1',    # Use total for mono printers
                'pages_color': '1.3.6.1.2.1.43.10.2.1.4.1.2',   # Standard color pages
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',   # Standard toner levels
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',   # Standard paper level
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',           # hrDeviceStatus
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',   # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',             # sysName
                'system_location': '1.3.6.1.2.1.1.6.0',         # sysLocation
                # Ricoh specific OIDs if available
                'device_description': '1.3.6.1.2.1.25.3.2.1.3.1',  # hrDeviceDescr
                # Color detection OIDs
                'colorant_1': '1.3.6.1.2.1.43.12.1.1.4.1.1',   # prtMarkerColorantValue
                'colorant_2': '1.3.6.1.2.1.43.12.1.1.4.1.2',
                'colorant_3': '1.3.6.1.2.1.43.12.1.1.4.1.3', 
                'colorant_4': '1.3.6.1.2.1.43.12.1.1.4.1.4',
                'marker_supply_1': '1.3.6.1.2.1.43.11.1.1.6.1.1', # prtMarkerSupplyDescription
                'marker_supply_2': '1.3.6.1.2.1.43.11.1.1.6.1.2',
                'marker_supply_3': '1.3.6.1.2.1.43.11.1.1.6.1.3',
                'marker_supply_4': '1.3.6.1.2.1.43.11.1.1.6.1.4'
            },
            'generic_v2c': {
                'pages_total': '1.3.6.1.2.1.43.10.2.1.4.1.1',
                'pages_mono': '1.3.6.1.2.1.43.10.2.1.4.1.1',  # Generic fallback
                'pages_color': '1.3.6.1.2.1.43.10.2.1.4.1.2',  # Generic fallback
                'toner_black': '1.3.6.1.2.1.43.11.1.1.9.1.1',
                'toner_cyan': '1.3.6.1.2.1.43.11.1.1.9.1.2',
                'toner_magenta': '1.3.6.1.2.1.43.11.1.1.9.1.3',
                'toner_yellow': '1.3.6.1.2.1.43.11.1.1.9.1.4',
                'paper_level': '1.3.6.1.2.1.43.8.2.1.10.1.1',
                'status': '1.3.6.1.2.1.25.3.2.1.5.1',
                'serial_number': '1.3.6.1.2.1.43.5.1.1.17.1',  # Standard printer serial
                'system_name': '1.3.6.1.2.1.1.5.0',            # sysName
                'system_location': '1.3.6.1.2.1.1.6.0'         # sysLocation
            }
        }
    
    def get_snmp_value(self, ip: str, oid: str) -> Optional[str]:
        """Get a single SNMP value, supporting both v2c and v3"""
        try:
            # Check if this IP has SNMPv3 credentials
            if ip in self.v3_credentials:
                return self._get_snmp_v3_value(ip, oid)
            else:
                return self._get_snmp_v2c_value(ip, oid)
        except Exception as e:
            print(f"SNMP Exception for {ip}:{oid} - {str(e)}")
            return None
    
    def _get_snmp_v3_value(self, ip: str, oid: str) -> Optional[str]:
        """Get SNMP value using SNMPv3"""
        try:
            creds = self.v3_credentials[ip]
            
            user_data = UsmUserData(
                creds['username'],
                creds['auth_key'],
                creds['priv_key'],
                authProtocol=creds['auth_protocol'],
                privProtocol=creds['priv_protocol']
            )
            
            iterator = getCmd(
                SnmpEngine(),
                user_data,
                UdpTransportTarget((ip, 161), timeout=2, retries=1),  # Optimizado: 2s timeout, 1 retry
                ContextData(contextName=creds['context_name']),
                ObjectType(ObjectIdentity(oid))
            )
            
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            
            if errorIndication:
                print(f"SNMPv3 Error: {errorIndication}")
                return None
            elif errorStatus:
                print(f"SNMPv3 Error: {errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex) - 1][0] or '?'}")
                return None
            else:
                for varBind in varBinds:
                    return str(varBind[1])
            return None
        except Exception as e:
            print(f"SNMPv3 Exception for {ip}:{oid} - {str(e)}")
            return None
    
    def _get_snmp_v2c_value(self, ip: str, oid: str) -> Optional[str]:
        """Get SNMP value using SNMPv2c, with fallback to SNMPv1"""
        # First try SNMPv2c
        try:
            iterator = getCmd(
                SnmpEngine(),
                CommunityData(self.community, mpModel=1),  # v2c
                UdpTransportTarget((ip, 161), timeout=2, retries=1),  # Optimizado: 2s timeout, 1 retry
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )
            
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            
            if errorIndication:
                print(f"SNMPv2c Error: {errorIndication}, trying SNMPv1...")
                # Fallback to SNMPv1
                return self._get_snmp_v1_value(ip, oid)
            elif errorStatus:
                print(f"SNMPv2c Error: {errorStatus.prettyPrint()}, trying SNMPv1...")
                # Fallback to SNMPv1
                return self._get_snmp_v1_value(ip, oid)
            else:
                for varBind in varBinds:
                    return str(varBind[1])
            return None
        except Exception as e:
            print(f"SNMPv2c Exception for {ip}:{oid} - {str(e)}, trying SNMPv1...")
            # Fallback to SNMPv1
            return self._get_snmp_v1_value(ip, oid)
    
    def _get_snmp_v1_value(self, ip: str, oid: str) -> Optional[str]:
        """Get SNMP value using SNMPv1"""
        try:
            iterator = getCmd(
                SnmpEngine(),
                CommunityData(self.community, mpModel=0),  # v1
                UdpTransportTarget((ip, 161), timeout=2, retries=1),  # Optimizado: 2s timeout, 1 retry
                ContextData(),
                ObjectType(ObjectIdentity(oid))
            )
            
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            
            if errorIndication:
                print(f"SNMPv1 Error: {errorIndication}")
                return None
            elif errorStatus:
                print(f"SNMPv1 Error: {errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex) - 1][0] or '?'}")
                return None
            else:
                for varBind in varBinds:
                    return str(varBind[1])
            return None
        except Exception as e:
            print(f"SNMPv1 Exception for {ip}:{oid} - {str(e)}")
            return None
    
    def calculate_toner_percentage(self, current_level: str, max_level: str = "100") -> Optional[float]:
        """Calculate toner percentage from SNMP values"""
        try:
            if current_level and current_level != "No Such Instance currently exists at this OID":
                current = float(current_level)
                maximum = float(max_level)
                if maximum > 0:
                    return round((current / maximum) * 100, 2)
            return None
        except (ValueError, TypeError):
            return None
    
    def poll_printer(self, ip: str, profile: str = 'generic_v2c') -> Dict:
        """Poll a printer using SNMP and return structured data"""
        if profile not in self.profiles:
            profile = 'generic_v2c'
        
        oids = self.profiles[profile]
        data = {}
        
        # Get basic page counts
        pages_total = self.get_snmp_value(ip, oids['pages_total'])
        pages_mono = self.get_snmp_value(ip, oids['pages_mono'])
        pages_color = self.get_snmp_value(ip, oids['pages_color'])
        
        try:
            data['pages_printed_mono'] = int(pages_mono) if pages_mono and pages_mono.isdigit() else 0
            data['pages_printed_color'] = int(pages_color) if pages_color and pages_color.isdigit() else 0
            
            # If specific mono/color counts failed, use total for mono
            if data['pages_printed_mono'] == 0 and pages_total and pages_total.isdigit():
                data['pages_printed_mono'] = int(pages_total)
        except (ValueError, TypeError):
            data['pages_printed_mono'] = 0
            data['pages_printed_color'] = 0
        
        # Get toner levels (current and max capacity)
        # OID base for toner current level: 1.3.6.1.2.1.43.11.1.1.9.1.x
        # OID base for toner max capacity: 1.3.6.1.2.1.43.11.1.1.8.1.x
        # OID base for supply type: 1.3.6.1.2.1.43.11.1.1.5.1.x (3=toner, 9=drum/photoconductor)
        # OID base for supply description: 1.3.6.1.2.1.43.11.1.1.6.1.x
        
        # Buscar los índices que corresponden a tóner (tipo 3 solamente, no cilindros/drums/fusers)
        toner_indices = {'black': None, 'cyan': None, 'magenta': None, 'yellow': None}
        
        # Escanear los primeros 10 índices para encontrar tóners
        for i in range(1, 11):
            supply_type = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.5.1.{i}')
            
            # Solo procesar si es tipo 3 (toner)
            if supply_type == '3':
                supply_desc = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.6.1.{i}')
                if supply_desc:
                    desc_upper = supply_desc.upper()
                    # Identificar el color del tóner
                    if 'BLACK' in desc_upper or 'NEGRO' in desc_upper or 'BLK' in desc_upper:
                        if toner_indices['black'] is None:
                            toner_indices['black'] = i
                    elif 'CYAN' in desc_upper:
                        if toner_indices['cyan'] is None:
                            toner_indices['cyan'] = i
                    elif 'MAGENTA' in desc_upper:
                        if toner_indices['magenta'] is None:
                            toner_indices['magenta'] = i
                    elif 'YELLOW' in desc_upper or 'AMARILLO' in desc_upper:
                        if toner_indices['yellow'] is None:
                            toner_indices['yellow'] = i
        
        # Obtener niveles solo de los tóners identificados
        if toner_indices['black']:
            idx = toner_indices['black']
            current = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.9.1.{idx}')
            maximum = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.8.1.{idx}')
            data['toner_level_black'] = self.calculate_toner_percentage(current, maximum) if current and maximum else None
        else:
            data['toner_level_black'] = None
            
        if toner_indices['cyan']:
            idx = toner_indices['cyan']
            current = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.9.1.{idx}')
            maximum = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.8.1.{idx}')
            data['toner_level_cyan'] = self.calculate_toner_percentage(current, maximum) if current and maximum else None
        else:
            data['toner_level_cyan'] = None
            
        if toner_indices['magenta']:
            idx = toner_indices['magenta']
            current = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.9.1.{idx}')
            maximum = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.8.1.{idx}')
            data['toner_level_magenta'] = self.calculate_toner_percentage(current, maximum) if current and maximum else None
        else:
            data['toner_level_magenta'] = None
            
        if toner_indices['yellow']:
            idx = toner_indices['yellow']
            current = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.9.1.{idx}')
            maximum = self.get_snmp_value(ip, f'1.3.6.1.2.1.43.11.1.1.8.1.{idx}')
            data['toner_level_yellow'] = self.calculate_toner_percentage(current, maximum) if current and maximum else None
        else:
            data['toner_level_yellow'] = None
        
        # Get paper level
        paper_level = self.get_snmp_value(ip, oids['paper_level'])
        data['paper_level'] = self.calculate_toner_percentage(paper_level) if paper_level else None
        
        # Get status
        status = self.get_snmp_value(ip, oids['status'])
        if status:
            # Convert numeric status to text
            status_map = {
                '1': 'other',
                '2': 'unknown', 
                '3': 'idle',
                '4': 'printing',
                '5': 'warmup'
            }
            data['status'] = status_map.get(status, 'unknown')
        else:
            data['status'] = 'offline'
        
        return data
    
    def test_connection(self, ip: str) -> bool:
        """Test SNMP connection to a printer"""
        try:
            result = self.get_snmp_value(ip, '1.3.6.1.2.1.1.1.0')  # System description
            return result is not None
        except Exception:
            return False
    
    def get_device_info(self, ip: str, profile: str = 'generic_v2c') -> Dict:
        """Get device information including serial number, name, location, and color capability"""
        if profile not in self.profiles:
            profile = 'generic_v2c'
        
        oids = self.profiles[profile]
        info = {}
        
        # Get device information - intentar múltiples OIDs para el serial
        serial_number = self.get_serial_number_robust(ip, oids, profile)
        system_name = self.get_snmp_value(ip, oids.get('system_name', '1.3.6.1.2.1.1.5.0'))
        system_location = self.get_snmp_value(ip, oids.get('system_location', '1.3.6.1.2.1.1.6.0'))
        system_description = self.get_snmp_value(ip, '1.3.6.1.2.1.1.1.0')  # sysDescr
        device_description = self.get_snmp_value(ip, '1.3.6.1.2.1.25.3.2.1.3.1')  # hrDeviceDescr - más específico para printers
        
        # Detect color capability
        is_color = self.detect_color_capability(ip, profile)
        
        info['serial_number'] = serial_number if serial_number else None
        info['system_name'] = system_name if system_name else None
        info['system_location'] = system_location if system_location else None
        info['system_description'] = system_description if system_description else None
        info['device_description'] = device_description if device_description else None
        info['is_color'] = is_color
        
        return info
    
    def get_serial_number_robust(self, ip: str, oids: dict, profile: str) -> Optional[str]:
        """
        Intenta obtener el número de serie usando múltiples OIDs comunes
        específicos para diferentes marcas de impresoras
        """
        # Lista de OIDs para intentar, en orden de prioridad
        serial_oids = [
            # OID estándar de la configuración
            oids.get('serial_number', '1.3.6.1.2.1.43.5.1.1.17.1'),
            # OIDs alternativos comunes para seriales
            '1.3.6.1.2.1.43.5.1.1.17.1',     # Standard printer serial
            # Ricoh específicos (múltiples intentos)
            '1.3.6.1.4.1.367.3.2.1.2.1.4.1',   # Ricoh primary serial
            '1.3.6.1.4.1.367.3.2.1.1.1.1.0',   # Ricoh system serial
            '1.3.6.1.4.1.367.3.2.1.2.19.5.1.5.1', # Ricoh device serial
            '1.3.6.1.4.1.367.3.2.1.7.1.1.1.2.1',  # Ricoh alternative
            '1.3.6.1.4.1.367.1.1.2.1.4.1.2.1',    # Ricoh MIB serial
            # Otros fabricantes
            '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0',  # HP specific
            '1.3.6.1.4.1.2001.1.1.1.1.11.1.3.3.1.5.1.1.6.1',  # OKI specific
            '1.3.6.1.4.1.1347.42.2.1.1.1.4.1',  # Brother specific
            '1.3.6.1.4.1.1248.1.1.3.1.3.8.1.3.1.2.1',  # Epson specific
            # OIDs adicionales que podrían contener serial real
            '1.3.6.1.2.1.43.5.1.1.16.1',    # prtGeneralSerialNumber
            '1.3.6.1.2.1.1.4.0',            # sysContact (a veces contiene serial)
            '1.3.6.1.2.1.1.6.0',            # sysLocation (a veces contiene serial)
            '1.3.6.1.2.1.43.8.2.1.14.1.1',  # prtInputMediaName
            # Sistema y descripción general (para OKI y otros)
            '1.3.6.1.2.1.1.1.0',            # sysDescr - contiene serial de OKI
            '1.3.6.1.2.1.25.3.2.1.3.1',      # hrDeviceDescr (último recurso)
            # OID de suministros - SOLO como último recurso (puede devolver info de cartuchos)
            '1.3.6.1.2.1.43.11.1.1.6.1.1',  # prtMarkerSuppliesDescription (puede ser cartucho)
        ]
        
        for oid in serial_oids:
            try:
                serial = self.get_snmp_value(ip, oid)
                if serial and serial.strip() and serial.strip() != '':
                    # Verificar si es un serial válido (no marca/modelo)
                    if self.is_valid_serial(serial.strip()):
                        # Limpiar y normalizar el número de serie
                        cleaned_serial = self.clean_serial_number(serial.strip())
                        print(f"✅ Serial válido encontrado en OID {oid}: {serial} → {cleaned_serial}")
                        return cleaned_serial
                    else:
                        print(f"🚫 OID {oid} devolvió marca/modelo, no serial: {serial}")
                else:
                    print(f"🔍 OID {oid}: sin datos o vacío")
            except Exception as e:
                print(f"❌ Error en OID {oid}: {str(e)}")
                continue
        
        print(f"⚠️ No se pudo obtener serial para {ip} después de probar {len(serial_oids)} OIDs")
        return None
    
    def is_valid_serial(self, value: str) -> bool:
        """
        Determina si el valor obtenido es un número de serie válido
        y no marca/modelo/descripción del dispositivo
        """
        if not value or len(value.strip()) == 0:
            return False
            
        value = value.strip().upper()
        
        # EXCEPCIÓN ESPECIAL: Si contiene "S/N" seguido de un serial, es válido (HP)
        # Ejemplo: "HP Laser MFP 432fdn; V4.00.01.38 APR-17-2024;Engine V1.00.19;NIC V4.01.04 OCT-11-2022;S/N CNB1P712WL"
        if re.search(r'S/N\s+[A-Z0-9]{6,}', value, re.IGNORECASE):
            print(f"✅ Serial HP válido encontrado con patrón S/N: {value}")
            return True
        
        # Rechazar valores que claramente son marca/modelo o información de suministros
        invalid_patterns = [
            r'^(RICOH|HP|CANON|EPSON|BROTHER|LEXMARK|SHARP|XEROX|KYOCERA)',  # Marcas (NO OKI aquí)
            r'(LASERJET|DESKJET|OFFICEJET|PAGEWIDE)',  # Modelos HP
            r'(P\s*\d{3}|M\s*\d{3}|E\s*\d{3})',      # Modelos tipo P 311, M404
            r'^[A-Z\s]+(PRINTER|MFP|COPIER)',          # Descripciones
            r'^\d{1,4}[A-Z]*\s*(SERIES|DN|DW|N)?\s*$', # Modelos simples
            r'^C\d{3,4}$',  # Modelos OKI como "C711" (solo estos)
            r'^(COMERCIAL|COMMERCIAL|OFFICE|OFICINA)$',  # Ubicaciones
            r'^\w+\s*-\s*\d+\s*ESQ$',  # Patrones de ubicación como "COMERCIAL - 4 ESQ"
            r'(CARTRIDGE|TONER|DRUM|FUSER|INK)',  # Información de suministros/cartuchos
            r'CRUM',  # Chip de cartucho HP
            r'(BLACK|CYAN|MAGENTA|YELLOW|COLOR)\s+(TONER|CARTRIDGE|INK)',  # Cartuchos de color
        ]
        
        for pattern in invalid_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                return False
        
        # Casos especiales para OKI - pueden tener seriales en formato especial
        if 'OKI' in value.upper() or re.search(r'\bAK\d+', value, re.IGNORECASE):
            # Validar patrones OKI específicos
            oki_patterns = [
                r'\bAK\d{8}\b',          # Serial real OKI: AK31047805
                r'\bAK[A-Z0-9]{6,10}\b', # Variaciones de serial AK
                r'OkiLAN\s+\d+\w+',      # OkiLAN 8450e
                r'Rev\.[A-Z]\d+\.\d+',   # Rev.D3.12
                r'[A-Z]{2,}\d{4,}',      # Patrones generales alphanumericos
            ]
            
            for pattern in oki_patterns:
                if re.search(pattern, value, re.IGNORECASE):
                    print(f"✅ Serial OKI válido encontrado: {pattern}")
                    return True
        
        # Validación específica para seriales que empiezan con AK (OKI reales)
        if re.search(r'\bAK\d{8}\b', value, re.IGNORECASE):
            print(f"✅ Serial AK válido encontrado: {value}")
            return True
        
        # Un serial válido típicamente:
        # - Tiene al menos 6 caracteres
        # - Contiene números y letras mezclados
        # - No es solo espacios y letras
        if len(value) < 6:
            return False
            
        # Debe tener al menos algunos números
        if not re.search(r'\d', value):
            return False
            
        # Debe tener al menos algunas letras o números
        if not re.search(r'[A-Z0-9]', value):
            return False
            
        print(f"✅ Serial válido detectado: {value}")
        return True
    
    def clean_serial_number(self, serial: str) -> str:
        """
        Limpia y normaliza números de serie removiendo sufijos comunes
        que no son parte del serial real del dispositivo
        """
        if not serial:
            return serial
            
        # Remover espacios al inicio y final
        cleaned = serial.strip()
        
        # PRIORIDAD MÁXIMA 1: Extraer serial de formato HP "S/N XXXXX"
        # Ejemplo: "HP Laser MFP 432fdn; V4.00.01.38 APR-17-2024;Engine V1.00.19;NIC V4.01.04 OCT-11-2022;S/N CNB1P712WL"
        hp_sn_pattern = re.search(r'S/N\s+([A-Z0-9]+)', cleaned, re.IGNORECASE)
        if hp_sn_pattern:
            hp_serial = hp_sn_pattern.group(1).upper()
            print(f"🔧 Serial HP extraído de sysDescr: '{serial}' → '{hp_serial}'")
            return hp_serial
        
        # PRIORIDAD MÁXIMA 2: Si encontramos un serial AK directo, devolverlo inmediatamente
        ak_direct = re.search(r'\b(AK\d{8})\b', cleaned, re.IGNORECASE)
        if ak_direct:
            ak_serial = ak_direct.group(1).upper()
            print(f"🔧 Serial AK DIRECTO extraído: '{cleaned}' → '{ak_serial}'")
            return ak_serial
        
        # Casos especiales para OKI - extraer información identificadora
        if 'OKI' in cleaned.upper():
            # PRIORIDAD 1: Buscar serial real OKI (formato AK + 8 dígitos)
            oki_real_serial = re.search(r'\b(AK\d{8})\b', cleaned, re.IGNORECASE)
            if oki_real_serial:
                real_serial = oki_real_serial.group(1)
                print(f"🔧 Serial OKI REAL extraído de '{cleaned}' → '{real_serial}'")
                return real_serial
            
            # PRIORIDAD 2: Buscar otros patrones AK (pueden tener variaciones)
            ak_pattern = re.search(r'\b(AK[A-Z0-9]{6,10})\b', cleaned, re.IGNORECASE)
            if ak_pattern:
                ak_serial = ak_pattern.group(1)
                print(f"🔧 Serial OKI AK extraído de '{cleaned}' → '{ak_serial}'")
                return ak_serial
            
            # PRIORIDAD 3: Buscar patrón de tarjeta de red OkiLAN (menos prioritario)
            okilan_match = re.search(r'OkiLAN\s+(\d+\w+)', cleaned, re.IGNORECASE)
            if okilan_match:
                okilan_serial = okilan_match.group(1)
                print(f"🔧 Serial OKI OkiLAN extraído de '{cleaned}' → '{okilan_serial}'")
                return okilan_serial
            
            # PRIORIDAD 4: Buscar cualquier secuencia que parezca serial (letras+números)
            oki_serial_match = re.search(r'([A-Z]{2,}\d{4,})', cleaned, re.IGNORECASE)
            if oki_serial_match:
                oki_serial = oki_serial_match.group(1)
                print(f"🔧 Serial OKI genérico extraído de '{cleaned}' → '{oki_serial}'")
                return oki_serial
        
        # Patrones comunes a remover (sufijos de versión/configuración)
        patterns_to_remove = [
            r'-\d{1,3}-\d{1,3}$',      # Lexmark: -139-0
            r'-V\d+\.\d+$',            # Versiones: -V1.2
            r'_\d{1,3}$',              # Sufijos numericos: _001
            r'\s+\(\d+\)$',            # Paréntesis: (001)
            r'-REV\w+$',               # Revisiones: -REVA
            r'-\w{1,3}$',              # Sufijos cortos: -A, -AB
        ]
        
        for pattern in patterns_to_remove:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Casos especiales por marca
        # Lexmark: conservar solo la parte principal del serial
        if len(cleaned) > 15 and '-' in cleaned:
            parts = cleaned.split('-')
            if len(parts) >= 2 and len(parts[0]) >= 8:
                # Tomar solo la primera parte si es suficientemente larga
                cleaned = parts[0]
        
        # Remover caracteres no alfanuméricos al final
        cleaned = re.sub(r'[^A-Za-z0-9]+$', '', cleaned)
        
        print(f"🔧 Serial limpio: {serial} → {cleaned}")
        return cleaned
    
    def detect_color_capability(self, ip: str, profile: str = 'generic_v2c') -> bool:
        """Detect if printer has color capability via SNMP"""
        if profile not in self.profiles:
            profile = 'generic_v2c'
        
        oids = self.profiles[profile]
        
        # First check for known monochrome models by IP or system info
        if ip == '10.10.9.13':  # Known Ricoh P311
            return False
        
        # Check system description for known monochrome models
        sys_descr = self.get_snmp_value(ip, '1.3.6.1.2.1.1.1.0')
        if sys_descr:
            sys_descr_lower = sys_descr.lower()
            
            # Known monochrome model patterns
            mono_patterns = [
                'p311',           # Ricoh P311
                'p 311',          # Ricoh P 311 (with space)
                'es5112',         # OKI ES5112
                'es5162',         # OKI ES5162
                'dcp-l',          # Brother DCP-L series (laser mono)
                'hl-l',           # Brother HL-L series (laser mono) 
                'laser mfp 432',  # HP Laser MFP 432 series
                'laser 108',      # HP Laser 108 series
                'mx611',          # Lexmark MX611 (some variants are mono)
            ]
            
            if any(pattern in sys_descr_lower for pattern in mono_patterns):
                return False
        
        # Method 1: Check colorants (most reliable)
        colorants = []
        for i in range(1, 5):  # Check up to 4 colorants
            colorant_key = f'colorant_{i}'
            if colorant_key in oids:
                colorant_value = self.get_snmp_value(ip, oids[colorant_key])
                if colorant_value and colorant_value.lower() not in ['', 'no such object', 'no such instance']:
                    colorants.append(colorant_value.lower())
        
        # If we find multiple colorants, it's likely a color printer
        if len(colorants) > 1:
            return True
        
        # If we only find 'black', check other indicators
        if len(colorants) == 1 and 'black' in colorants[0]:
            # Method 2: Check marker supply descriptions
            color_supplies = []
            for i in range(1, 5):
                supply_key = f'marker_supply_{i}'
                if supply_key in oids:
                    supply_desc = self.get_snmp_value(ip, oids[supply_key])
                    if supply_desc:
                        supply_lower = supply_desc.lower()
                        # Look for color indicators in supply descriptions
                        if any(color in supply_lower for color in ['cyan', 'magenta', 'yellow', 'color']):
                            color_supplies.append(supply_desc)
            
            if color_supplies:
                return True
            
            # Method 3: Check toner levels for color toners
            color_toner_oids = ['toner_cyan', 'toner_magenta', 'toner_yellow']
            valid_color_toners = 0
            
            for toner_oid in color_toner_oids:
                if toner_oid in oids:
                    toner_level = self.get_snmp_value(ip, oids[toner_oid])
                    if toner_level and toner_level.isdigit():
                        level_val = int(toner_level)
                        # Valid toner level (0-100) indicates color capability
                        if 0 <= level_val <= 100:
                            valid_color_toners += 1
            
            # If we have at least 2 valid color toner readings, it's color
            if valid_color_toners >= 2:
                return True
        
        # If multiple colorants detected (not just black), it's color
        if len(colorants) > 1:
            return True
        
        # Default to monochrome if no clear color indicators
        return False
    
    def walk_all_oids(self, ip: str, start_oid: str = '1.3.6.1') -> Dict:
        """
        Hace un walk completo de OIDs para descubrir toda la información disponible
        """
        oids_found = {}
        
        try:
            # Check if this IP has SNMPv3 credentials
            if ip in self.v3_credentials:
                creds = self.v3_credentials[ip]
                user_data = UsmUserData(
                    creds['username'],
                    creds['auth_key'],
                    creds['priv_key'],
                    authProtocol=creds['auth_protocol'],
                    privProtocol=creds['priv_protocol']
                )
                
                iterator = nextCmd(
                    SnmpEngine(),
                    user_data,
                    UdpTransportTarget((ip, 161), timeout=3, retries=1),
                    ContextData(contextName=creds['context_name']),
                    ObjectType(ObjectIdentity(start_oid)),
                    lexicographicMode=False,
                    maxRows=1000  # Limitar para evitar timeout
                )
            else:
                # SNMPv2c/v1
                iterator = nextCmd(
                    SnmpEngine(),
                    CommunityData(self.community, mpModel=1),  # v2c
                    UdpTransportTarget((ip, 161), timeout=3, retries=1),
                    ContextData(),
                    ObjectType(ObjectIdentity(start_oid)),
                    lexicographicMode=False,
                    maxRows=1000  # Limitar para evitar timeout
                )
            
            count = 0
            for errorIndication, errorStatus, errorIndex, varBinds in iterator:
                if errorIndication:
                    print(f"SNMP Walk Error: {errorIndication}")
                    break
                elif errorStatus:
                    print(f"SNMP Walk Error: {errorStatus.prettyPrint()}")
                    break
                else:
                    for varBind in varBinds:
                        oid = str(varBind[0])
                        value = str(varBind[1])
                        oids_found[oid] = value
                        count += 1
                        
                        # Limitar el número de OIDs para evitar overflow
                        if count >= 500:
                            break
                            
                    if count >= 500:
                        break
            
            print(f"📊 Total OIDs encontrados para {ip}: {len(oids_found)}")
            return oids_found
            
        except Exception as e:
            print(f"❌ Error en SNMP Walk para {ip}: {str(e)}")
            return {}

    def analyze_oki_mibs(self, ip: str) -> Dict:
        """
        Analiza específicamente los MIBs de OKI para encontrar información relevante
        """
        print(f"\n🔍 ANÁLISIS COMPLETO DE OKI - IP: {ip}")
        print("=" * 60)
        
        analysis = {
            'system_info': {},
            'printer_info': {},
            'supplies': {},
            'counters': {},
            'oki_specific': {},
            'serial_candidates': {},
            'all_oids': {}
        }
        
        # Lista específica de OIDs importantes a probar
        important_oids = {
            # System MIB
            '1.3.6.1.2.1.1.1.0': 'sysDescr',
            '1.3.6.1.2.1.1.2.0': 'sysObjectID', 
            '1.3.6.1.2.1.1.3.0': 'sysUpTime',
            '1.3.6.1.2.1.1.4.0': 'sysContact',
            '1.3.6.1.2.1.1.5.0': 'sysName',
            '1.3.6.1.2.1.1.6.0': 'sysLocation',
            '1.3.6.1.2.1.1.7.0': 'sysServices',
            
            # Host Resources MIB
            '1.3.6.1.2.1.25.3.2.1.3.1': 'hrDeviceDescr.1',
            '1.3.6.1.2.1.25.3.2.1.3.2': 'hrDeviceDescr.2',
            '1.3.6.1.2.1.25.3.2.1.3.3': 'hrDeviceDescr.3',
            '1.3.6.1.2.1.25.3.2.1.4.1': 'hrDeviceID.1',
            '1.3.6.1.2.1.25.2.3.1.3.1': 'hrStorageDescr.1',
            
            # Printer MIB
            '1.3.6.1.2.1.43.5.1.1.16.1': 'prtGeneralSerialNumber',
            '1.3.6.1.2.1.43.5.1.1.17.1': 'prtGeneralSerialNumber (alt)',
            '1.3.6.1.2.1.43.8.2.1.14.1.1': 'prtInputMediaName',
            '1.3.6.1.2.1.43.11.1.1.6.1.1': 'prtMarkerSuppliesDescription',
            '1.3.6.1.2.1.43.10.2.1.4.1.1': 'prtOutputName',
            
            # OKI Enterprise MIB (intentar algunos)
            '1.3.6.1.4.1.2001.1.1.1.1.1.0': 'OKI Device Info',
            '1.3.6.1.4.1.2001.1.1.1.1.2.0': 'OKI Serial Base',
            '1.3.6.1.4.1.2001.1.1.1.1.3.0': 'OKI Model Info',
            '1.3.6.1.4.1.2001.1.1.1.1.4.0': 'OKI Serial Alt',
            '1.3.6.1.4.1.2001.1.1.1.1.5.0': 'OKI Device Serial',
        }
        
        print(f"📋 Probando {len(important_oids)} OIDs específicos...")
        
        for oid, description in important_oids.items():
            try:
                value = self.get_snmp_value(ip, oid)
                if value and value.strip() and value not in ['No Such Object', 'No Such Instance']:
                    analysis['all_oids'][oid] = value
                    
                    # Categorizar por sección
                    if oid.startswith('1.3.6.1.2.1.1'):
                        analysis['system_info'][oid] = value
                    elif oid.startswith('1.3.6.1.2.1.43'):
                        analysis['printer_info'][oid] = value
                    elif oid.startswith('1.3.6.1.4.1.2001'):
                        analysis['oki_specific'][oid] = value
                    
                    # Buscar candidatos de serial
                    if any(pattern in value.upper() for pattern in ['AK31047805', 'AK', 'SERIAL']):
                        analysis['serial_candidates'][oid] = value
                    
                    print(f"  ✅ {oid} ({description}): {value}")
                else:
                    print(f"  ❌ {oid} ({description}): Sin datos")
                    
            except Exception as e:
                print(f"  ❌ {oid} ({description}): Error - {e}")
        
        # Mostrar resultados organizados
        self.print_oki_analysis(analysis)
        
        return analysis

    def print_oki_analysis(self, analysis: Dict):
        """
        Imprime el análisis de OKI de forma organizada
        """
        
        print("\n🎯 INFORMACIÓN DEL SISTEMA:")
        print("-" * 40)
        for oid, value in analysis['system_info'].items():
            oid_name = self.get_oid_description(oid)
            print(f"  {oid} ({oid_name}): {value}")
        
        print("\n🖨️ INFORMACIÓN DE IMPRESORA:")
        print("-" * 40)
        count = 0
        for oid, value in analysis['printer_info'].items():
            if count < 20:  # Limitar output
                oid_name = self.get_oid_description(oid)
                print(f"  {oid} ({oid_name}): {value}")
                count += 1
            else:
                print(f"  ... y {len(analysis['printer_info']) - 20} OIDs más")
                break
        
        print("\n🔍 CANDIDATOS PARA NÚMERO DE SERIE:")
        print("-" * 40)
        if analysis['serial_candidates']:
            for oid, value in analysis['serial_candidates'].items():
                oid_name = self.get_oid_description(oid)
                print(f"  ⭐ {oid} ({oid_name}): {value}")
        else:
            print("  ❌ No se encontraron candidatos obvios para número de serie")
        
        print("\n🏢 OKI ENTERPRISE MIB:")
        print("-" * 40)
        if analysis['oki_specific']:
            for oid, value in analysis['oki_specific'].items():
                print(f"  {oid}: {value}")
        else:
            print("  ❌ No se encontró información en OKI Enterprise MIB")
        
        print("\n📊 RESUMEN:")
        print("-" * 40)
        print(f"  Total OIDs encontrados: {len(analysis['all_oids'])}")
        print(f"  Sistema: {len(analysis['system_info'])}")
        print(f"  Impresora: {len(analysis['printer_info'])}")
        print(f"  Candidatos Serial: {len(analysis['serial_candidates'])}")
        print(f"  OKI Específicos: {len(analysis['oki_specific'])}")

    def get_oid_description(self, oid: str) -> str:
        """
        Devuelve una descripción legible del OID
        """
        descriptions = {
            '1.3.6.1.2.1.1.1.0': 'sysDescr',
            '1.3.6.1.2.1.1.2.0': 'sysObjectID',
            '1.3.6.1.2.1.1.3.0': 'sysUpTime',
            '1.3.6.1.2.1.1.4.0': 'sysContact',
            '1.3.6.1.2.1.1.5.0': 'sysName',
            '1.3.6.1.2.1.1.6.0': 'sysLocation',
            '1.3.6.1.2.1.1.7.0': 'sysServices',
            '1.3.6.1.2.1.25.3.2.1.3.1': 'hrDeviceDescr',
            '1.3.6.1.2.1.43.5.1.1.16.1': 'prtGeneralSerialNumber',
            '1.3.6.1.2.1.43.5.1.1.17.1': 'prtGeneralSerialNumber (alt)',
            '1.3.6.1.2.1.43.8.2.1.13.1.1': 'prtInputName',
            '1.3.6.1.2.1.43.11.1.1.6.1.1': 'prtMarkerSuppliesDescription',
        }
        
        return descriptions.get(oid, 'Unknown OID')

    def get_device_info_http(self, ip: str) -> Dict:
        """
        Extrae información del dispositivo vía HTTP/HTTPS cuando SNMP no está disponible o es incompleto
        """
        print(f"\n🌐 EXTRAYENDO DATOS VIA HTTP - IP: {ip}")
        print("=" * 50)
        
        device_info = {
            'ip': ip,
            'brand': None,
            'model': None,
            'serial_number': None,
            'status': None,
            'method': 'HTTP'
        }
        
        # URLs comunes para diferentes marcas de impresoras
        urls_to_try = [
            f"http://{ip}/",                        # Página principal
            f"http://{ip}/index.html",              # Índice
            f"http://{ip}/status.html",             # Estado
            f"http://{ip}/printer/main",            # OKI específico
            f"http://{ip}/printer/info",            # OKI información
            f"http://{ip}/printer/status",          # OKI estado
            f"http://{ip}/status",                  # Estado genérico
            f"http://{ip}/info",                    # Información genérica
            f"http://{ip}/cgi-bin/dynamic/printer/info/PrinterInfo.html",  # OKI CGI
            f"http://{ip}/cgi-bin/dynamic/config/configState.html",        # OKI Config
            f"http://{ip}/machinei.asp?Lang=es",    # RICOH información de máquina
            f"https://{ip}/",                       # HTTPS principal
            f"https://{ip}/status.html",            # HTTPS estado
        ]
        
        # Deshabilitar warnings SSL para impresoras con certificados auto-firmados
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        for url in urls_to_try:
            try:
                print(f"📡 Probando: {url}")
                
                # Configurar headers para simular navegador
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                }
                
                # Intentar conexión HTTP/HTTPS
                response = requests.get(
                    url, 
                    timeout=5, 
                    headers=headers,
                    verify=False,  # Ignorar certificados SSL inválidos
                    allow_redirects=True
                )
                
                if response.status_code == 200:
                    print(f"  ✅ Conexión exitosa: {response.status_code}")
                    
                    # Parsear contenido HTML
                    content = response.text
                    soup = BeautifulSoup(content, 'html.parser')
                    
                    # Extraer información del dispositivo
                    extracted_info = self.parse_printer_webpage(soup, content, url)
                    
                    # Actualizar device_info con los datos encontrados
                    for key, value in extracted_info.items():
                        if value and not device_info.get(key):
                            device_info[key] = value
                    
                    # Si encontramos información útil, continuar probando más URLs
                    if extracted_info:
                        print(f"  📄 Datos extraídos: {extracted_info}")
                
                else:
                    print(f"  ❌ Error HTTP: {response.status_code}")
                    
            except requests.exceptions.Timeout:
                print(f"  ⏱️ Timeout en: {url}")
            except requests.exceptions.ConnectionError:
                print(f"  🔌 Sin conexión en: {url}")
            except Exception as e:
                print(f"  ❌ Error en {url}: {str(e)}")
        
        print(f"\n📊 RESULTADO HTTP FINAL:")
        print(f"  IP: {device_info['ip']}")
        print(f"  Marca: {device_info.get('brand', 'N/A')}")
        print(f"  Modelo: {device_info.get('model', 'N/A')}")
        print(f"  Serial: {device_info.get('serial_number', 'N/A')}")
        print(f"  Estado: {device_info.get('status', 'N/A')}")
        
        return device_info

    def parse_printer_webpage(self, soup: BeautifulSoup, content: str, url: str) -> Dict:
        """
        Parsea el contenido HTML de una página web de impresora para extraer información
        """
        extracted = {}
        
        # Buscar en el título de la página
        title = soup.find('title')
        if title:
            title_text = title.get_text().strip()
            print(f"    🏷️ Título: {title_text}")
            
            # Extraer marca y modelo del título
            if 'OKI' in title_text.upper():
                extracted['brand'] = 'OKI'
                # Buscar modelo en el título
                model_match = re.search(r'(C\d{3,4}|ES\d{4}|B\d{3,4})', title_text, re.IGNORECASE)
                if model_match:
                    extracted['model'] = model_match.group(1).upper()
        
        # Buscar información en el contenido de la página
        content_upper = content.upper()
        
        # Buscar serial number en diferentes formatos
        serial_patterns = [
            r'SERIAL\s*NUMBER\s*[:\-=]?\s*([A-Z0-9]{8,15})',
            r'SERIE\s*[:\-=]?\s*([A-Z0-9]{8,15})',
            r'S/N\s*[:\-=]?\s*([A-Z0-9]{8,15})',
            r'AK\d{8}',  # Patrón específico OKI
            r'NUMBER\s*[:\-=]?\s*(AK[A-Z0-9]{6,10})',
        ]
        
        for pattern in serial_patterns:
            match = re.search(pattern, content_upper)
            if match:
                if len(match.groups()) > 0:
                    serial = match.group(1)
                else:
                    serial = match.group(0)
                    
                if self.is_valid_serial(serial):
                    extracted['serial_number'] = serial
                    print(f"    🔢 Serial encontrado: {serial}")
                    break
        
        # Buscar modelo si no se encontró en el título
        if not extracted.get('model'):
            model_patterns = [
                r'MODEL\s*[:\-=]?\s*([A-Z0-9]{2,10})',
                r'MODELO\s*[:\-=]?\s*([A-Z0-9]{2,10})',
                r'(C\d{3,4}|ES\d{4}|B\d{3,4})',  # Patrones OKI
            ]
            
            for pattern in model_patterns:
                match = re.search(pattern, content_upper)
                if match:
                    model = match.group(1)
                    if len(model) >= 2 and not model.isdigit():
                        extracted['model'] = model
                        print(f"    📱 Modelo encontrado: {model}")
                        break
        
        # Buscar estado de la impresora
        status_patterns = [
            r'STATUS\s*[:\-=]?\s*([A-Z\s]{3,20})',
            r'ESTADO\s*[:\-=]?\s*([A-Z\s]{3,20})',
            r'READY|ONLINE|IDLE|PRINTING|ERROR|WARNING'
        ]
        
        for pattern in status_patterns:
            match = re.search(pattern, content_upper)
            if match:
                if len(match.groups()) > 0:
                    status = match.group(1).strip()
                else:
                    status = match.group(0).strip()
                    
                if len(status) > 2 and status not in ['THE', 'AND', 'FOR']:
                    extracted['status'] = status.title()
                    print(f"    📊 Estado encontrado: {status}")
                    break
        
        # Buscar información en tablas
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    key = cells[0].get_text().strip().upper()
                    value = cells[1].get_text().strip()
                    
                    # RICOH: Buscar específicamente "ID MÁQUINA" en las tablas
                    if 'ID' in key and ('MÁQUINA' in key or 'MAQUINA' in key) and value:
                        # El valor puede estar en la segunda o tercera celda
                        if len(cells) >= 3:
                            # Intentar tercera celda (después del ":")
                            value = cells[2].get_text().strip()
                        if value and self.is_valid_serial(value):
                            extracted['serial_number'] = value
                            extracted['brand'] = 'RICOH'
                            print(f"    🔢 RICOH Serial (ID máquina): {value}")
                    
                    elif 'SERIAL' in key and value:
                        if self.is_valid_serial(value):
                            extracted['serial_number'] = value
                            print(f"    🔢 Serial en tabla: {value}")
                    
                    elif 'MODEL' in key and value:
                        extracted['model'] = value
                        print(f"    📱 Modelo en tabla: {value}")
        
        # RICOH: Buscar "ID máquina" en el contenido como fallback
        if not extracted.get('serial_number'):
            ricoh_machine_id_match = re.search(r'ID\s+m[áa]quina\s*[:\-=]?\s*([A-Z0-9]{8,15})', content, re.IGNORECASE)
            if ricoh_machine_id_match:
                serial = ricoh_machine_id_match.group(1)
                if self.is_valid_serial(serial):
                    extracted['serial_number'] = serial
                    extracted['brand'] = 'RICOH'
                    print(f"    🔢 RICOH Serial (ID máquina): {serial}")
        
        return extracted

    def get_device_info_combined(self, ip: str) -> Dict:
        """
        Combina información de SNMP y HTTP para obtener la información más completa posible
        """
        print(f"\n🔄 EXTRACCIÓN COMBINADA - IP: {ip}")
        print("=" * 50)
        
        # Intentar SNMP primero usando detect_device_info para obtener marca y modelo
        snmp_info = self.detect_device_info(ip)
        print(f"📡 SNMP Info: {snmp_info}")
        
        # Intentar HTTP como complemento
        http_info = self.get_device_info_http(ip)
        print(f"🌐 HTTP Info: {http_info}")
        
        # Combinar información, priorizando información más específica
        # Para seriales: priorizar HTTP si contiene patrones reales (AK, etc.) sobre SNMP genéricos
        serial_priority = None
        
        http_serial = http_info.get('serial_number')
        snmp_serial = snmp_info.get('serial_number')
        
        if http_serial and snmp_serial:
            # Si HTTP tiene un serial "real" (AK, etc.) y SNMP tiene uno genérico, usar HTTP
            if re.search(r'^AK\d{8}$', http_serial) and len(snmp_serial) < 8:
                serial_priority = http_serial
                print(f"🔄 Priorizando serial HTTP (real): {http_serial} sobre SNMP (genérico): {snmp_serial}")
            else:
                serial_priority = snmp_serial or http_serial
        else:
            serial_priority = snmp_serial or http_serial
        
        combined_info = {
            'ip': ip,
            'brand': snmp_info.get('brand') or http_info.get('brand'),
            'model': snmp_info.get('model') or http_info.get('model'),
            'serial_number': serial_priority,
            'status': snmp_info.get('status') or http_info.get('status'),
            'is_color': snmp_info.get('is_color', False) or http_info.get('is_color', False),
            'method': 'SNMP+HTTP' if (snmp_info.get('serial_number') or http_info.get('serial_number')) else 'COMBINED'
        }
        
        print(f"\n✅ INFORMACIÓN COMBINADA FINAL:")
        print(f"  Marca: {combined_info.get('brand', 'N/A')}")
        print(f"  Modelo: {combined_info.get('model', 'N/A')}")  
        print(f"  Serial: {combined_info.get('serial_number', 'N/A')}")
        print(f"  Estado: {combined_info.get('status', 'N/A')}")
        print(f"  Método: {combined_info.get('method', 'N/A')}")
        
        return combined_info

    def detect_device_info(self, ip: str) -> Dict:
        """Comprehensive device detection for discovery functionality"""
        result = {
            'success': False,
            'brand': None,
            'model': None,
            'serial_number': None,
            'system_name': None,
            'system_location': None,
            'is_color': False,
            'profile_used': None,
            'error': None
        }
        
        try:
            # First test basic connectivity
            if not self.test_connection(ip):
                result['error'] = 'No SNMP response'
                return result
            
            # Get system description to determine brand/model
            sys_descr = self.get_snmp_value(ip, '1.3.6.1.2.1.1.1.0')
            if not sys_descr:
                result['error'] = 'Could not get system description'
                return result
            
            # Parse brand and model from description
            sys_descr_lower = sys_descr.lower()
            
            if 'oki' in sys_descr_lower:
                profile = 'oki'
                result['brand'] = 'OKI'
                # Extract model from description (e.g., "ES5162LP")
                model_match = re.search(r'(ES\d+\w*|C\d+\w*|B\d+\w*)', sys_descr, re.IGNORECASE)
                if model_match:
                    result['model'] = model_match.group(1)
            elif 'hp' in sys_descr_lower or 'hewlett' in sys_descr_lower:
                profile = 'hp'
                result['brand'] = 'HP'
                # Extract HP model with improved patterns
                patterns = [
                    r'HP\s+(Laser\s+MFP\s+\w+)',           # HP Laser MFP 432fdn
                    r'HP\s+(LaserJet\s+\w+)',              # HP LaserJet Pro M404n
                    r'HP\s+(OfficeJet\s+\w+)',             # HP OfficeJet Pro 8025
                    r'HP\s+(DeskJet\s+\w+)',               # HP DeskJet 2700
                    r'HP\s+(Color\s+LaserJet\s+\w+)',      # HP Color LaserJet Pro M454dn
                    r'HP\s+(Laser\s+\w+)',                 # HP Laser 108w
                    r'HP\s+([A-Za-z0-9\s]+?)(?:;|,|\s*$)', # Generic HP model before semicolon or end
                ]
                
                for pattern in patterns:
                    model_match = re.search(pattern, sys_descr, re.IGNORECASE)
                    if model_match:
                        result['model'] = model_match.group(1).strip()
                        break
            elif 'brother' in sys_descr_lower:
                profile = 'brother'
                result['brand'] = 'Brother'
                # Extract Brother model with improved patterns
                
                # Primero intentar obtener el modelo desde Device Description (más confiable)
                device_info_temp = self.get_device_info(ip, 'brother')
                if device_info_temp and device_info_temp.get('device_description'):
                    device_desc = device_info_temp['device_description']
                    # Buscar patrón "Brother MODELO series" o "Brother MODELO"
                    model_match = re.search(r'Brother\s+([A-Z]+-[A-Z0-9]+(?:\s+series)?)', device_desc, re.IGNORECASE)
                    if model_match:
                        result['model'] = model_match.group(1).replace(' series', '')
                    else:
                        # Patrón fallback para cualquier modelo después de "Brother"
                        model_match = re.search(r'Brother\s+([A-Z]+-[A-Z0-9\-]+)', device_desc, re.IGNORECASE)
                        if model_match:
                            result['model'] = model_match.group(1)
                
                # Si no se encontró en device description, buscar en sys_descr con patrones mejorados
                if not result.get('model'):
                    patterns = [
                        r'(DCP-[A-Z0-9]+)',          # DCP-L5660DN
                        r'(HL-[A-Z0-9]+)',           # HL-L3270CDW  
                        r'(MFC-[A-Z0-9]+)',          # MFC-L8850CDW
                        r'([A-Z]+-[A-Z0-9]+)',       # Patrón general XX-XXXXX
                    ]
                    
                    for pattern in patterns:
                        model_match = re.search(pattern, sys_descr, re.IGNORECASE)
                        if model_match:
                            result['model'] = model_match.group(1)
                            break
            elif 'lexmark' in sys_descr_lower:
                profile = 'lexmark'
                result['brand'] = 'Lexmark'
                # Extract Lexmark model
                patterns = [
                    r'Lexmark\s+(MX\d+\w*)',        # Lexmark MX611dhe
                    r'Lexmark\s+(MS\d+\w*)',        # Lexmark MS series
                    r'Lexmark\s+(CX\d+\w*)',        # Lexmark CX series (color)
                    r'Lexmark\s+(CS\d+\w*)',        # Lexmark CS series (color)
                    r'Lexmark\s+(MB\d+\w*)',        # Lexmark MB series
                    r'Lexmark\s+([A-Z]+\d+\w*)',    # Generic pattern
                ]
                
                for pattern in patterns:
                    model_match = re.search(pattern, sys_descr, re.IGNORECASE)
                    if model_match:
                        result['model'] = model_match.group(1)
                        break
            elif 'epson' in sys_descr_lower:
                profile = 'epson'
                result['brand'] = 'EPSON'
                # Extract EPSON model from various sources
                
                # First try to get model from printer model OID
                printer_model_oid = '1.3.6.1.2.1.25.3.2.1.3.1'
                printer_model = self.get_snmp_value(ip, printer_model_oid)
                if printer_model and 'epson' in printer_model.lower():
                    # Extract model from printer model OID (e.g., "EPSON UB-E02" -> "UB-E02")
                    model_match = re.search(r'EPSON\s+([A-Z]+-[A-Z0-9]+)', printer_model, re.IGNORECASE)
                    if model_match:
                        result['model'] = model_match.group(1)
                    else:
                        # Fallback to the full printer model
                        result['model'] = printer_model.replace('EPSON ', '')
                
                # If no model found from printer OID, try sysDescr patterns
                if not result.get('model'):
                    patterns = [
                        r'EPSON\s+([A-Z]+-[A-Z0-9]+)',      # EPSON UB-E02
                        r'(UB-[A-Z0-9]+)',                  # UB-E02
                        r'EPSON\s+([A-Z]+\d+\w*)',          # Generic EPSON model
                    ]
                    
                    for pattern in patterns:
                        model_match = re.search(pattern, sys_descr, re.IGNORECASE)
                        if model_match:
                            result['model'] = model_match.group(1)
                            break
                
                # If still no model, check sysName for clues
                if not result.get('model'):
                    sys_name = self.get_snmp_value(ip, '1.3.6.1.2.1.1.5.0')
                    if sys_name and 'UB-' in sys_name:
                        # Extract model from sysName pattern like "UB-EB6E5E8ENPC"
                        model_match = re.search(r'(UB-[A-Z0-9]+)', sys_name)
                        if model_match:
                            result['model'] = model_match.group(1)
            elif 'ricoh' in sys_descr_lower or 'p 311' in sys_descr_lower or 'p311' in sys_descr_lower:
                profile = 'ricoh'
                result['brand'] = 'Ricoh'
                # Extract Ricoh model
                
                # Check system name for P311 pattern
                sys_name = self.get_snmp_value(ip, '1.3.6.1.2.1.1.5.0')
                if sys_name and ('p 311' in sys_name.lower() or 'p311' in sys_name.lower()):
                    result['model'] = 'P311'
                else:
                    # Try to extract model from system description
                    patterns = [
                        r'Ricoh\s+(P\d+\w*)',           # Ricoh P311
                        r'(P\s?\d+\w*)',                # P 311 or P311
                        r'Ricoh\s+(SP\s?\d+\w*)',       # Ricoh SP series
                        r'Ricoh\s+(IM\s?\d+\w*)',       # Ricoh IM series
                        r'Ricoh\s+(MP\s?\d+\w*)',       # Ricoh MP series
                        r'Ricoh\s+([A-Z]+\d+\w*)',      # Generic Ricoh model
                    ]
                    
                    # Try patterns on both sysDescr and sysName
                    for pattern in patterns:
                        model_match = re.search(pattern, sys_descr, re.IGNORECASE)
                        if model_match:
                            result['model'] = model_match.group(1).replace(' ', '')  # Remove spaces
                            break
                        
                        if sys_name:
                            model_match = re.search(pattern, sys_name, re.IGNORECASE)
                            if model_match:
                                result['model'] = model_match.group(1).replace(' ', '')  # Remove spaces
                                break
                    
                    # If no specific pattern found, default to P311 for the known IP
                    if not result.get('model') and ip == '10.10.9.13':
                        result['model'] = 'P311'
            else:
                profile = 'generic_v2c'
                result['brand'] = 'Unknown'
                result['model'] = 'Unknown'
            
            result['profile_used'] = profile
            
            # Get detailed device information
            device_info = self.get_device_info(ip, profile)
            
            result['serial_number'] = device_info.get('serial_number')
            result['system_name'] = device_info.get('system_name')
            result['system_location'] = device_info.get('system_location')
            result['is_color'] = device_info.get('is_color', False)
            
            result['success'] = True
            return result
            
        except Exception as e:
            print(f"Error in detect_device_info: {str(e)}")
            return {
                'success': False, 
                'error': str(e),
                'brand': None,
                'model': None,
                'serial_number': None,
                'system_name': None,
                'system_location': None,
                'is_color': False,
                'profile_used': None
            }
    
    def identify_printer_by_multiple_criteria(self, ip: str, db) -> Optional[object]:
        """
        Identifica una impresora usando múltiples criterios (serial, MAC, etc.)
        en lugar de solo la IP. Esto permite detectar cuando una impresora cambió de IP.
        
        Args:
            ip: IP actual del dispositivo
            db: Sesión de base de datos
            
        Returns:
            Printer object si se encuentra, None si es nuevo
        """
        from ..models import Printer
        
        try:
            # Obtener información actual del dispositivo
            device_info = self.get_device_info_combined(ip)
            
            if not device_info or not device_info.get('success'):
                return None
            
            serial = device_info.get('serial_number')
            mac = device_info.get('mac_address')
            
            # Buscar por serial (más confiable)
            if serial and serial.strip():
                printer = db.query(Printer).filter(Printer.serial_number == serial).first()
                if printer:
                    # Si encontramos la impresora pero la IP cambió
                    if printer.ip != ip:
                        logger.warning(f"🔄 IP change detected for printer {printer.asset_tag}: {printer.ip} → {ip}")
                        self.handle_ip_change(db, printer, printer.ip, ip, "discovery_auto", 
                                            "Detectado automáticamente durante discovery")
                    return printer
            
            # Buscar por MAC address (segunda opción)
            if mac and mac.strip():
                printer = db.query(Printer).filter(Printer.mac_address == mac).first()
                if printer:
                    if printer.ip != ip:
                        logger.warning(f"🔄 IP change detected (by MAC) for printer {printer.asset_tag}: {printer.ip} → {ip}")
                        self.handle_ip_change(db, printer, printer.ip, ip, "discovery_auto_mac",
                                            "Detectado por MAC address durante discovery")
                    return printer
            
            # Si no existe, es una impresora nueva
            return None
            
        except Exception as e:
            logger.error(f"Error identifying printer: {str(e)}")
            return None
    
    def handle_ip_change(self, db, printer, old_ip: str, new_ip: str, reason: str, notes: str = None):
        """
        Maneja el cambio de IP de una impresora, registrándolo en el historial
        
        Args:
            db: Sesión de base de datos
            printer: Objeto Printer
            old_ip: IP anterior
            new_ip: Nueva IP
            reason: Razón del cambio
            notes: Notas adicionales
        """
        from ..models import PrinterIPHistory
        
        try:
            # Registrar el cambio en el historial
            ip_change = PrinterIPHistory(
                printer_id=printer.id,
                old_ip=old_ip,
                new_ip=new_ip,
                changed_by='system',
                reason=reason,
                notes=notes
            )
            db.add(ip_change)
            
            # Actualizar la IP actual
            printer.ip = new_ip
            printer.updated_at = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"✅ IP updated for printer {printer.asset_tag}: {old_ip} → {new_ip}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error handling IP change: {str(e)}")
            raise
        except Exception as e:
            result['error'] = f'Detection error: {str(e)}'
            return result
