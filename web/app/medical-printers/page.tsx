'use client'

import { useState, useEffect } from 'react'
import { TonerHistoryTab } from '../inventory/TonerHistoryTab'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface MedicalPrinter {
  id: number
  brand: string
  model: string
  serial_number?: string
  asset_tag?: string
  ip: string
  hostname?: string
  status: string
  location?: string
  department?: string
  responsible_person?: string
  print_technology?: string
  printer_type?: string
  condition?: string
  equipment_condition?: string
  ownership_type?: string
  network_capable?: boolean
  wireless_capable?: boolean
  created_at?: string
}

interface TrayInfo {
  available: number
  printed: number
}

interface MedicalCounterData {
  timestamp: string
  tray_capacity: number
  trays: {
    [key: string]: TrayInfo
  }
  summary: {
    total_available: number
    total_printed: number
    total_trays_loaded: number
  }
  status: string
  is_online: boolean
}

interface PrinterStatus {
  printer: MedicalPrinter
  counters?: MedicalCounterData
  last_update?: string
  error?: string
  loading: boolean
  uptime?: UptimeData
}

interface UptimeData {
  uptime_percentage: number
  total_records: number
  online_records: number
  offline_records: number
  period_days: number
  current_status: string
}

export default function MedicalPrinters() {
  const [printers, setPrinters] = useState<MedicalPrinter[]>([])
  const [printerStatuses, setPrinterStatuses] = useState<Map<number, PrinterStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // segundos
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [viewingPrinter, setViewingPrinter] = useState<MedicalPrinter | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'network' | 'technical' | 'location' | 'ownership' | 'supplies' | 'toner-history'>('basic')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyPrinter, setHistoryPrinter] = useState<MedicalPrinter | null>(null)
  const [printHistory, setPrintHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(20)
  const [showRefillModal, setShowRefillModal] = useState(false)
  const [refillPrinter, setRefillPrinter] = useState<MedicalPrinter | null>(null)
  const [refillTray, setRefillTray] = useState<string>('')
  const [refillData, setRefillData] = useState({
    cartridge_quantity: 1,
    plates_per_cartridge: 100,
    batch_number: '',
    supplier: '',
    loaded_by: '',
    notes: ''
  })

  useEffect(() => {
    fetchMedicalPrinters()
  }, [])

  useEffect(() => {
    if (autoRefresh && printers.length > 0) {
      const interval = setInterval(() => {
        refreshAllCounters()
      }, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, printers])

  const fetchMedicalPrinters = async () => {
    try {
      setLoading(true)
      // Obtener todas las impresoras activas
      const response = await fetch(`${API_BASE}/printers/`)
      const allPrinters = await response.json()
      
      // Filtrar solo impresoras médicas (con tecnología DICOM)
      const medicalPrinters = allPrinters.filter((p: MedicalPrinter) => 
        p.print_technology && p.print_technology.toLowerCase() === 'dicom'
      )
      
      setPrinters(medicalPrinters)
      
      // Inicializar estados
      const statusMap = new Map<number, PrinterStatus>()
      medicalPrinters.forEach((printer: MedicalPrinter) => {
        statusMap.set(printer.id, {
          printer,
          loading: false
        })
      })
      setPrinterStatuses(statusMap)
      
      // Cargar contadores automáticamente al cargar la página
      if (medicalPrinters.length > 0) {
        // Esperar un momento para que se renderice la UI
        setTimeout(() => {
          medicalPrinters.forEach((printer: MedicalPrinter) => {
            fetchPrinterCounters(printer.id)
          })
        }, 100)
      }
    } catch (error) {
      console.error('Error fetching medical printers:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshAllCounters = async () => {
    setRefreshing(true)
    try {
      // Actualizar todos los contadores en paralelo
      await Promise.all(printers.map(printer => fetchPrinterCounters(printer.id)))
    } catch (error) {
      console.error('Error refreshing counters:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const fetchPrintHistory = async (printerId: number) => {
    setLoadingHistory(true)
    try {
      // Solicitar TODOS los registros individuales sin agrupar (limit=1000, grouped=false)
      const response = await fetch(`${API_BASE}/medical-printers/${printerId}/print-history?days=365&limit=1000&grouped=false`)
      if (response.ok) {
        const data = await response.json()
        setPrintHistory(data)
      } else {
        setPrintHistory([])
      }
    } catch (error) {
      console.error('Error fetching print history:', error)
      setPrintHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const clearPrintHistory = async (printerId: number) => {
    if (!confirm('¿Está seguro de que desea eliminar todo el historial de impresión de esta impresora? Esta acción no se puede deshacer.')) {
      return
    }

    setLoadingHistory(true)
    try {
      const response = await fetch(`${API_BASE}/medical-printers/${printerId}/history`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        const result = await response.json()
        alert(`Historial limpiado exitosamente. Se eliminaron ${result.deleted_records} registros.`)
        // Recargar el historial (debería estar vacío ahora)
        await fetchPrintHistory(printerId)
      } else {
        const error = await response.json()
        alert(`Error al limpiar historial: ${error.detail}`)
      }
    } catch (error) {
      console.error('Error clearing print history:', error)
      alert('Error al limpiar historial')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRefillSubmit = async () => {
    if (!refillPrinter || !refillTray) return

    try {
      const status = printerStatuses.get(refillPrinter.id)
      const trayData = status?.counters?.trays[refillTray]

      const response = await fetch(`${API_BASE}/medical-printers/refills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printer_id: refillPrinter.id,
          tray_name: refillTray,
          cartridge_quantity: refillData.cartridge_quantity,
          plates_per_cartridge: refillData.plates_per_cartridge,
          counter_before_refill: trayData?.printed || 0,
          available_before_refill: trayData?.available || 0,
          batch_number: refillData.batch_number || null,
          supplier: refillData.supplier || null,
          loaded_by: refillData.loaded_by || null,
          notes: refillData.notes || null
        })
      })

      if (response.ok) {
        // Cerrar modal y refrescar contadores
        setShowRefillModal(false)
        setRefillPrinter(null)
        setRefillTray('')
        setRefillData({
          cartridge_quantity: 1,
          plates_per_cartridge: 100,
          batch_number: '',
          supplier: '',
          loaded_by: '',
          notes: ''
        })
        
        // Refrescar contadores de la impresora
        fetchPrinterCounters(refillPrinter.id)
        
        alert('Recarga registrada exitosamente')
      } else {
        const error = await response.json()
        alert(`Error al registrar recarga: ${error.detail}`)
      }
    } catch (error) {
      console.error('Error registrando recarga:', error)
      alert('Error al registrar recarga')
    }
  }

  const fetchPrinterCounters = async (printerId: number) => {
    setPrinterStatuses(prev => {
      const newMap = new Map(prev)
      const status = newMap.get(printerId)
      if (status) {
        status.loading = true
        newMap.set(printerId, { ...status })
      }
      return newMap
    })

    try {
      // Usar el endpoint específico de impresoras médicas
      const response = await fetch(
        `${API_BASE}/medical-printers/${printerId}/counters`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch counters')
      }

      const result = await response.json()
      
      setPrinterStatuses(prev => {
        const newMap = new Map(prev)
        const status = newMap.get(printerId)
        if (status) {
          status.loading = false
          status.last_update = new Date().toISOString()
          
          if (result.success && result.counters) {
            status.counters = result.counters
            status.error = undefined
          } else {
            status.error = result.error_message || 'Error obteniendo contadores'
            status.counters = undefined
          }
          
          newMap.set(printerId, { ...status })
        }
        return newMap
      })

      // Obtener uptime después de obtener contadores
      await fetchPrinterUptime(printerId, 7)

    } catch (error) {
      console.error(`Error fetching counters for printer ${printerId}:`, error)
      setPrinterStatuses(prev => {
        const newMap = new Map(prev)
        const status = newMap.get(printerId)
        if (status) {
          status.loading = false
          status.error = 'Error de conexión con el servidor'
          newMap.set(printerId, { ...status })
        }
        return newMap
      })
    }
  }

  const fetchPrinterUptime = async (printerId: number, days: number = 7) => {
    try {
      const response = await fetch(
        `${API_BASE}/medical-printers/${printerId}/uptime?days=${days}`
      )
      
      if (!response.ok) {
        console.error(`Failed to fetch uptime for printer ${printerId}`)
        return
      }

      const uptimeData = await response.json()
      
      setPrinterStatuses(prev => {
        const newMap = new Map(prev)
        const status = newMap.get(printerId)
        if (status) {
          status.uptime = uptimeData
          newMap.set(printerId, { ...status })
        }
        return newMap
      })
    } catch (error) {
      console.error(`Error fetching uptime for printer ${printerId}:`, error)
    }
  }

  const formatDateTime = (isoString?: string): string => {
    if (!isoString) return 'N/A'
    const date = new Date(isoString)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      case 'retired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800'
      case 'good': return 'bg-blue-100 text-blue-800'
      case 'fair': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getOwnershipColor = (ownership: string) => {
    switch (ownership) {
      case 'owned': return 'bg-green-100 text-green-800'
      case 'leased': return 'bg-blue-100 text-blue-800'
      case 'rented': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Cargando impresoras médicas...</div>
      </div>
    )
  }

  if (printers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            No hay impresoras médicas registradas
          </h2>
          <p className="text-yellow-700">
            Las impresoras DRYPIX deben estar registradas en el inventario para aparecer aquí.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-2">
      {/* Header con iconos */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Monitoreo de Impresoras Médicas
          </h1>
          <p className="text-gray-600">
            Control y monitoreo en tiempo real de impresoras de placas radiológicas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAllCounters}
            disabled={refreshing}
            className={`p-2 rounded-lg transition-colors ${
              refreshing 
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title="Actualizar todo"
          >
            <svg 
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Configuración"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid de impresoras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {printers.map((printer) => {
          const status = printerStatuses.get(printer.id)
          const counters = status?.counters

          return (
            <div
              key={printer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header minimalista */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">ID: {printer.asset_tag || printer.id}</h3>
                      <button 
                        onClick={() => {
                          setHistoryPrinter(printer)
                          setShowHistoryModal(true)
                          setHistoryPage(1)
                          fetchPrintHistory(printer.id)
                        }}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Ver historial de impresión"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="mb-1">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${counters?.is_online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {counters?.is_online ? 'Up for 7 hours' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <h4 className="text-base font-medium text-gray-800 mb-1">{printer.brand} {printer.model}</h4>
                <p className="text-xs text-gray-500">IP: {printer.ip}</p>
                {printer.location && (
                  <p className="text-xs text-gray-500">{printer.location}</p>
                )}
              </div>

              {/* Contenido */}
              <div className="p-4">
                {status?.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-red-700 text-sm">⚠️ {status.error}</p>
                    <button
                      onClick={() => fetchPrinterCounters(printer.id)}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : counters ? (
                  <>
                    {/* Métricas principales */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Uptime (7 días)</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {status?.uptime 
                            ? `${status.uptime.uptime_percentage}%`
                            : counters.summary.total_available > 0 ? 'Cargando...' : '0%'
                          }
                        </div>
                        {status?.uptime && (
                          <div className="text-xs text-gray-500 mt-1">
                            {status.uptime.online_records}/{status.uptime.total_records} registros
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Impresos</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {counters.summary.total_printed}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Disponibles</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {counters.summary.total_available}
                        </div>
                      </div>
                    </div>

                    {/* Bandejas */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bandejas Activas</div>
                      {Object.entries(counters.trays)
                        .filter(([_, trayData]) => trayData.printed > 0)
                        .map(([trayName, trayData]) => {
                        const percentage = (trayData.available / counters.tray_capacity) * 100
                        return (
                          <div key={trayName} className="border-b border-gray-100 pb-3 last:border-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700">{trayName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {trayData.available}/{counters.tray_capacity}
                                </span>
                                <button
                                  onClick={() => {
                                    setRefillPrinter(printer)
                                    setRefillTray(trayName)
                                    setShowRefillModal(true)
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Cargar cartucho"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mb-2">
                              <span>Impresos: {trayData.printed}</span>
                              <span>{percentage.toFixed(1)}%</span>
                            </div>
                            {/* Barra de progreso */}
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  percentage > 50 ? 'bg-green-500' :
                                  percentage > 20 ? 'bg-yellow-500' :
                                  percentage > 0 ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Última actualización */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 text-center">
                        Última actualización: {formatDateTime(status?.last_update)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-3">No hay datos disponibles</p>
                    <button
                      onClick={() => fetchPrinterCounters(printer.id)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Cargar Contadores
                    </button>
                  </div>
                )}
              </div>

              {/* Footer con acciones */}
              <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-t border-gray-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setViewingPrinter(printer)
                      setActiveTab('basic')
                    }}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Detalles
                  </button>
                  <button
                    onClick={() => {
                      setHistoryPrinter(printer)
                      setShowHistoryModal(true)
                      setHistoryPage(1)
                      fetchPrintHistory(printer.id)
                    }}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                    title="Ver historial de impresión"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Historial
                  </button>
                  <a
                    href={`http://${printer.ip}:20051/USER/Login.htm`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Panel
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de Configuración */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">⚙️ Configuración</h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Actualización automática */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Actualización automática</div>
                      <div className="text-sm text-gray-500">Recargar contadores periódicamente</div>
                    </div>
                  </label>
                </div>

                {/* Intervalo de actualización */}
                {autoRefresh && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Intervalo de actualización
                    </label>
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={10}>10 segundos</option>
                      <option value={30}>30 segundos</option>
                      <option value={60}>1 minuto</option>
                      <option value={120}>2 minutos</option>
                      <option value={300}>5 minutos</option>
                    </select>
                  </div>
                )}

                {/* Información */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">💡 Recomendaciones</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Intervalos cortos (10-30s) para monitoreo activo</li>
                    <li>• Intervalos largos (2-5min) para consumo reducido</li>
                    <li>• Desactiva la actualización automática si no es necesaria</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setShowConfigModal(false)
                    refreshAllCounters()
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Aplicar y Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles Completo */}
      {viewingPrinter && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {viewingPrinter.brand} {viewingPrinter.model}
                </h3>
                <button
                  onClick={() => {
                    setViewingPrinter(null)
                    setActiveTab('basic')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('basic')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'basic'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Información Básica
                  </button>
                  <button
                    onClick={() => setActiveTab('network')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'network'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Red y Configuración
                  </button>
                  <button
                    onClick={() => setActiveTab('technical')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'technical'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Especificaciones
                  </button>
                  <button
                    onClick={() => setActiveTab('location')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'location'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Ubicación
                  </button>
                  <button
                    onClick={() => setActiveTab('ownership')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'ownership'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Propiedad y Fechas
                  </button>
                  <button
                    onClick={() => setActiveTab('supplies')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'supplies'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Insumos
                  </button>
                  <button
                    onClick={() => setActiveTab('toner-history')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'toner-history'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Historial Tóner
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {/* Basic Information Tab */}
                {activeTab === 'basic' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Device Information</h4>
                      <div className="space-y-3">
                        <div><span className="font-medium">Brand:</span> {viewingPrinter.brand}</div>
                        <div><span className="font-medium">Model:</span> {viewingPrinter.model}</div>
                        {viewingPrinter.printer_type && (
                          <div><span className="font-medium">Tipo:</span> {
                            viewingPrinter.printer_type === 'printer' ? 'Solo Impresora' :
                            viewingPrinter.printer_type === 'multifunction' ? 'Multifunción' :
                            viewingPrinter.printer_type === 'scanner' ? 'Solo Scanner' :
                            viewingPrinter.printer_type
                          }</div>
                        )}
                        {viewingPrinter.serial_number && (
                          <div><span className="font-medium">Serial Number:</span> {viewingPrinter.serial_number}</div>
                        )}
                        {viewingPrinter.asset_tag && (
                          <div><span className="font-medium">Asset Tag:</span> {viewingPrinter.asset_tag}</div>
                        )}
                        {viewingPrinter.hostname && (
                          <div><span className="font-medium">Hostname:</span> {viewingPrinter.hostname}</div>
                        )}
                        <div>
                          <span className="font-medium">Type:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800`}>
                            Monochrome
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="font-medium">Status:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewingPrinter.status)}`}>
                            {viewingPrinter.status}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Condition:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConditionColor(viewingPrinter.condition || 'good')}`}>
                            {viewingPrinter.condition || 'N/A'}
                          </span>
                        </div>
                        {viewingPrinter.created_at && (
                          <div><span className="font-medium">Created:</span> {new Date(viewingPrinter.created_at).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Network Tab */}
                {activeTab === 'network' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Network Configuration</h4>
                      <div className="space-y-3">
                        <div><span className="font-medium">IP Address:</span> {viewingPrinter.ip}</div>
                        {viewingPrinter.hostname && (
                          <div><span className="font-medium">Hostname:</span> {viewingPrinter.hostname}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Capabilities</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="font-medium">Network:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            viewingPrinter.network_capable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {viewingPrinter.network_capable ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Wireless:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            viewingPrinter.wireless_capable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {viewingPrinter.wireless_capable ? 'Supported' : 'Not Supported'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Technical Tab */}
                {activeTab === 'technical' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Print Specifications</h4>
                      <div className="space-y-3">
                        {viewingPrinter.print_technology && (
                          <div><span className="font-medium">Technology:</span> {viewingPrinter.print_technology}</div>
                        )}
                        <div>
                          <span className="font-medium">Color Capability:</span> 
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Monochrome Printer
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Location Tab */}
                {activeTab === 'location' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Physical Location</h4>
                      <div className="space-y-3">
                        {viewingPrinter.location && (
                          <div><span className="font-medium">Location:</span> {viewingPrinter.location}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Organizational</h4>
                      <div className="space-y-3">
                        {viewingPrinter.department && (
                          <div><span className="font-medium">Department:</span> {viewingPrinter.department}</div>
                        )}
                        {viewingPrinter.responsible_person && (
                          <div><span className="font-medium">Responsible Person:</span> {viewingPrinter.responsible_person}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ownership Tab */}
                {activeTab === 'ownership' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Ownership Information</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="font-medium">Ownership Type:</span> 
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOwnershipColor(viewingPrinter.ownership_type || 'owned')}`}>
                            {viewingPrinter.ownership_type || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Supplies Tab */}
                {activeTab === 'supplies' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Supplies Information</h4>
                      <div className="space-y-3">
                        <div className="text-gray-500 italic">No supplies information available for medical printers</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toner History Tab */}
                {activeTab === 'toner-history' && (
                  <TonerHistoryTab printerId={viewingPrinter.id} />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setViewingPrinter(null)
                    setActiveTab('basic')
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => window.open(`http://${viewingPrinter.ip}:20051/USER/Login.htm`, '_blank')}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Abrir Panel Web
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Impresión */}
      {showHistoryModal && historyPrinter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Historial de Impresión - {historyPrinter.brand} {historyPrinter.model}
                  </h2>
                  <p className="text-blue-100 text-sm">Asset Tag: {historyPrinter.asset_tag || historyPrinter.id}</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-white hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Cargando historial...</span>
                </div>
              ) : printHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-blue-900">📊 Resumen de Actividad</h3>
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
                        {printHistory.length} registro{printHistory.length !== 1 ? 's' : ''} encontrado{printHistory.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Período:</span>
                        <span className="ml-2 font-semibold text-blue-900">
                          {printHistory.length > 1 
                            ? `${printHistory.length} días` 
                            : 'Hoy'}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Total impreso:</span>
                        <span className="ml-2 font-semibold text-blue-900">
                          {printHistory.reduce((sum, day) => sum + day.total_printed, 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-700">Promedio diario:</span>
                        <span className="ml-2 font-semibold text-blue-900">
                          {Math.round(printHistory.reduce((sum, day) => sum + day.total_printed, 0) / printHistory.length).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mensaje informativo si solo hay datos actuales */}
                  {printHistory.length === 1 && (
                    <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-blue-700">
                            <span className="font-medium">Mostrando solo datos de hoy.</span> El sistema guarda snapshots diarios automáticamente a las 7:00 AM. El historial completo estará disponible después de algunos días.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {printHistory.length > 30 && (
                    <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Historial completo cargado.</span> Se están mostrando todos los {printHistory.length} registros históricos disponibles.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Paginación */}
                  {printHistory.length > 0 && (
                    <div className="mb-4 flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Mostrar:</span>
                        <select
                          value={historyItemsPerPage}
                          onChange={(e) => {
                            setHistoryItemsPerPage(Number(e.target.value))
                            setHistoryPage(1)
                          }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                          title="Registros por página"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-gray-700">registros por página</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: <span className="font-semibold">{printHistory.length}</span> registros
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha y Hora
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Impreso
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Disponibles
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bandejas Activas
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {printHistory
                          .slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage)
                          .map((record, index) => {
                          const date = new Date(record.timestamp)
                          const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' })
                          const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          const hasCartridgeChange = record.cartridge_change_detected === true
                          
                          return (
                            <tr key={record.id || index} className={`hover:bg-gray-50 ${hasCartridgeChange ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    {hasCartridgeChange && (
                                      <span className="text-yellow-600" title="Cambio de cartucho detectado">
                                        🔄
                                      </span>
                                    )}
                                    <span>{dateStr}</span>
                                    <span className="text-xs text-gray-500 capitalize">({dayName})</span>
                                  </div>
                                  <span className="text-xs text-gray-500 mt-1">{timeStr}</span>
                                  {hasCartridgeChange && (
                                    <span className="text-xs font-semibold text-yellow-700 mt-1">
                                      Se cambió cartucho
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                                  {record.total_printed}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                  hasCartridgeChange ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-500' : 'bg-green-100 text-green-800'
                                }`}>
                                  {record.total_available}
                                  {hasCartridgeChange && ' ⬆'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                                {record.total_trays_loaded}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  record.is_online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {record.is_online ? '● Online' : '● Offline'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Controles de paginación */}
                  {printHistory.length > historyItemsPerPage && (
                    <div className="mt-4 flex justify-center items-center gap-2">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-gray-600">
                        Página {historyPage} de {Math.ceil(printHistory.length / historyItemsPerPage)}
                      </span>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(Math.ceil(printHistory.length / historyItemsPerPage), p + 1))}
                        disabled={historyPage >= Math.ceil(printHistory.length / historyItemsPerPage)}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Siguiente
                      </button>
                    </div>
                  )}

                  {/* Gráfico simple de barras */}
                  <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Actividad de Impresión (Últimos días)</h4>
                    <div className="space-y-2">
                      {printHistory.slice(0, 10).map((day, index) => {
                        const date = new Date(day.timestamp)
                        const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                        const maxPrinted = Math.max(...printHistory.map(d => d.total_printed))
                        const percentage = maxPrinted > 0 ? (day.total_printed / maxPrinted) * 100 : 0
                        
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-16">{dateStr}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full flex items-center justify-end pr-2 transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              >
                                {day.total_printed > 0 && (
                                  <span className="text-xs font-semibold text-white">{day.total_printed}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay historial disponible</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No se encontraron registros de impresión para esta impresora.
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => historyPrinter && clearPrintHistory(historyPrinter.id)}
                  disabled={loadingHistory || printHistory.length === 0}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  Limpiar Historial
                </button>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recarga de Cartucho */}
      {showRefillModal && refillPrinter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Cargar Cartucho</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {refillPrinter.brand} {refillPrinter.model} - {refillTray}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRefillModal(false)
                    setRefillPrinter(null)
                    setRefillTray('')
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Cantidad de cartuchos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad de cartuchos
                </label>
                <input
                  type="number"
                  min="1"
                  value={refillData.cartridge_quantity}
                  onChange={(e) => setRefillData({...refillData, cartridge_quantity: parseInt(e.target.value) || 1})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Placas por cartucho */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placas por cartucho
                </label>
                <input
                  type="number"
                  min="1"
                  value={refillData.plates_per_cartridge}
                  onChange={(e) => setRefillData({...refillData, plates_per_cartridge: parseInt(e.target.value) || 100})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">Total de placas:</span>
                  <span className="text-xl font-bold text-blue-700">
                    {refillData.cartridge_quantity * refillData.plates_per_cartridge}
                  </span>
                </div>
              </div>

              {/* Número de lote */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de lote (opcional)
                </label>
                <input
                  type="text"
                  value={refillData.batch_number}
                  onChange={(e) => setRefillData({...refillData, batch_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: LOT-2025-001"
                />
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor (opcional)
                </label>
                <input
                  type="text"
                  value={refillData.supplier}
                  onChange={(e) => setRefillData({...refillData, supplier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: FUJIFILM"
                />
              </div>

              {/* Cargado por */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargado por (opcional)
                </label>
                <input
                  type="text"
                  value={refillData.loaded_by}
                  onChange={(e) => setRefillData({...refillData, loaded_by: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del técnico"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={refillData.notes}
                  onChange={(e) => setRefillData({...refillData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowRefillModal(false)
                  setRefillPrinter(null)
                  setRefillTray('')
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRefillSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Registrar Recarga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
