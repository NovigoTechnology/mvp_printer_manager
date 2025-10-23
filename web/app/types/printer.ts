export interface Printer {
  id: number
  // Información básica
  brand: string
  model: string
  serial_number?: string
  asset_tag?: string
  
  // Configuración de red
  ip: string
  mac_address?: string
  hostname?: string
  snmp_profile?: string
  
  // Características técnicas
  is_color: boolean
  printer_type?: 'printer' | 'multifunction' | 'scanner'
  print_technology?: string
  max_paper_size?: string
  duplex_capable?: boolean
  network_capable?: boolean
  wireless_capable?: boolean
  
  // Información de ubicación
  sector?: string
  location?: string
  floor?: string
  building?: string
  department?: string
  
  // Información de adquisición
  supplier?: string
  purchase_date?: string
  installation_date?: string
  warranty_expiry?: string
  lease_contract?: string
  
  // Estado y propiedad
  ownership_type?: 'owned' | 'leased' | 'rented'
  status?: 'active' | 'inactive' | 'maintenance' | 'retired'
  condition?: 'excellent' | 'good' | 'fair' | 'poor'
  
  // Información adicional
  notes?: string
  responsible_person?: string
  cost_center?: string
  
  // Información de insumos
  toner_black_code?: string
  toner_cyan_code?: string
  toner_magenta_code?: string
  toner_yellow_code?: string
  other_supplies?: string
  
  // Timestamps
  created_at: string
  updated_at?: string
}

export interface PrinterStats {
  total_printers: number
  online_printers: number
  offline_printers: number
  error_printers: number
  warning_printers: number
}