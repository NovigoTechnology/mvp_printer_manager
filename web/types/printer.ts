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
  snmp_profile: string
  
  // Características técnicas
  is_color: boolean
  printer_type?: 'printer' | 'multifunction' | 'scanner'
  print_technology?: string
  max_paper_size?: string
  duplex_capable: boolean
  network_capable: boolean
  wireless_capable: boolean
  
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
  ownership_type: string
  status: string
  condition: string
  equipment_condition: string
  
  // Contadores iniciales (solo para equipos usados)
  initial_counter_bw: number
  initial_counter_color: number
  initial_counter_total: number
  
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

export interface InventoryStats {
  total_printers: number
  ownership_distribution: { type: string, count: number }[]
  status_distribution: { status: string, count: number }[]
  brand_distribution: { brand: string, count: number }[]
  condition_distribution: { condition: string, count: number }[]
  warranties_expiring_soon: number
}