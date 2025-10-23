from pysnmp.hlapi import *
import os
from typing import Dict, Optional

class SNMPService:
    def __init__(self, community: str = None):
        self.community = community or os.getenv('POLL_COMMUNITY', 'public')
        
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
                'status': '1.3.6.1.2.1.25.3.2.1.5.1'
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
                'status': '1.3.6.1.2.1.25.3.2.1.5.1'
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
                'status': '1.3.6.1.2.1.25.3.2.1.5.1'
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
                'status': '1.3.6.1.2.1.25.3.2.1.5.1'
            }
        }
    
    def get_snmp_value(self, ip: str, oid: str) -> Optional[str]:
        """Get a single SNMP value"""
        try:
            for (errorIndication, errorStatus, errorIndex, varBinds) in nextCmd(
                SnmpEngine(),
                CommunityData(self.community),
                UdpTransportTarget((ip, 161)),
                ContextData(),
                ObjectType(ObjectIdentity(oid)),
                lexicographicMode=False):
                
                if errorIndication:
                    print(f"SNMP Error: {errorIndication}")
                    return None
                elif errorStatus:
                    print(f"SNMP Error: {errorStatus.prettyPrint()} at {errorIndex and varBinds[int(errorIndex) - 1][0] or '?'}")
                    return None
                else:
                    for varBind in varBinds:
                        return str(varBind[1])
            return None
        except Exception as e:
            print(f"SNMP Exception for {ip}:{oid} - {str(e)}")
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
        
        # Get toner levels
        toner_black = self.get_snmp_value(ip, oids['toner_black'])
        toner_cyan = self.get_snmp_value(ip, oids['toner_cyan'])
        toner_magenta = self.get_snmp_value(ip, oids['toner_magenta'])
        toner_yellow = self.get_snmp_value(ip, oids['toner_yellow'])
        
        data['toner_level_black'] = self.calculate_toner_percentage(toner_black)
        data['toner_level_cyan'] = self.calculate_toner_percentage(toner_cyan)
        data['toner_level_magenta'] = self.calculate_toner_percentage(toner_magenta)
        data['toner_level_yellow'] = self.calculate_toner_percentage(toner_yellow)
        
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