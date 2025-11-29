'use client'

import { useState, useEffect } from 'react'
import { PrinterIcon, usePrinterEmoji } from '../../components/icons'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Printer {
  id: number
  brand: string
  model: string
  serial_number?: string
  asset_tag?: string
  ip: string
  mac_address?: string
  hostname?: string
  snmp_profile: string
  is_color: boolean
  printer_type: string
  print_technology?: string
  max_paper_size?: string
  duplex_capable: boolean
  network_capable: boolean
  wireless_capable: boolean
  sector?: string
  location?: string
  floor?: string
  building?: string
  department?: string
  supplier?: string
  purchase_date?: string
  installation_date?: string
  warranty_expiry?: string
  lease_contract?: string
  ownership_type: string
  status: string
  condition: string
  equipment_condition: string
  initial_counter_bw: number
  initial_counter_color: number
  initial_counter_total: number
  notes?: string
  responsible_person?: string
  cost_center?: string
  toner_black_code?: string
  toner_cyan_code?: string
  toner_magenta_code?: string
  toner_yellow_code?: string
  other_supplies?: string
  created_at: string
}

interface DiscoveredDevice {
  ip: string
  hostname?: string
  brand?: string
  model?: string
  serial_number?: string
  is_color?: boolean
  snmp_profile?: string
  device_info?: any
  response_time?: number
  is_printer: boolean
  is_medical?: boolean  // Nueva propiedad para impresoras médicas
  connection_method?: string  // "snmp", "web_interface", "combined"
  port?: number  // Puerto de conexión
  ping_response?: boolean
  error?: string
}

interface DiscoveryRequest {
  ip_range?: string
  ip_list?: string[]
  timeout: number
  max_workers: number
  include_medical?: boolean  // Nueva opción para incluir impresoras médicas
  medical_port?: number  // Puerto para descubrimiento médico
}

interface DiscoveryConfig {
  id: number
  name: string
  ip_ranges: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface IPRange {
  id: string
  value: string
}

export default function Printers() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  const [editActiveTab, setEditActiveTab] = useState<'general' | 'management'>('general')
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [toolsPrinter, setToolsPrinter] = useState<Printer | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [discoveryConfigs, setDiscoveryConfigs] = useState<DiscoveryConfig[]>([])
  const [ipRanges, setIpRanges] = useState<IPRange[]>([
    { id: '1', value: '' }
  ])
  const [discoverySettings, setDiscoverySettings] = useState({
    timeout: 5,
    max_workers: 10,
    include_medical: true,  // Habilitar búsqueda de impresoras médicas por defecto
    medical_port: 20051  // Puerto DRYPIX por defecto
  })

  // Estados para progreso detallado del descubrimiento
  const [discoveryProgress, setDiscoveryProgress] = useState({
    currentStage: '',
    totalRanges: 0,
    completedRanges: 0,
    currentRange: '',
    devicesFound: 0,
    startTime: null as number | null,
    elapsedTime: 0,
    totalIPs: 0,
    currentIP: '',
    pingResponses: 0,
    snmpResponses: 0,
    currentPhase: 'idle' as 'idle' | 'ping' | 'snmp' | 'complete',
    rangeDetails: [] as Array<{
      range: string,
      status: 'pending' | 'ping-scanning' | 'snmp-scanning' | 'completed' | 'error',
      devicesFound: number,
      totalIPs?: number,
      pingResponses?: number,
      snmpResponses?: number,
      error?: string
    }>
  })
  
  // States for tools functionality
  const [toolsLoading, setToolsLoading] = useState<{[key: string]: boolean}>({})
  const [toolsResults, setToolsResults] = useState<{[key: string]: any}>({})
  const [toolsErrors, setToolsErrors] = useState<{[key: string]: string}>({})

  // Estados para selección múltiple de dispositivos
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]) // Array de IPs seleccionadas
  const [selectAll, setSelectAll] = useState(false)
  const [isAddingMultiple, setIsAddingMultiple] = useState(false)

  // Estados para selección múltiple de impresoras principales
  const [selectedPrinters, setSelectedPrinters] = useState<number[]>([]) // Array de IDs de impresoras seleccionadas
  const [selectAllPrinters, setSelectAllPrinters] = useState(false)
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false)
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)

  // States for discovery config management
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<DiscoveryConfig | null>(null)
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    ip_ranges: ''
  })

  const customStyles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideDown {
      from { opacity: 0; max-height: 0; transform: translateY(-10px); }
      to { opacity: 1; max-height: 500px; transform: translateY(0); }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }
    
    .animate-slideDown {
      animation: slideDown 0.3s ease-out forwards;
    }

    .animate-pulse-slow {
      animation: pulse 2s ease-in-out infinite;
    }
    
    .transition-all {
      transition: all 0.3s ease-in-out;
    }

    .hover-scale:hover {
      transform: scale(1.02);
    }

    .card-shadow {
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .card-shadow:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    .modal-backdrop {
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
  `

  useEffect(() => {
    fetchPrinters()
    fetchDiscoveryConfigs()
  }, [])

  // Temporizador para el tiempo transcurrido durante el descubrimiento
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (discovering && discoveryProgress.startTime) {
      interval = setInterval(() => {
        setDiscoveryProgress(prev => ({
          ...prev,
          elapsedTime: Date.now() - (prev.startTime || 0)
        }))
      }, 100)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [discovering, discoveryProgress.startTime])

  // Limpiar selección cuando cambian los dispositivos encontrados
  useEffect(() => {
    setSelectedDevices([])
    setSelectAll(false)
  }, [discoveredDevices.length])

  // Limpiar selección cuando cambian las impresoras
  useEffect(() => {
    setSelectedPrinters([])
    setSelectAllPrinters(false)
  }, [printers.length])

  const fetchPrinters = async () => {
    try {
      const response = await fetch(`${API_BASE}/printers/`)
      if (response.ok) {
        const data = await response.json()
        setPrinters(data)
      }
    } catch (error) {
      console.error('Error fetching printers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDiscoveryConfigs = async () => {
    try {
      const response = await fetch(`${API_BASE}/discovery/configs/`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setDiscoveryConfigs(data)
      } else {
        console.error('Failed to fetch discovery configs:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching discovery configs:', error)
    }
  }

  // Functions for discovery config management
  const openConfigForm = (config?: DiscoveryConfig) => {
    if (config) {
      setEditingConfig(config)
      setConfigForm({
        name: config.name,
        description: config.description || '',
        ip_ranges: config.ip_ranges
      })
    } else {
      setEditingConfig(null)
      setConfigForm({
        name: '',
        description: '',
        ip_ranges: ''
      })
    }
    setShowConfigForm(true)
  }

  const closeConfigForm = () => {
    setShowConfigForm(false)
    setEditingConfig(null)
    setConfigForm({
      name: '',
      description: '',
      ip_ranges: ''
    })
  }

  const saveConfig = async () => {
    try {
      const method = editingConfig ? 'PUT' : 'POST'
      const url = editingConfig 
        ? `${API_BASE}/discovery/configs/${editingConfig.id}`
        : `${API_BASE}/discovery/configs/`
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configForm),
      })

      if (response.ok) {
        await fetchDiscoveryConfigs()
        closeConfigForm()
        alert(editingConfig ? 'Configuración actualizada' : 'Configuración creada')
      } else {
        alert('Error al guardar la configuración')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Error al guardar la configuración')
    }
  }

  const deleteConfig = async (configId: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta configuración?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/discovery/configs/${configId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchDiscoveryConfigs()
        alert('Configuración eliminada')
      } else {
        alert('Error al eliminar la configuración')
      }
    } catch (error) {
      console.error('Error deleting config:', error)
      alert('Error al eliminar la configuración')
    }
  }

  const resetDiscovery = () => {
    setDiscoveredDevices([])
    setIpRanges([{ id: '1', value: '' }])
    setDiscoverySettings({ timeout: 5, max_workers: 10, include_medical: true, medical_port: 20051 })
  }

  const loadConfiguration = (config: DiscoveryConfig, replace: boolean = false) => {
    const ranges = config.ip_ranges.split(',').map(range => range.trim())
    
    if (replace) {
      // Replace all existing ranges
      const newRanges: IPRange[] = ranges.map((range, index) => ({
        id: (index + 1).toString(),
        value: range
      }))
      setIpRanges(newRanges)
    } else {
      // Add to existing ranges
      const currentMaxId = Math.max(...ipRanges.map(r => parseInt(r.id)), 0)
      const newRanges: IPRange[] = ranges.map((range, index) => ({
        id: (currentMaxId + index + 1).toString(),
        value: range
      }))
      setIpRanges([...ipRanges, ...newRanges])
    }
  }

  const addIpRange = () => {
    const newId = Math.max(...ipRanges.map(r => parseInt(r.id)), 0) + 1
    setIpRanges([...ipRanges, { id: newId.toString(), value: '' }])
  }

  const removeIpRange = (id: string) => {
    if (ipRanges.length > 1) {
      setIpRanges(ipRanges.filter(range => range.id !== id))
    }
  }

  const updateIpRange = (id: string, value: string) => {
    setIpRanges(ipRanges.map(range => 
      range.id === id ? { ...range, value } : range
    ))
  }

  const startDiscovery = async () => {
    const validRanges = ipRanges.filter(range => range.value.trim() !== '')
    
    console.log('🔍 DEBUGGING - Rangos configurados:', ipRanges)
    console.log('🔍 DEBUGGING - Rangos válidos:', validRanges)
    
    if (validRanges.length === 0) {
      alert('Por favor, ingrese al menos un rango IP válido')
      return
    }

    // Calcular total aproximado de IPs
    const calculateTotalIPs = (ranges: Array<{id: string, value: string}>) => {
      return ranges.reduce((total, range) => {
        const rangeValue = range.value.trim()
        if (rangeValue.includes('-')) {
          const [start, end] = rangeValue.split('-')
          const startParts = start.trim().split('.').map(Number)
          const endParts = end.trim().split('.').map(Number)
          
          if (startParts.length === 4 && endParts.length === 4) {
            return total + (endParts[3] - startParts[3] + 1)
          }
        } else if (rangeValue.includes('/')) {
          const [, cidr] = rangeValue.split('/')
          const hostBits = 32 - parseInt(cidr)
          return total + Math.pow(2, hostBits) - 2
        }
        return total + 1
      }, 0)
    }

    // Inicializar progreso
    const startTime = Date.now()
    const totalIPs = calculateTotalIPs(validRanges)
    setDiscovering(true)
    setDiscoveredDevices([])
    setDiscoveryProgress({
      currentStage: 'Preparando descubrimiento optimizado...',
      totalRanges: validRanges.length,
      completedRanges: 0,
      currentRange: '',
      devicesFound: 0,
      startTime: startTime,
      elapsedTime: 0,
      totalIPs,
      currentIP: '',
      pingResponses: 0,
      snmpResponses: 0,
      currentPhase: 'ping',
      rangeDetails: validRanges.map(range => ({
        range: range.value.trim(),
        status: 'pending',
        devicesFound: 0,
        totalIPs: 0,
        pingResponses: 0,
        snmpResponses: 0
      }))
    })

    console.log('🔍 Iniciando descubrimiento optimizado con ping + SNMP...')
    console.log('📋 Rangos válidos:', validRanges.length, 'Total IPs aprox:', totalIPs)
    console.log('⚙️ Configuración:', discoverySettings)

    try {
      // FASE 1: PING - Verificar qué IPs responden
      console.log('🏓 FASE 1: Verificando conectividad con ping...')
      setDiscoveryProgress(prev => ({
        ...prev,
        currentStage: 'Fase 1: Verificando conectividad (ping)...',
        currentPhase: 'ping'
      }))

      let allResponsiveIPs: string[] = []
      const rangeResponseMapping: {[key: string]: string[]} = {}

      for (let i = 0; i < validRanges.length; i++) {
        const range = validRanges[i]
        const rangeValue = range.value.trim()

        console.log(`🔍 DEBUGGING - Procesando rango ${i + 1}/${validRanges.length}:`, {
          index: i,
          range: range,
          rangeValue: rangeValue,
          totalRanges: validRanges.length
        })

        // Actualizar progreso: rango actual ping
        setDiscoveryProgress(prev => ({
          ...prev,
          currentRange: rangeValue,
          currentStage: `Ping ${i + 1}/${validRanges.length}: ${rangeValue}`,
          rangeDetails: prev.rangeDetails.map(detail =>
            detail.range === rangeValue 
              ? { ...detail, status: 'ping-scanning' }
              : detail
          )
        }))

        console.log(`🏓 [${i + 1}/${validRanges.length}] Ping en rango: ${rangeValue}`)

        try {
          console.log(`🔄 Iniciando ping para rango: ${rangeValue}`)
          
          const response = await fetch(`${API_BASE}/printers/ping-range`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip_range: rangeValue,
              timeout: discoverySettings.timeout
            })
          })

          console.log(`📡 Respuesta ping recibida para ${rangeValue}, status: ${response.status}`)

          if (response.ok) {
            const result = await response.json()
            const responsiveIPs = result.responsive_ips || []
            
            console.log(`✅ Ping completado en ${rangeValue}: ${responsiveIPs.length} IPs responden`)
            
            allResponsiveIPs.push(...responsiveIPs)
            rangeResponseMapping[rangeValue] = responsiveIPs

            // Actualizar progreso: ping completado
            setDiscoveryProgress(prev => ({
              ...prev,
              pingResponses: prev.pingResponses + responsiveIPs.length,
              rangeDetails: prev.rangeDetails.map(detail =>
                detail.range === rangeValue 
                  ? { ...detail, status: 'completed', pingResponses: responsiveIPs.length }
                  : detail
              )
            }))

          } else {
            const errorText = await response.text()
            console.error(`❌ Error ping en ${rangeValue}:`, response.status, errorText)
            
            rangeResponseMapping[rangeValue] = []
            setDiscoveryProgress(prev => ({
              ...prev,
              rangeDetails: prev.rangeDetails.map(detail =>
                detail.range === rangeValue 
                  ? { ...detail, status: 'error', error: `Ping error ${response.status}: ${errorText}` }
                  : detail
              )
            }))
          }

        } catch (pingError: any) {
          console.error(`❌ Error de conexión ping en ${rangeValue}:`, pingError)
          console.error('❌ Stack trace del error ping:', pingError)
          
          rangeResponseMapping[rangeValue] = []
          
          setDiscoveryProgress(prev => ({
            ...prev,
            rangeDetails: prev.rangeDetails.map(detail =>
              detail.range === rangeValue 
                ? { ...detail, status: 'error', error: `Error de conexión en ping: ${pingError?.message || 'Error desconocido'}` }
                : detail
            )
          }))
          
          // NO hacer return aquí, continuar con el siguiente rango
          console.log(`⚠️ Continuando con el siguiente rango después del error en ${rangeValue}`)
        }
      }

      // FASE 2: SNMP - Solo verificar IPs que respondieron al ping
      console.log(`🔌 FASE 2: Verificando SNMP en ${allResponsiveIPs.length} IPs que respondieron...`)
      setDiscoveryProgress(prev => ({
        ...prev,
        currentStage: `Fase 2: Verificando SNMP en ${allResponsiveIPs.length} IPs responsivas`,
        currentPhase: 'snmp',
        completedRanges: 0,
        rangeDetails: prev.rangeDetails.map(detail => ({
          ...detail,
          status: 'pending'
        }))
      }))

      const allFoundDevices: DiscoveredDevice[] = []

      for (let i = 0; i < validRanges.length; i++) {
        const range = validRanges[i]
        const rangeValue = range.value.trim()
        const responsiveIPsInRange = rangeResponseMapping[rangeValue] || []

        console.log(`🔍 DEBUGGING SNMP - Rango ${i + 1}/${validRanges.length}:`, {
          index: i,
          range: range,
          rangeValue: rangeValue,
          responsiveIPsInRange: responsiveIPsInRange,
          responsiveCount: responsiveIPsInRange.length
        })

        if (responsiveIPsInRange.length === 0) {
          console.log(`⏭️ Saltando SNMP en ${rangeValue}: sin IPs responsivas`)
          
          setDiscoveryProgress(prev => ({
            ...prev,
            completedRanges: i + 1,
            rangeDetails: prev.rangeDetails.map(detail =>
              detail.range === rangeValue 
                ? { ...detail, status: 'completed', snmpResponses: 0, devicesFound: 0 }
                : detail
            )
          }))
          continue
        }

        // Actualizar progreso: rango actual SNMP
        setDiscoveryProgress(prev => ({
          ...prev,
          currentRange: rangeValue,
          currentStage: `SNMP ${i + 1}/${validRanges.length}: ${rangeValue} (${responsiveIPsInRange.length} IPs)`,
          rangeDetails: prev.rangeDetails.map(detail =>
            detail.range === rangeValue 
              ? { ...detail, status: 'snmp-scanning' }
              : detail
          )
        }))

        console.log(`🔌 [${i + 1}/${validRanges.length}] SNMP en ${rangeValue}: ${responsiveIPsInRange.length} IPs`)

        try {
          console.log(`🔄 Iniciando SNMP para rango: ${rangeValue} con ${responsiveIPsInRange.length} IPs`)
          
          const request: DiscoveryRequest = {
            ip_list: responsiveIPsInRange, // Solo las IPs que respondieron al ping
            timeout: discoverySettings.timeout,
            max_workers: discoverySettings.max_workers,
            include_medical: discoverySettings.include_medical,  // Incluir búsqueda de médicas
            medical_port: discoverySettings.medical_port  // Puerto para DRYPIX
          }

          const response = await fetch(`${API_BASE}/printers/discover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
          })

          console.log(`📡 Respuesta SNMP${discoverySettings.include_medical ? '/Médica' : ''} recibida para ${rangeValue}, status: ${response.status}`)

          if (response.ok) {
            const devices = await response.json()
            const printers = devices.filter((device: DiscoveredDevice) => device.is_printer)
            
            console.log(`✅ SNMP completado en ${rangeValue}: ${printers.length} impresoras encontradas`)
            
            // Agregar dispositivos encontrados
            allFoundDevices.push(...printers)
            // ❌ REMOVIDO: setDiscoveredDevices([...allFoundDevices]) - Se ejecutará al final

            // Actualizar progreso: SNMP completado
            setDiscoveryProgress(prev => ({
              ...prev,
              completedRanges: i + 1,
              devicesFound: allFoundDevices.length,
              snmpResponses: prev.snmpResponses + printers.length,
              rangeDetails: prev.rangeDetails.map(detail =>
                detail.range === rangeValue 
                  ? { 
                      ...detail, 
                      status: 'completed', 
                      devicesFound: printers.length,
                      snmpResponses: printers.length 
                    }
                  : detail
              )
            }))

          } else {
            const errorText = await response.text()
            console.error(`❌ Error SNMP en ${rangeValue}:`, response.status, errorText)
            
            setDiscoveryProgress(prev => ({
              ...prev,
              completedRanges: i + 1,
              rangeDetails: prev.rangeDetails.map(detail =>
                detail.range === rangeValue 
                  ? { ...detail, status: 'error', error: `SNMP error ${response.status}: ${errorText}` }
                  : detail
              )
            }))
          }

        } catch (snmpError: any) {
          console.error(`❌ Error de conexión SNMP en ${rangeValue}:`, snmpError)
          console.error('❌ Stack trace del error SNMP:', snmpError)
          
          setDiscoveryProgress(prev => ({
            ...prev,
            completedRanges: i + 1,
            rangeDetails: prev.rangeDetails.map(detail =>
              detail.range === rangeValue 
                ? { ...detail, status: 'error', error: `Error de conexión en SNMP: ${snmpError?.message || 'Error desconocido'}` }
                : detail
            )
          }))
          
          // NO hacer return aquí, continuar con el siguiente rango
          console.log(`⚠️ Continuando con el siguiente rango después del error SNMP en ${rangeValue}`)
        }
      }

      // Finalizar descubrimiento y actualizar dispositivos encontrados
      console.log('🔍 PRE-SET - Dispositivos antes de setDiscoveredDevices:', allFoundDevices.length)
      console.log('🔍 PRE-SET - Dispositivos detalle:', allFoundDevices)
      console.log('🔍 PRE-SET - Estado actual discoveredDevices.length:', discoveredDevices.length)
      
      // Usar setTimeout para asegurar que el estado se actualice correctamente
      setTimeout(() => {
        setDiscoveredDevices([...allFoundDevices])
        console.log('🔍 POST-SET - setDiscoveredDevices ejecutado con', allFoundDevices.length, 'dispositivos')
      }, 100)
      
      setDiscoveryProgress(prev => ({
        ...prev,
        currentStage: `Descubrimiento optimizado completado`,
        currentPhase: 'complete',
        currentRange: ''
      }))

      console.log('🎯 Descubrimiento optimizado completado:')
      console.log(`   📊 Total IPs escaneadas: ~${totalIPs}`)
      console.log(`   🏓 IPs que respondieron ping: ${allResponsiveIPs.length}`)
      console.log(`   🖨️ Impresoras encontradas: ${allFoundDevices.length}`)
      console.log('🔍 DEBUGGING - Dispositivos finales:', allFoundDevices)

      const efficiency = totalIPs > 0 ? Math.round((allResponsiveIPs.length / totalIPs) * 100) : 0
      
      // Usar setTimeout para mostrar el alert después de un breve delay
      // Esto asegura que todos los estados se hayan actualizado correctamente
      setTimeout(() => {
        if (!document.hidden) { // Solo mostrar si la página está visible
          alert(`Descubrimiento optimizado completado!\n\n` +
                `📊 IPs escaneadas: ~${totalIPs}\n` +
                `🏓 Respondieron ping: ${allResponsiveIPs.length} (${efficiency}%)\n` +
                `🖨️ Impresoras encontradas: ${allFoundDevices.length}`)
        } else {
          console.log('⚠️ Alert suprimido - página no visible')
        }
      }, 500)

    } catch (error) {
      console.error('❌ Error general durante descubrimiento optimizado:', error)
      setDiscoveryProgress(prev => ({
        ...prev,
        currentStage: 'Error crítico durante el descubrimiento optimizado'
      }))
      
      // Solo mostrar alert si realmente es un error crítico
      console.error('❌ ERROR CRÍTICO - Descubrimiento interrumpido:', error)
      
      // En lugar de alert, actualizar el estado para mostrar en la UI
      setDiscoveryProgress(prev => ({
        ...prev,
        currentStage: 'Error crítico - Revisa la consola para más detalles'
      }))
    } finally {
      setDiscovering(false)
    }
  }

  // Función para generar asset_tag automático
  const generateAssetTag = () => {
    const existingTags = printers.map(p => p.asset_tag).filter(tag => tag && tag.startsWith('PRT-'))
    let maxNumber = 0
    
    existingTags.forEach(tag => {
      if (tag) {
        const match = tag.match(/PRT-(\d+)/)
        if (match) {
          const num = parseInt(match[1])
          if (num > maxNumber) maxNumber = num
        }
      }
    })
    
    return `PRT-${String(maxNumber + 1).padStart(3, '0')}`
  }

  const addPrinter = async (device: DiscoveredDevice) => {
    try {
      const printerData = {
        brand: device.brand || 'Unknown',
        model: device.model || 'Unknown',
        asset_tag: generateAssetTag(),
        serial_number: device.serial_number || '',
        ip: device.ip,
        hostname: device.hostname || '',
        snmp_profile: device.snmp_profile || 'public',
        is_color: device.is_color || false,
        printer_type: 'Laser',
        ownership_type: 'owned',
        status: 'active',
        condition: 'good',
        equipment_condition: 'new',
        duplex_capable: false,
        network_capable: true,
        wireless_capable: false,
        initial_counter_bw: 0,
        initial_counter_color: 0,
        initial_counter_total: 0
      }

      const response = await fetch(`${API_BASE}/printers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerData)
      })

      if (response.ok) {
        fetchPrinters()
        setDiscoveredDevices(prev => prev.filter(d => d.ip !== device.ip))
        alert('Impresora agregada exitosamente')
      } else {
        alert('Error al agregar la impresora')
      }
    } catch (error) {
      console.error('Error adding printer:', error)
      alert('Error al agregar la impresora')
    }
  }

  const addManualPrinter = async (printerData: any) => {
    try {
      const response = await fetch(`${API_BASE}/printers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerData)
      })

      if (response.ok) {
        await fetchPrinters()
        setShowAddModal(false)
        alert('Impresora agregada exitosamente')
      } else {
        const errorData = await response.json()
        console.error('Error response:', errorData)
        alert(`Error al agregar la impresora: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error adding manual printer:', error)
      alert('Error al agregar la impresora')
    }
  }

  const openEditModal = async (printer: Printer) => {
    setEditingPrinter(printer)
    setEditActiveTab('general')
    setShowEditModal(true)
    
    // Load lease contract data if exists
    try {
      const response = await fetch(`${API_BASE}/printers/${printer.id}/lease-contract`)
      if (response.ok) {
        const contractData = await response.json()
        console.log('Contract data loaded:', contractData)
        
        // Auto-populate form fields with contract data
        setTimeout(() => {
          const form = document.querySelector('form') as HTMLFormElement
          if (form && contractData) {
            // Populate supplier/provider
            if (contractData.supplier_name) {
              const supplierInput = form.querySelector('input[name="supplier"]') as HTMLInputElement
              if (supplierInput) supplierInput.value = contractData.supplier_name
            }
            
            // Populate contract dates
            if (contractData.start_date) {
              const startDateInput = form.querySelector('input[name="lease_start_date"]') as HTMLInputElement
              if (startDateInput) startDateInput.value = contractData.start_date
            }
            
            if (contractData.end_date) {
              const endDateInput = form.querySelector('input[name="lease_end_date"]') as HTMLInputElement
              if (endDateInput) endDateInput.value = contractData.end_date
            }
            
            // Populate costs
            if (contractData.monthly_rent) {
              const monthlyCostInput = form.querySelector('input[name="monthly_cost"]') as HTMLInputElement
              if (monthlyCostInput) monthlyCostInput.value = contractData.monthly_rent.toString()
            }
            
            if (contractData.cost_per_page_bw) {
              const costBWInput = form.querySelector('input[name="cost_per_page_bw"]') as HTMLInputElement
              if (costBWInput) costBWInput.value = contractData.cost_per_page_bw.toString()
            }
            
            if (contractData.cost_per_page_color) {
              const costColorInput = form.querySelector('input[name="cost_per_page_color"]') as HTMLInputElement
              if (costColorInput) costColorInput.value = contractData.cost_per_page_color.toString()
            }
            
            // Populate contact information
            if (contractData.contact_name) {
              const contactNameInput = form.querySelector('input[name="contact_name"]') as HTMLInputElement
              if (contactNameInput) contactNameInput.value = contractData.contact_name
            }
            
            if (contractData.contact_email) {
              const contactEmailInput = form.querySelector('input[name="contact_email"]') as HTMLInputElement
              if (contactEmailInput) contactEmailInput.value = contractData.contact_email
            }
            
            if (contractData.contact_phone) {
              const contactPhoneInput = form.querySelector('input[name="contact_phone"]') as HTMLInputElement
              if (contactPhoneInput) contactPhoneInput.value = contractData.contact_phone
            }
            
            // Set ownership type to leased
            const ownershipSelect = form.querySelector('select[name="ownership_type"]') as HTMLSelectElement
            if (ownershipSelect) ownershipSelect.value = 'leased'
            
            console.log('Form fields populated with contract data')
          }
        }, 100) // Small delay to ensure form is rendered
      }
    } catch (error) {
      console.error('Error loading contract data:', error)
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingPrinter(null)
    setEditActiveTab('general')
  }

  const updatePrinter = async (printerData: any) => {
    if (!editingPrinter) return
    
    try {
      const response = await fetch(`${API_BASE}/printers/${editingPrinter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerData)
      })

      if (response.ok) {
        await fetchPrinters()
        closeEditModal()
        alert('Impresora actualizada exitosamente')
      } else {
        const errorData = await response.json()
        console.error('Error response:', errorData)
        alert(`Error al actualizar la impresora: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error updating printer:', error)
      alert('Error al actualizar la impresora')
    }
  }

  // Funciones para selección múltiple de dispositivos
  const handleDeviceSelection = (deviceIP: string, isSelected: boolean) => {
    setSelectedDevices(prev => {
      if (isSelected) {
        return [...prev, deviceIP]
      } else {
        return prev.filter(ip => ip !== deviceIP)
      }
    })
  }

  const handleSelectAll = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    
    if (newSelectAll) {
      // Seleccionar solo dispositivos que no están ya agregados
      const selectableDevices = discoveredDevices
        .filter(device => !device.device_info?.existing_in_db)
        .map(device => device.ip)
      setSelectedDevices(selectableDevices)
    } else {
      setSelectedDevices([])
    }
  }

  // Funciones para selección múltiple de impresoras principales
  const handlePrinterSelection = (printerId: number, isSelected: boolean) => {
    setSelectedPrinters(prev => {
      if (isSelected) {
        return [...prev, printerId]
      } else {
        return prev.filter(id => id !== printerId)
      }
    })
  }

  const handleSelectAllPrinters = () => {
    const newSelectAll = !selectAllPrinters
    setSelectAllPrinters(newSelectAll)
    
    if (newSelectAll) {
      setSelectedPrinters(filteredPrinters.map(printer => printer.id))
    } else {
      setSelectedPrinters([])
    }
  }

  const executeBulkAction = async (action: string) => {
    if (selectedPrinters.length === 0) {
      alert('Por favor selecciona al menos una impresora')
      return
    }

    setBulkActionInProgress(true)
    
    try {
      switch (action) {
        case 'change_status':
          const newStatus = prompt('Ingresa el nuevo estado (active, inactive, maintenance):')
          if (newStatus && ['active', 'inactive', 'maintenance'].includes(newStatus)) {
            // Implementar cambio de estado masivo
            const response = await fetch(`${API_BASE}/printers/bulk-update-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                printer_ids: selectedPrinters,
                status: newStatus
              })
            })
            
            if (response.ok) {
              await fetchPrinters()
              alert(`Estado actualizado para ${selectedPrinters.length} impresoras`)
              setSelectedPrinters([])
              setSelectAllPrinters(false)
              setShowBulkActionsModal(false)
            } else {
              alert('Error al actualizar el estado')
            }
          }
          break
          
        case 'change_location':
          const newLocation = prompt('Ingresa la nueva ubicación:')
          if (newLocation) {
            // Implementar cambio de ubicación masivo
            const response = await fetch(`${API_BASE}/printers/bulk-update-location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                printer_ids: selectedPrinters,
                location: newLocation
              })
            })
            
            if (response.ok) {
              await fetchPrinters()
              alert(`Ubicación actualizada para ${selectedPrinters.length} impresoras`)
              setSelectedPrinters([])
              setSelectAllPrinters(false)
              setShowBulkActionsModal(false)
            } else {
              alert('Error al actualizar la ubicación')
            }
          }
          break
          
        case 'export_selected':
          // Implementar exportación de impresoras seleccionadas
          const selectedPrintersData = printers.filter(p => selectedPrinters.includes(p.id))
          const csvContent = generateCSVContent(selectedPrintersData)
          downloadCSV(csvContent, 'impresoras_seleccionadas.csv')
          setShowBulkActionsModal(false)
          break
          
        case 'delete_selected':
          if (confirm(`¿Estás seguro de que deseas eliminar ${selectedPrinters.length} impresoras?`)) {
            // Implementar eliminación masiva
            const response = await fetch(`${API_BASE}/printers/bulk-delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                printer_ids: selectedPrinters
              })
            })
            
            if (response.ok) {
              await fetchPrinters()
              alert(`${selectedPrinters.length} impresoras eliminadas`)
              setSelectedPrinters([])
              setSelectAllPrinters(false)
              setShowBulkActionsModal(false)
            } else {
              alert('Error al eliminar las impresoras')
            }
          }
          break
      }
    } catch (error) {
      console.error('Error en acción masiva:', error)
      alert('Error al ejecutar la acción masiva')
    } finally {
      setBulkActionInProgress(false)
    }
  }

  // Funciones auxiliares para exportación
  const generateCSVContent = (printersData: Printer[]) => {
    const headers = ['ID', 'Marca', 'Modelo', 'IP', 'Serial', 'Asset Tag', 'Ubicación', 'Estado']
    const rows = printersData.map(p => [
      p.id.toString(),
      p.brand,
      p.model,
      p.ip,
      p.serial_number || '',
      p.asset_tag || '',
      p.location || '',
      p.status
    ])
    
    return [headers, ...rows].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n')
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const addMultiplePrinters = async () => {
    if (selectedDevices.length === 0) {
      alert('Por favor selecciona al menos un dispositivo para agregar')
      return
    }

    setIsAddingMultiple(true)
    
    try {
      // Preparar datos de dispositivos seleccionados
      const devicesToAdd = discoveredDevices
        .filter(device => selectedDevices.includes(device.ip) && !device.device_info?.existing_in_db)
        .map(device => ({
          ip: device.ip,
          brand: device.brand || 'Unknown',
          model: device.model || 'Unknown',
          serial_number: device.serial_number || '',
          hostname: device.hostname || '',
          snmp_profile: device.snmp_profile || 'public',
          is_color: device.is_color || false
        }))

      console.log('Agregando dispositivos:', devicesToAdd)

      const response = await fetch(`${API_BASE}/printers/discover/add-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(devicesToAdd)
      })

      if (response.ok) {
        const responseData = await response.json()
        console.log('Resultados completos:', responseData)
        
        // Extraer el array de resultados de la respuesta
        const results = responseData.results || responseData
        console.log('Array de resultados:', results)
        
        // Verificar que results sea un array
        if (!Array.isArray(results)) {
          console.error('Error: results no es un array:', results)
          alert('Error: formato de respuesta inválido del servidor')
          return
        }
        
        // Contar éxitos y errores
        const successful = results.filter((r: any) => r.success).length
        const failed = results.filter((r: any) => !r.success).length
        
        console.log(`Procesamiento completado: ${successful} éxitos, ${failed} errores`)
        
        // Actualizar lista de impresoras
        await fetchPrinters()
        
        // Limpiar selección
        setSelectedDevices([])
        setSelectAll(false)
        
        // Mostrar resultado
        if (failed === 0) {
          alert(`✅ Se agregaron exitosamente ${successful} impresoras`)
        } else {
          alert(`✅ Se agregaron ${successful} impresoras\n❌ ${failed} fallaron\n\nRevisa la consola para más detalles`)
          
          // Mostrar detalles de errores en consola
          const failedResults = results.filter((r: any) => !r.success)
          console.log('Dispositivos que fallaron:', failedResults)
          console.log('🔍 DETALLE DE ERRORES:')
          failedResults.forEach((result: any, index: number) => {
            console.log(`  ${index + 1}. IP: ${result.ip}`)
            console.log(`     Error: ${result.error}`)
            console.log(`     Success: ${result.success}`)
            console.log(`     Detalles completos:`, result)
          })
        }
        
        // Remover dispositivos agregados exitosamente de la lista
        const failedIPs = results.filter((r: any) => !r.success).map((r: any) => r.ip)
        setDiscoveredDevices(prev => prev.filter(device => 
          failedIPs.includes(device.ip) || device.device_info?.existing_in_db
        ))
        
      } else {
        const errorText = await response.text()
        console.error('Error al agregar impresoras:', errorText)
        alert(`Error al agregar impresoras: ${errorText}`)
      }
    } catch (error) {
      console.error('Error en addMultiplePrinters:', error)
      alert('Error al conectar con el servidor')
    } finally {
      setIsAddingMultiple(false)
    }
  }

  const refreshPrinters = async () => {
    setLoading(true)
    await fetchPrinters()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Esta función ahora se reemplaza por el componente PrinterIcon
  // Mantenemos getBrandIcon para compatibilidad con emojis como fallback
  const getBrandIcon = (brand: string) => {
    return usePrinterEmoji(brand);
  }

  const filteredPrinters = printers.filter(printer => {
    const matchesSearch = printer.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         printer.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         printer.ip.includes(searchTerm) ||
                         (printer.location && printer.location.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesBrand = filterBrand === '' || printer.brand.toLowerCase() === filterBrand.toLowerCase()
    
    return matchesSearch && matchesBrand
  })

  const uniqueBrands = Array.from(new Set(printers.map(p => p.brand))).sort()

  // Tools functionality
  const handleConnectivityTest = async (printer: Printer) => {
    const toolKey = `connectivity-${printer.id}`
    setToolsLoading(prev => ({ ...prev, [toolKey]: true }))
    setToolsErrors(prev => ({ ...prev, [toolKey]: '' }))
    
    try {
      const response = await fetch(`${API_BASE}/printer-tools/tools/connectivity/${printer.id}`)
      if (response.ok) {
        const result = await response.json()
        setToolsResults(prev => ({ ...prev, [toolKey]: result }))
        
        // Show results in a modal or alert
        const pingStatus = result.tests?.ping?.success ? '✅ Exitoso' : '❌ Falló'
        const snmpStatus = result.tests?.snmp?.success ? '✅ Exitoso' : '❌ Falló'
        const webStatus = result.tests?.web_interface?.accessible ? '✅ Accesible' : '❌ No accesible'
        
        const pingTime = result.tests?.ping?.response_time_ms ? ` (${result.tests.ping.response_time_ms}ms)` : ''
        const snmpTime = result.tests?.snmp?.response_time_ms ? ` (${result.tests.snmp.response_time_ms}ms)` : ''
        
        alert(`Test de Conectividad - ${printer.brand} ${printer.model}\n\n` +
              `Estado General: ${result.overall_status === 'success' ? '✅ OK' : result.overall_status === 'warning' ? '⚠️ Advertencia' : '❌ Error'}\n\n` +
              `Ping: ${pingStatus}${pingTime}\n` +
              `SNMP: ${snmpStatus}${snmpTime}\n` +
              `Web Interface: ${webStatus}\n\n` +
              `IP: ${printer.ip}`)
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      const errorMsg = `Error al probar conectividad: ${error}`
      setToolsErrors(prev => ({ ...prev, [toolKey]: errorMsg }))
      alert(errorMsg)
    } finally {
      setToolsLoading(prev => ({ ...prev, [toolKey]: false }))
    }
  }

  const handleStatusCheck = async (printer: Printer) => {
    const toolKey = `status-${printer.id}`
    setToolsLoading(prev => ({ ...prev, [toolKey]: true }))
    setToolsErrors(prev => ({ ...prev, [toolKey]: '' }))
    
    try {
      const response = await fetch(`${API_BASE}/printer-tools/tools/status/${printer.id}`)
      if (response.ok) {
        const result = await response.json()
        setToolsResults(prev => ({ ...prev, [toolKey]: result }))
        
        // Format status information
        const statusInfo = [
          `Estado: ${result.status || 'Desconocido'}`,
          `Total Páginas: ${result.total_pages || 0}`,
          `Páginas B/N: ${result.pages_printed_mono || 0}`,
          `Páginas Color: ${result.pages_printed_color || 0}`
        ].join('\n')
        
        alert(`Estado y Contadores - ${printer.brand} ${printer.model}\n\n${statusInfo}`)
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      const errorMsg = `Error al consultar estado: ${error}`
      setToolsErrors(prev => ({ ...prev, [toolKey]: errorMsg }))
      alert(errorMsg)
    } finally {
      setToolsLoading(prev => ({ ...prev, [toolKey]: false }))
    }
  }

  const handleTonerCheck = async (printer: Printer) => {
    const toolKey = `toner-${printer.id}`
    setToolsLoading(prev => ({ ...prev, [toolKey]: true }))
    setToolsErrors(prev => ({ ...prev, [toolKey]: '' }))
    
    try {
      const response = await fetch(`${API_BASE}/printer-tools/tools/toner/${printer.id}`)
      if (response.ok) {
        const result = await response.json()
        setToolsResults(prev => ({ ...prev, [toolKey]: result }))
        
        // Format toner information
        const tonerInfo = []
        if (result.toner_level_black !== null) tonerInfo.push(`Negro: ${result.toner_level_black}%`)
        if (result.toner_level_cyan !== null) tonerInfo.push(`Cian: ${result.toner_level_cyan}%`)
        if (result.toner_level_magenta !== null) tonerInfo.push(`Magenta: ${result.toner_level_magenta}%`)
        if (result.toner_level_yellow !== null) tonerInfo.push(`Amarillo: ${result.toner_level_yellow}%`)
        
        const tonerText = tonerInfo.length > 0 ? tonerInfo.join('\n') : 'No se pudo obtener información de tóner'
        
        alert(`Niveles de Tóner - ${printer.brand} ${printer.model}\n\n${tonerText}`)
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      const errorMsg = `Error al consultar tóner: ${error}`
      setToolsErrors(prev => ({ ...prev, [toolKey]: errorMsg }))
      alert(errorMsg)
    } finally {
      setToolsLoading(prev => ({ ...prev, [toolKey]: false }))
    }
  }

  const handleSnmpConfig = async (printer: Printer) => {
    const toolKey = `snmp-${printer.id}`
    setToolsLoading(prev => ({ ...prev, [toolKey]: true }))
    setToolsErrors(prev => ({ ...prev, [toolKey]: '' }))
    
    try {
      const response = await fetch(`${API_BASE}/printer-tools/tools/snmp-config/${printer.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        setToolsResults(prev => ({ ...prev, [toolKey]: result }))
        
        const configInfo = [
          `Versión SNMP: ${result.snmp_version || 'No detectada'}`,
          `Comunidad: ${result.community || 'N/A'}`,
          `Perfil: ${result.profile_used || 'Genérico'}`,
          `Test exitoso: ${result.test_passed ? '✅ Sí' : '❌ No'}`
        ].join('\n')
        
        alert(`Configuración SNMP - ${printer.brand} ${printer.model}\n\n${configInfo}`)
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      const errorMsg = `Error al probar SNMP: ${error}`
      setToolsErrors(prev => ({ ...prev, [toolKey]: errorMsg }))
      alert(errorMsg)
    } finally {
      setToolsLoading(prev => ({ ...prev, [toolKey]: false }))
    }
  }

  const handleTestPrint = async (printer: Printer) => {
    const toolKey = `testprint-${printer.id}`
    setToolsLoading(prev => ({ ...prev, [toolKey]: true }))
    setToolsErrors(prev => ({ ...prev, [toolKey]: '' }))
    
    try {
      const response = await fetch(`${API_BASE}/printer-tools/tools/test-print/${printer.id}`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        setToolsResults(prev => ({ ...prev, [toolKey]: result }))
        
        if (result.success) {
          alert(`Página de prueba enviada exitosamente a ${printer.brand} ${printer.model}\n\n` +
                `IP: ${printer.ip}\n` +
                `Estado: ${result.message || 'Comando enviado'}`)
        } else {
          alert(`Error al enviar página de prueba:\n${result.error || 'Error desconocido'}`)
        }
      } else {
        throw new Error('Error en la respuesta del servidor')
      }
    } catch (error) {
      const errorMsg = `Error al enviar página de prueba: ${error}`
      setToolsErrors(prev => ({ ...prev, [toolKey]: errorMsg }))
      alert(errorMsg)
    } finally {
      setToolsLoading(prev => ({ ...prev, [toolKey]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando impresoras...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx>{customStyles}</style>
      <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8 flex flex-col lg:flex-row lg:justify-between lg:items-center">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Impresoras 🖨️</h1>
              <p className="mt-2 text-gray-600">Administra tu flota de impresoras ({printers.length} dispositivos) - Herramientas mejoradas</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={refreshPrinters}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
              <button
                onClick={() => {
                  resetDiscovery()
                  setShowDiscoveryModal(true)
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>🔍</span>
                <span>Descubrir</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Buscar por marca, modelo, IP o ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Filtrar por marca"
                >
                  <option value="">Todas las marcas</option>
                  {uniqueBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                  }`}
                >
                  ⚏ Tarjetas
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'table' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                  }`}
                >
                  ☰ Tabla
                </button>
              </div>
            </div>
            
            {/* Bulk Actions Bar */}
            {selectedPrinters.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-slideDown">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-blue-800 font-medium">
                      {selectedPrinters.length} impresora{selectedPrinters.length !== 1 ? 's' : ''} seleccionada{selectedPrinters.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedPrinters([])
                        setSelectAllPrinters(false)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Limpiar selección
                    </button>
                  </div>
                  <button
                    onClick={() => setShowBulkActionsModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>⚡</span>
                    <span>Acciones Masivas</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Printers Display */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPrinters.map((printer) => (
                <div
                  key={printer.id}
                  className={`bg-white rounded-lg card-shadow hover-scale transition-all cursor-pointer relative ${
                    selectedPrinters.includes(printer.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedPrinter(printer)}
                >
                  {/* Checkbox de selección */}
                  <div className="absolute top-3 right-3 z-10">
                    <input
                      type="checkbox"
                      checked={selectedPrinters.includes(printer.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handlePrinterSelection(printer.id, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <PrinterIcon brand={printer.brand} size={32} className="flex-shrink-0" />
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full tracking-tight">
                              {printer.brand}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm tracking-tight">
                            {printer.model}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono mt-1">{printer.ip}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(printer.status)}`}>
                        {printer.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      {printer.asset_tag && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Asset Tag:</span>
                          <span className="font-medium">{printer.asset_tag}</span>
                        </div>
                      )}
                      {printer.serial_number && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Serie:</span>
                          <span className="font-medium text-xs">{printer.serial_number}</span>
                        </div>
                      )}
                      {printer.location && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Ubicación:</span>
                          <span className="font-medium text-xs">{printer.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        printer.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {printer.is_color ? 'Color' : 'B&W'}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {printer.printer_type}
                      </span>
                      {printer.duplex_capable && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Duplex
                        </span>
                      )}
                      {printer.network_capable && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                          Red
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-1">
                      <button 
                        className="flex-1 text-xs py-2 px-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPrinter(printer)
                        }}
                      >
                        👁️ Ver
                      </button>
                      <button 
                        className="flex-1 text-xs py-2 px-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(printer)
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        className="flex-1 text-xs py-2 px-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setToolsPrinter(printer)
                          setShowToolsModal(true)
                        }}
                      >
                        🔧 Herramientas
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectAllPrinters}
                          onChange={handleSelectAllPrinters}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          title="Seleccionar todas las impresoras"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impresora</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Red</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Características</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPrinters.map((printer) => (
                      <tr key={printer.id} className={`hover:bg-gray-50 ${selectedPrinters.includes(printer.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedPrinters.includes(printer.id)}
                            onChange={(e) => handlePrinterSelection(printer.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            title="Seleccionar impresora"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <PrinterIcon brand={printer.brand} size={28} className="mr-3 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {printer.brand} {printer.model}
                              </div>
                              {printer.serial_number && (
                                <div className="text-sm text-gray-500">SN: {printer.serial_number}</div>
                              )}
                              {printer.asset_tag && (
                                <div className="text-sm text-gray-500">Tag: {printer.asset_tag}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{printer.ip}</div>
                          {printer.hostname && (
                            <div className="text-sm text-gray-500">{printer.hostname}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              printer.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {printer.is_color ? 'Color' : 'B&W'}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {printer.printer_type}
                            </span>
                            {printer.duplex_capable && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                Duplex
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(printer.status)}`}>
                            {printer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {printer.location || printer.sector || 'No especificada'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => setSelectedPrinter(printer)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Ver detalles"
                            >
                              👁️
                            </button>
                            <button 
                              onClick={() => openEditModal(printer)}
                              className="text-green-600 hover:text-green-900"
                              title="Editar impresora"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => {
                                setToolsPrinter(printer)
                                setShowToolsModal(true)
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Herramientas"
                            >
                              🔧
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Discovery Modal */}
          {showDiscoveryModal && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
              onClick={(e) => {
                // Prevenir que clicks en el backdrop cierren el modal durante descubrimiento
                if (discovering) {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('⚠️ Intento de cerrar modal durante descubrimiento - bloqueado')
                }
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn"
                onClick={(e) => e.stopPropagation()} // Prevenir que clicks dentro del modal lo cierren
              >
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl font-semibold text-white tracking-tight">Descubrimiento de Impresoras</h2>
                      <p className="text-blue-100 text-sm font-light mt-1">Escanea la red para encontrar nuevas impresoras</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!discovering) {
                          setShowDiscoveryModal(false)
                        } else {
                          alert('No se puede cerrar durante el descubrimiento. Espera a que termine o cancela el proceso.')
                        }
                      }}
                      disabled={discovering}
                      className={`text-2xl transition-colors ${
                        discovering 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-white hover:text-gray-200 cursor-pointer'
                      }`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Configuration Section */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Load Configuration */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800 tracking-tight">Configuraciones de Red</h4>
                        <button
                          onClick={() => openConfigForm()}
                          className="w-8 h-8 border border-gray-300 hover:border-blue-500 hover:text-blue-500 text-gray-600 rounded flex items-center justify-center transition-colors"
                          title="Nueva Configuración"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {discoveryConfigs.map(config => (
                          <div key={config.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 text-base tracking-tight">{config.name}</p>
                              <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded text-xs mt-1 inline-block">{config.ip_ranges}</p>
                              {config.description && (
                                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{config.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => loadConfiguration(config, false)}
                                className="w-6 h-6 border border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-500 rounded flex items-center justify-center text-sm transition-colors"
                                title="Agregar rangos"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => loadConfiguration(config, true)}
                                className="w-6 h-6 border border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-500 rounded flex items-center justify-center text-sm transition-colors"
                                title="Reemplazar rangos"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openConfigForm(config)}
                                className="w-6 h-6 border border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-500 rounded flex items-center justify-center text-sm transition-colors"
                                title="Editar"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteConfig(config.id)}
                                className="w-6 h-6 border border-gray-300 hover:border-gray-500 hover:bg-gray-50 text-gray-600 hover:text-gray-700 rounded flex items-center justify-center text-sm transition-colors"
                                title="Eliminar"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {discoveryConfigs.length === 0 && (
                          <div className="text-center text-gray-500 py-6 px-4">
                            <p className="text-base font-medium text-gray-700 mb-2">No hay configuraciones guardadas</p>
                            <p className="text-sm text-gray-500 leading-relaxed">Crea una nueva configuración para guardar tus rangos IP favoritos y agilizar futuros descubrimientos.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Ranges */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800 tracking-tight">Rangos IP</h4>
                        <button
                          onClick={addIpRange}
                          className="w-8 h-8 border border-gray-300 hover:border-blue-500 hover:text-blue-500 text-gray-600 rounded flex items-center justify-center transition-colors"
                          title="Agregar Rango"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {ipRanges.map((range) => (
                          <div key={range.id} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={range.value}
                              onChange={(e) => updateIpRange(range.id, e.target.value)}
                              placeholder="192.168.1.1-192.168.1.100 o 192.168.1.1/24"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {ipRanges.length > 1 && (
                              <button
                                onClick={() => removeIpRange(range.id)}
                                className="w-8 h-8 border border-gray-300 hover:border-gray-500 hover:bg-gray-50 text-gray-600 hover:text-gray-700 rounded flex items-center justify-center text-sm transition-colors"
                                title="Eliminar rango"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Discovery Controls */}
                  <div className="flex items-center space-x-6 mb-6 p-5 bg-gray-50 rounded-xl">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">Timeout (seg)</label>
                      <input
                        type="number"
                        value={discoverySettings.timeout}
                        onChange={(e) => setDiscoverySettings(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">Workers</label>
                      <input
                        type="number"
                        value={discoverySettings.max_workers}
                        onChange={(e) => setDiscoverySettings(prev => ({ ...prev, max_workers: parseInt(e.target.value) }))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">
                        <input
                          type="checkbox"
                          checked={discoverySettings.include_medical}
                          onChange={(e) => setDiscoverySettings(prev => ({ ...prev, include_medical: e.target.checked }))}
                          className="mr-2"
                        />
                        Incluir Médicas
                      </label>
                      <p className="text-xs text-gray-500 mt-1">DRYPIX, FCR, CR</p>
                    </div>
                    {discoverySettings.include_medical && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">Puerto Médico</label>
                        <input
                          type="number"
                          value={discoverySettings.medical_port}
                          onChange={(e) => setDiscoverySettings(prev => ({ ...prev, medical_port: parseInt(e.target.value) }))}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          min="1"
                          max="65535"
                        />
                      </div>
                    )}
                    <button
                      onClick={startDiscovery}
                      disabled={discovering}
                      className={`w-10 h-10 border rounded flex items-center justify-center transition-colors ${
                        discovering 
                          ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                          : 'border-blue-500 text-blue-500 hover:bg-blue-50'
                      }`}
                      title={discovering ? 'Escaneando...' : 'Iniciar Escaneado'}
                    >
                      {discovering ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Discovery Progress */}
                  {discovering && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-blue-900 tracking-tight">Estado del Descubrimiento</h3>
                        <div className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                          ⏱️ {Math.floor(discoveryProgress.elapsedTime / 1000)}s transcurridos
                        </div>
                      </div>
                      
                      {/* Etapa actual */}
                      <div className="mb-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <span className="text-base font-semibold text-blue-800 tracking-tight">{discoveryProgress.currentStage}</span>
                        </div>
                        {discoveryProgress.currentRange && (
                          <div className="text-sm text-blue-600 ml-8 font-medium">
                            📍 Rango actual: <span className="font-mono bg-blue-100 px-2 py-1 rounded text-xs">{discoveryProgress.currentRange}</span>
                          </div>
                        )}
                      </div>

                      {/* Barra de progreso general */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm font-semibold text-blue-700 mb-2">
                          <span className="tracking-tight">Progreso general</span>
                          <span className="bg-blue-100 px-2 py-1 rounded text-xs">{discoveryProgress.completedRanges} de {discoveryProgress.totalRanges} rangos</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${discoveryProgress.totalRanges > 0 ? (discoveryProgress.completedRanges / discoveryProgress.totalRanges) * 100 : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Estadísticas rápidas - Optimizado */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="text-center p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                          <div className="text-lg font-bold text-blue-600 tracking-tight">{discoveryProgress.devicesFound}</div>
                          <div className="text-xs text-blue-500 font-medium mt-1">🖨️ Impresoras</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border border-green-200 shadow-sm">
                          <div className="text-lg font-bold text-green-600 tracking-tight">{discoveryProgress.pingResponses}</div>
                          <div className="text-xs text-green-500 font-medium mt-1">🏓 Ping OK</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border border-purple-200 shadow-sm">
                          <div className="text-lg font-bold text-purple-600 tracking-tight">{discoveryProgress.snmpResponses}</div>
                          <div className="text-xs text-purple-500 font-medium mt-1">🔌 SNMP OK</div>
                        </div>
                        <div className="text-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="text-lg font-bold text-gray-600 tracking-tight">~{discoveryProgress.totalIPs}</div>
                          <div className="text-xs text-gray-500 font-medium mt-1">📊 IPs total</div>
                        </div>
                      </div>

                      {/* Indicador de fase actual */}
                      {discoveryProgress.currentPhase !== 'idle' && (
                        <div className="mb-4 p-3 bg-white rounded-md border border-blue-100">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                discoveryProgress.currentPhase === 'ping' ? 'bg-green-100 text-green-800' :
                                discoveryProgress.currentPhase === 'snmp' ? 'bg-purple-100 text-purple-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {discoveryProgress.currentPhase === 'ping' ? '🏓 Fase Ping' :
                                 discoveryProgress.currentPhase === 'snmp' ? '🔌 Fase SNMP' :
                                 '✅ Completado'}
                              </div>
                              {discoveryProgress.currentPhase === 'ping' && (
                                <span className="text-xs text-green-600">
                                  Verificando conectividad básica
                                </span>
                              )}
                              {discoveryProgress.currentPhase === 'snmp' && (
                                <span className="text-xs text-purple-600">
                                  Detectando impresoras en {discoveryProgress.pingResponses} IPs responsivas
                                </span>
                              )}
                            </div>
                            {discoveryProgress.currentPhase === 'snmp' && discoveryProgress.pingResponses > 0 && (
                              <div className="text-xs text-gray-500">
                                Eficiencia: {Math.round((discoveryProgress.pingResponses / discoveryProgress.totalIPs) * 100)}%
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Detalle por rango */}
                      <div>
                        <h4 className="text-base font-semibold text-blue-800 mb-3 tracking-tight">Detalle por Rango:</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {discoveryProgress.rangeDetails.map((detail, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100 text-sm shadow-sm">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  detail.status === 'pending' ? 'bg-gray-400' :
                                  detail.status === 'ping-scanning' ? 'bg-green-500 animate-pulse' :
                                  detail.status === 'snmp-scanning' ? 'bg-purple-500 animate-pulse' :
                                  detail.status === 'completed' ? 'bg-blue-500' :
                                  'bg-red-500'
                                }`}></div>
                                <span className="font-mono text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded text-xs">{detail.range}</span>
                                <span className={`font-medium ${
                                  detail.status === 'pending' ? 'text-gray-500' :
                                  detail.status === 'ping-scanning' ? 'text-green-600' :
                                  detail.status === 'snmp-scanning' ? 'text-purple-600' :
                                  detail.status === 'completed' ? 'text-blue-600' :
                                  'text-red-600'
                                }`}>
                                  {detail.status === 'pending' ? 'Pendiente' :
                                   detail.status === 'ping-scanning' ? '🏓 Ping...' :
                                   detail.status === 'snmp-scanning' ? '🔌 SNMP...' :
                                   detail.status === 'completed' ? 'Completado' :
                                   'Error'}
                                </span>
                              </div>
                              <div className="text-right">
                                {detail.status === 'completed' && (
                                  <div className="space-y-1">
                                    {typeof detail.pingResponses === 'number' && (
                                      <div className="text-green-600 text-xs">
                                        🏓 {detail.pingResponses} ping
                                      </div>
                                    )}
                                    {typeof detail.snmpResponses === 'number' && (
                                      <div className="text-purple-600 text-xs">
                                        🔌 {detail.snmpResponses} SNMP
                                      </div>
                                    )}
                                    <div className="text-blue-600 font-medium text-xs">
                                      🖨️ {detail.devicesFound} impresoras
                                    </div>
                                  </div>
                                )}
                                {detail.status === 'error' && detail.error && (
                                  <span className="text-red-600 text-xs" title={detail.error}>
                                    ❌ {detail.error.length > 15 ? detail.error.substring(0, 15) + '...' : detail.error}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Discovered Devices */}
                  {discoveredDevices.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Dispositivos Encontrados ({discoveredDevices.length})
                        </h3>
                        <div className="flex gap-2">
                          <button
                            onClick={addMultiplePrinters}
                            disabled={selectedDevices.length === 0 || isAddingMultiple}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                          >
                            {isAddingMultiple ? (
                              <>
                                <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                                Agregando...
                              </>
                            ) : (
                              <>
                                ➕ Agregar Seleccionados ({selectedDevices.length})
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setDiscoveredDevices(discoveredDevices.filter(d => !d.device_info?.existing_in_db))}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            Solo Nuevos
                          </button>
                          <button
                            onClick={() => setDiscoveredDevices([])}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <input
                                  type="checkbox"
                                  checked={selectAll}
                                  onChange={handleSelectAll}
                                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                IP / Hostname
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Marca / Modelo
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Serie
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tipo
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Conectividad
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acción
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {discoveredDevices.map((device, index) => {
                              const isExisting = device.device_info?.existing_in_db || false
                              const pingOk = device.ping_response !== false
                              const snmpOk = device.snmp_profile && device.snmp_profile !== 'No disponible'
                              const isMedical = device.is_medical || false
                              
                              return (
                                <tr key={index} className={`${isExisting ? 'bg-yellow-50' : isMedical ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={selectedDevices.includes(device.ip)}
                                      onChange={(e) => handleDeviceSelection(device.ip, e.target.checked)}
                                      disabled={isExisting}
                                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{device.ip}</div>
                                      {device.hostname && (
                                        <div className="text-sm text-gray-500">{device.hostname}</div>
                                      )}
                                      {device.port && device.port !== 161 && (
                                        <div className="text-xs text-gray-500">Puerto: {device.port}</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex flex-col space-y-1">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isExisting 
                                          ? 'bg-yellow-100 text-yellow-800' 
                                          : isMedical
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {isExisting ? 'Ya agregada' : isMedical ? '🏥 Médica' : 'Nueva'}
                                      </span>
                                      {device.response_time && (
                                        <span className="text-xs text-gray-500">
                                          {device.response_time}ms
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div>
                                      {device.brand && (
                                        <div className="text-sm font-medium text-gray-900">{device.brand}</div>
                                      )}
                                      {device.model && (
                                        <div className="text-sm text-gray-500">{device.model}</div>
                                      )}
                                      {!device.brand && !device.model && (
                                        <div className="text-sm text-gray-400">Sin identificar</div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {device.serial_number || '-'}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      device.is_color 
                                        ? 'bg-purple-100 text-purple-800' 
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {device.is_color ? 'Color' : 'B&W'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex space-x-2">
                                      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                        pingOk 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        🏓 {pingOk ? 'Ping OK' : 'Sin Ping'}
                                      </span>
                                      {isMedical ? (
                                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                          🌐 Web OK
                                        </span>
                                      ) : (
                                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                          snmpOk 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          📡 {snmpOk ? 'SNMP OK' : 'Sin SNMP'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    {!isExisting ? (
                                      <button
                                        onClick={() => addPrinter(device)}
                                        className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm font-medium transition-colors"
                                      >
                                        ➕ Agregar
                                      </button>
                                    ) : (
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-xs text-gray-500">
                                          {device.device_info?.existing_printer?.asset_tag || 'Ya agregada'}
                                        </span>
                                        <button
                                          onClick={() => {
                                            const existingId = device.device_info?.existing_printer?.id
                                            if (existingId) {
                                              // Aquí podrías agregar lógica para actualizar o ver detalles
                                              alert(`Impresora ya existe con ID: ${existingId}\nAsset Tag: ${device.device_info?.existing_printer?.asset_tag}`)
                                            }
                                          }}
                                          className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs transition-colors"
                                        >
                                          🔍 Ver
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Summary Statistics */}
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-600">
                              {discoveredDevices.length}
                            </div>
                            <div className="text-sm text-gray-600">Total Encontradas</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {discoveredDevices.filter(d => !d.device_info?.existing_in_db).length}
                            </div>
                            <div className="text-sm text-gray-600">Nuevas</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {discoveredDevices.filter(d => d.ping_response !== false).length}
                            </div>
                            <div className="text-sm text-gray-600">Con Ping</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">
                              {discoveredDevices.filter(d => d.snmp_profile && d.snmp_profile !== 'No disponible').length}
                            </div>
                            <div className="text-sm text-gray-600">Con SNMP</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Config Management Modal */}
          {showConfigForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-fadeIn">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-green-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}
                      </h2>
                      <p className="text-green-100">Gestionar configuraciones de descubrimiento</p>
                    </div>
                    <button
                      onClick={closeConfigForm}
                      className="text-white hover:text-gray-200 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de la Configuración *
                      </label>
                      <input
                        type="text"
                        value={configForm.name}
                        onChange={(e) => setConfigForm({...configForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="ej. Red Corporativa"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rangos IP *
                      </label>
                      <textarea
                        value={configForm.ip_ranges}
                        onChange={(e) => setConfigForm({...configForm, ip_ranges: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 h-24"
                        placeholder="192.168.1.1-192.168.1.100 o 192.168.1.1/24"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separe múltiples rangos con comas. Formatos soportados: 192.168.1.1-192.168.1.100, 192.168.1.1/24
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <textarea
                        value={configForm.description}
                        onChange={(e) => setConfigForm({...configForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 h-20"
                        placeholder="Descripción opcional de la configuración"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={saveConfig}
                      disabled={!configForm.name.trim() || !configForm.ip_ranges.trim()}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-md font-medium transition-colors"
                    >
                      {editingConfig ? 'Actualizar' : 'Crear'} Configuración
                    </button>
                    <button
                      onClick={closeConfigForm}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Printer Detail Modal */}
          {selectedPrinter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-500 to-gray-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedPrinter.brand} {selectedPrinter.model}
                      </h2>
                      <p className="text-gray-100">{selectedPrinter.ip}</p>
                    </div>
                    <button
                      onClick={() => setSelectedPrinter(null)}
                      className="text-white hover:text-gray-200 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Información General</h3>
                      <div className="space-y-2">
                        <div><span className="font-medium">Marca:</span> {selectedPrinter.brand}</div>
                        <div><span className="font-medium">Modelo:</span> {selectedPrinter.model}</div>
                        {selectedPrinter.serial_number && (
                          <div><span className="font-medium">Serie:</span> {selectedPrinter.serial_number}</div>
                        )}
                        {selectedPrinter.asset_tag && (
                          <div><span className="font-medium">Asset Tag:</span> {selectedPrinter.asset_tag}</div>
                        )}
                        <div><span className="font-medium">Estado:</span> 
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPrinter.status)}`}>
                            {selectedPrinter.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Red y Conectividad</h3>
                      <div className="space-y-2">
                        <div><span className="font-medium">IP:</span> {selectedPrinter.ip}</div>
                        {selectedPrinter.hostname && (
                          <div><span className="font-medium">Hostname:</span> {selectedPrinter.hostname}</div>
                        )}
                        {selectedPrinter.mac_address && (
                          <div><span className="font-medium">MAC:</span> {selectedPrinter.mac_address}</div>
                        )}
                        <div><span className="font-medium">SNMP:</span> {selectedPrinter.snmp_profile}</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Características</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedPrinter.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedPrinter.is_color ? 'Color' : 'B&W'}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {selectedPrinter.printer_type}
                        </span>
                        {selectedPrinter.duplex_capable && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            Duplex
                          </span>
                        )}
                        {selectedPrinter.network_capable && (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                            Red
                          </span>
                        )}
                        {selectedPrinter.wireless_capable && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            WiFi
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Ubicación</h3>
                      <div className="space-y-2">
                        {selectedPrinter.location && (
                          <div><span className="font-medium">Ubicación:</span> {selectedPrinter.location}</div>
                        )}
                        {selectedPrinter.sector && (
                          <div><span className="font-medium">Sector:</span> {selectedPrinter.sector}</div>
                        )}
                        {selectedPrinter.floor && (
                          <div><span className="font-medium">Piso:</span> {selectedPrinter.floor}</div>
                        )}
                        {selectedPrinter.building && (
                          <div><span className="font-medium">Edificio:</span> {selectedPrinter.building}</div>
                        )}
                        {selectedPrinter.department && (
                          <div><span className="font-medium">Departamento:</span> {selectedPrinter.department}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => window.open(`http://${selectedPrinter.ip}`, '_blank')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      🌐 Acceder a Panel Web
                    </button>
                    <button
                      onClick={() => setSelectedPrinter(null)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tools Modal */}
          {showToolsModal && toolsPrinter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-green-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">Herramientas de Impresora</h2>
                      <p className="text-green-100">{toolsPrinter.brand} {toolsPrinter.model} - {toolsPrinter.ip}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowToolsModal(false)
                        setToolsPrinter(null)
                      }}
                      className="text-white hover:text-gray-200 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Acceso Web */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">🌐</span>
                        <h3 className="font-semibold text-blue-900">Acceso Web</h3>
                      </div>
                      <p className="text-sm text-blue-700 mb-4">Acceder al panel de administración web de la impresora</p>
                      <button
                        onClick={() => window.open(`http://${toolsPrinter.ip}`, '_blank')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        Abrir Panel Web
                      </button>
                    </div>

                    {/* Test de Conectividad */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">🔌</span>
                        <h3 className="font-semibold text-green-900">Test de Conectividad</h3>
                      </div>
                      <p className="text-sm text-green-700 mb-4">Verificar conectividad de red y respuesta SNMP</p>
                      <button
                        onClick={() => handleConnectivityTest(toolsPrinter)}
                        disabled={toolsLoading[`connectivity-${toolsPrinter.id}`]}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        {toolsLoading[`connectivity-${toolsPrinter.id}`] ? 'Ejecutando...' : 'Ejecutar Test'}
                      </button>
                    </div>

                    {/* Estado y Contadores */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">📊</span>
                        <h3 className="font-semibold text-purple-900">Estado y Contadores</h3>
                      </div>
                      <p className="text-sm text-purple-700 mb-4">Consultar estado actual y contadores de páginas</p>
                      <button
                        onClick={() => handleStatusCheck(toolsPrinter)}
                        disabled={toolsLoading[`status-${toolsPrinter.id}`]}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        {toolsLoading[`status-${toolsPrinter.id}`] ? 'Consultando...' : 'Consultar Estado'}
                      </button>
                    </div>

                    {/* Información de Tóner */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">🖨️</span>
                        <h3 className="font-semibold text-yellow-900">Información de Tóner</h3>
                      </div>
                      <p className="text-sm text-yellow-700 mb-4">Verificar niveles de tóner y suministros</p>
                      <button
                        onClick={() => handleTonerCheck(toolsPrinter)}
                        disabled={toolsLoading[`toner-${toolsPrinter.id}`]}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        {toolsLoading[`toner-${toolsPrinter.id}`] ? 'Verificando...' : 'Ver Niveles'}
                      </button>
                    </div>

                    {/* Configuración SNMP */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 hover:bg-indigo-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">⚙️</span>
                        <h3 className="font-semibold text-indigo-900">Configuración SNMP</h3>
                      </div>
                      <p className="text-sm text-indigo-700 mb-4">Probar y configurar parámetros SNMP</p>
                      <button
                        onClick={() => handleSnmpConfig(toolsPrinter)}
                        disabled={toolsLoading[`snmp-${toolsPrinter.id}`]}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        {toolsLoading[`snmp-${toolsPrinter.id}`] ? 'Probando...' : 'Configurar SNMP'}
                      </button>
                    </div>

                    {/* Página de Prueba */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors">
                      <div className="flex items-center mb-3">
                        <span className="text-2xl mr-3">📄</span>
                        <h3 className="font-semibold text-red-900">Página de Prueba</h3>
                      </div>
                      <p className="text-sm text-red-700 mb-4">Enviar página de prueba para verificar funcionamiento</p>
                      <button
                        onClick={() => handleTestPrint(toolsPrinter)}
                        disabled={toolsLoading[`testprint-${toolsPrinter.id}`]}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      >
                        {toolsLoading[`testprint-${toolsPrinter.id}`] ? 'Enviando...' : 'Imprimir Prueba'}
                      </button>
                    </div>

                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        setShowToolsModal(false)
                        setToolsPrinter(null)
                      }}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add Printer Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-backdrop">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Agregar Nueva Impresora</h2>
                
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target as HTMLFormElement)
                  const newPrinter = {
                    brand: formData.get('brand') as string,
                    model: formData.get('model') as string,
                    asset_tag: formData.get('asset_tag') as string,
                    serial_number: formData.get('serial_number') as string,
                    ip: formData.get('ip') as string,
                    hostname: formData.get('hostname') as string,
                    snmp_profile: formData.get('snmp_profile') as string,
                    is_color: formData.get('is_color') === 'true',
                    printer_type: 'Laser',
                    ownership_type: 'owned',
                    status: 'active',
                    condition: 'good',
                    equipment_condition: 'used',
                    duplex_capable: false,
                    network_capable: true,
                    wireless_capable: false,
                    initial_counter_bw: 0,
                    initial_counter_color: 0,
                    initial_counter_total: 0,
                    location: formData.get('location') as string || 'Agregado manualmente'
                  }
                  addManualPrinter(newPrinter)
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                      <select name="brand" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Seleccionar marca</option>
                        <option value="HP">HP</option>
                        <option value="Brother">Brother</option>
                        <option value="OKI">OKI</option>
                        <option value="Lexmark">Lexmark</option>
                        <option value="Ricoh">Ricoh</option>
                        <option value="EPSON">EPSON</option>
                        <option value="Canon">Canon</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                      <input type="text" name="model" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: LaserJet Pro M404n" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Etiqueta de Inventario</label>
                      <div className="flex space-x-2">
                        <input type="text" name="asset_tag" required className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: PRT-001" />
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = (e.target as HTMLElement).parentElement?.querySelector('input[name="asset_tag"]') as HTMLInputElement
                            if (input) input.value = generateAssetTag()
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm transition-colors"
                        >
                          Auto
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número de Serie</label>
                      <input type="text" name="serial_number" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección IP</label>
                      <input type="text" name="ip" required pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 192.168.1.100" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                      <input type="text" name="hostname" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                      <input type="text" name="location" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Oficina principal" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Perfil SNMP</label>
                      <select name="snmp_profile" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="public">public (estándar)</option>
                        <option value="hp">HP</option>
                        <option value="brother">Brother</option>
                        <option value="oki">OKI</option>
                        <option value="lexmark">Lexmark</option>
                        <option value="ricoh">Ricoh</option>
                        <option value="epson">EPSON</option>
                        <option value="generic_v2c">Genérico v2c</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Impresora</label>
                      <select name="is_color" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="false">Monocromática</option>
                        <option value="true">Color</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Agregar Impresora
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Printer Modal */}
          {showEditModal && editingPrinter && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-backdrop">
              <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-green-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">Editar Impresora</h2>
                      <p className="text-green-100">{editingPrinter.brand} {editingPrinter.model} - {editingPrinter.ip}</p>
                    </div>
                    <button
                      onClick={closeEditModal}
                      className="text-white hover:text-gray-200 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Tab Navigation */}
                  <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
                    <button
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        editActiveTab === 'general'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setEditActiveTab('general')}
                    >
                      📝 Información General
                    </button>
                    <button
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        editActiveTab === 'management'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setEditActiveTab('management')}
                    >
                      🏢 Gestión
                    </button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.target as HTMLFormElement)
                    const updatedPrinter = {
                      brand: formData.get('brand') as string,
                      model: formData.get('model') as string,
                      asset_tag: formData.get('asset_tag') as string,
                      serial_number: formData.get('serial_number') as string,
                      ip: formData.get('ip') as string,
                      hostname: formData.get('hostname') as string,
                      snmp_profile: formData.get('snmp_profile') as string,
                      is_color: formData.get('is_color') === 'true',
                      location: formData.get('location') as string,
                      sector: formData.get('sector') as string,
                      floor: formData.get('floor') as string,
                      building: formData.get('building') as string,
                      department: formData.get('department') as string,
                      ownership_type: formData.get('ownership_type') as string,
                      supplier: formData.get('supplier') as string,
                      purchase_date: formData.get('purchase_date') as string,
                      warranty_end_date: formData.get('warranty_end_date') as string,
                      lease_start_date: formData.get('lease_start_date') as string,
                      lease_end_date: formData.get('lease_end_date') as string,
                      monthly_cost: formData.get('monthly_cost') ? parseFloat(formData.get('monthly_cost') as string) : null,
                      cost_per_page_bw: formData.get('cost_per_page_bw') ? parseFloat(formData.get('cost_per_page_bw') as string) : null,
                      cost_per_page_color: formData.get('cost_per_page_color') ? parseFloat(formData.get('cost_per_page_color') as string) : null,
                      contact_name: formData.get('contact_name') as string,
                      contact_email: formData.get('contact_email') as string,
                      contact_phone: formData.get('contact_phone') as string
                    }
                    updatePrinter(updatedPrinter)
                  }}>

                    {/* General Tab */}
                    {editActiveTab === 'general' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                            <select name="brand" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.brand}>
                              <option value="">Seleccionar marca</option>
                              <option value="HP">HP</option>
                              <option value="Brother">Brother</option>
                              <option value="OKI">OKI</option>
                              <option value="Lexmark">Lexmark</option>
                              <option value="Ricoh">Ricoh</option>
                              <option value="EPSON">EPSON</option>
                              <option value="Canon">Canon</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                            <input type="text" name="model" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.model} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Tag</label>
                            <input type="text" name="asset_tag" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.asset_tag} />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número de Serie</label>
                            <input type="text" name="serial_number" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.serial_number || ''} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">IP</label>
                            <input type="text" name="ip" required pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.ip} />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                            <input type="text" name="hostname" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.hostname || ''} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil SNMP</label>
                            <select name="snmp_profile" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.snmp_profile}>
                              <option value="public">public (estándar)</option>
                              <option value="hp">HP</option>
                              <option value="brother">Brother</option>
                              <option value="oki">OKI</option>
                              <option value="lexmark">Lexmark</option>
                              <option value="ricoh">Ricoh</option>
                              <option value="epson">EPSON</option>
                              <option value="generic_v2c">Genérico v2c</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select name="is_color" required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.is_color.toString()}>
                              <option value="false">Monocromática</option>
                              <option value="true">Color</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Ubicación</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                              <input type="text" name="location" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.location || ''} />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                              <input type="text" name="sector" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.sector || ''} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                              <input type="text" name="floor" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.floor || ''} />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Edificio</label>
                              <input type="text" name="building" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.building || ''} />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                            <input type="text" name="department" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.department || ''} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Management Tab */}
                    {editActiveTab === 'management' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <span className="text-2xl">ℹ️</span>
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-blue-800">
                                Información Contractual
                              </h3>
                              <div className="mt-1 text-sm text-blue-700">
                                <p>Los campos se cargarán automáticamente si la impresora tiene un contrato de arrendamiento asociado.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Propiedad</label>
                          <select name="ownership_type" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.ownership_type || 'owned'}>
                            <option value="owned">Propio</option>
                            <option value="leased">Arrendado</option>
                            <option value="rented">Alquilado</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                          <input type="text" name="supplier" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.supplier || ''} placeholder="Nombre del proveedor" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
                            <input type="date" name="purchase_date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={editingPrinter.purchase_date || ''} />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fin de Garantía</label>
                            <input type="date" name="warranty_end_date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).warranty_end_date || ''} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inicio de Arrendamiento</label>
                            <input type="date" name="lease_start_date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).lease_start_date || ''} />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fin de Arrendamiento</label>
                            <input type="date" name="lease_end_date" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).lease_end_date || ''} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo Mensual</label>
                            <input type="number" name="monthly_cost" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).monthly_cost || ''} placeholder="0.00" />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo por Página B/N</label>
                            <input type="number" name="cost_per_page_bw" step="0.001" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).cost_per_page_bw || ''} placeholder="0.000" />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo por Página Color</label>
                            <input type="number" name="cost_per_page_color" step="0.001" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).cost_per_page_color || ''} placeholder="0.000" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Información de Contacto</h3>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Contacto</label>
                            <input type="text" name="contact_name" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).contact_name || ''} placeholder="Nombre del contacto" />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contacto</label>
                              <input type="email" name="contact_email" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).contact_email || ''} placeholder="email@ejemplo.com" />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de Contacto</label>
                              <input type="tel" name="contact_phone" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" defaultValue={(editingPrinter as any).contact_phone || ''} placeholder="+1 234 567 8900" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                      <button
                        type="button"
                        onClick={closeEditModal}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Actualizar Impresora
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Actions Modal */}
          {showBulkActionsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-fadeIn">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Acciones Masivas</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedPrinters.length} impresora{selectedPrinters.length !== 1 ? 's' : ''} seleccionada{selectedPrinters.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    <button
                      onClick={() => executeBulkAction('change_status')}
                      disabled={bulkActionInProgress}
                      className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center space-x-3"
                    >
                      <span className="text-blue-600">🔄</span>
                      <div>
                        <div className="font-medium text-blue-900">Cambiar Estado</div>
                        <div className="text-sm text-blue-600">Actualizar el estado de todas las impresoras seleccionadas</div>
                      </div>
                    </button>

                    <button
                      onClick={() => executeBulkAction('change_location')}
                      disabled={bulkActionInProgress}
                      className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center space-x-3"
                    >
                      <span className="text-green-600">📍</span>
                      <div>
                        <div className="font-medium text-green-900">Cambiar Ubicación</div>
                        <div className="text-sm text-green-600">Asignar una nueva ubicación a todas las impresoras</div>
                      </div>
                    </button>

                    <button
                      onClick={() => executeBulkAction('export_selected')}
                      disabled={bulkActionInProgress}
                      className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center space-x-3"
                    >
                      <span className="text-purple-600">📊</span>
                      <div>
                        <div className="font-medium text-purple-900">Exportar Seleccionadas</div>
                        <div className="text-sm text-purple-600">Descargar un archivo CSV con las impresoras seleccionadas</div>
                      </div>
                    </button>

                    <button
                      onClick={() => executeBulkAction('delete_selected')}
                      disabled={bulkActionInProgress}
                      className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center space-x-3"
                    >
                      <span className="text-red-600">🗑️</span>
                      <div>
                        <div className="font-medium text-red-900">Eliminar Seleccionadas</div>
                        <div className="text-sm text-red-600">Eliminar permanentemente las impresoras seleccionadas</div>
                      </div>
                    </button>
                  </div>

                  {bulkActionInProgress && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        <span className="text-blue-800 text-sm font-medium">Ejecutando acción masiva...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowBulkActionsModal(false)}
                    disabled={bulkActionInProgress}
                    className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
