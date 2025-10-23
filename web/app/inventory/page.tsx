'use client'

import { useState, useEffect } from 'react'
import { Printer, InventoryStats } from '../../types/printer'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface TonerRequest {
  id: number
  printer_id: number
  request_date: string
  status: string
  priority: string
  toner_black_requested: boolean
  toner_black_quantity: number
  toner_cyan_requested: boolean
  toner_cyan_quantity: number
  toner_magenta_requested: boolean
  toner_magenta_quantity: number
  toner_yellow_requested: boolean
  toner_yellow_quantity: number
  toner_black_code?: string
  toner_cyan_code?: string
  toner_magenta_code?: string
  toner_yellow_code?: string
  other_supplies_requested?: string
  justification?: string
  notes?: string
  requested_by: string
  department?: string
  cost_center?: string
  approved_date?: string
  ordered_date?: string
  delivered_date?: string
  cancelled_date?: string
  approved_by?: string
  rejection_reason?: string
  created_at: string
  updated_at?: string
}

// Componente para mostrar historial de pedidos de tóner
function TonerHistoryTab({ printerId }: { printerId: number }) {
  const [tonerHistory, setTonerHistory] = useState<TonerRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTonerHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/printers/${printerId}/toner-history`)
        if (response.ok) {
          const history = await response.json()
          setTonerHistory(history)
        }
      } catch (error) {
        console.error('Error fetching toner history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTonerHistory()
  }, [printerId])

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'ordered': 'bg-blue-100 text-blue-800',
      'delivered': 'bg-purple-100 text-purple-800',
      'cancelled': 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      'low': 'bg-green-100 text-green-800',
      'normal': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    }
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatTonerRequested = (request: TonerRequest) => {
    const toners = []
    if (request.toner_black_requested) {
      const qty = request.toner_black_quantity || 1
      toners.push(`Negro x${qty} (${request.toner_black_code || 'N/A'})`)
    }
    if (request.toner_cyan_requested) {
      const qty = request.toner_cyan_quantity || 1
      toners.push(`Cian x${qty} (${request.toner_cyan_code || 'N/A'})`)
    }
    if (request.toner_magenta_requested) {
      const qty = request.toner_magenta_quantity || 1
      toners.push(`Magenta x${qty} (${request.toner_magenta_code || 'N/A'})`)
    }
    if (request.toner_yellow_requested) {
      const qty = request.toner_yellow_quantity || 1
      toners.push(`Amarillo x${qty} (${request.toner_yellow_code || 'N/A'})`)
    }
    
    return toners.length > 0 ? toners.join(', ') : 'Ninguno'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Cargando historial de pedidos...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-semibold text-gray-900">Historial de Pedidos de Insumos</h4>
        <a
          href="/supply-requests"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          Nuevo Pedido
        </a>
      </div>

      {tonerHistory.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">Sin pedidos de tóner</div>
          <p className="text-gray-500">No hay pedidos registrados para este equipo</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {tonerHistory.map((request) => (
            <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    Pedido #{request.id} - {new Date(request.request_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Solicitado por:</strong> {request.requested_by}
                    {request.department && <span> - {request.department}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {request.status.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                    {request.priority.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <strong>Tóners solicitados:</strong> {formatTonerRequested(request)}
                </div>

                {request.other_supplies_requested && (
                  <div>
                    <strong>Otros insumos:</strong> {request.other_supplies_requested}
                  </div>
                )}

                {request.justification && (
                  <div>
                    <strong>Justificación:</strong> {request.justification}
                  </div>
                )}

                {request.notes && (
                  <div>
                    <strong>Notas:</strong> {request.notes}
                  </div>
                )}

                {/* Fechas de seguimiento */}
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  {request.approved_date && (
                    <div><strong>Aprobado:</strong> {new Date(request.approved_date).toLocaleString()}</div>
                  )}
                  {request.ordered_date && (
                    <div><strong>Ordenado:</strong> {new Date(request.ordered_date).toLocaleString()}</div>
                  )}
                  {request.delivered_date && (
                    <div><strong>Entregado:</strong> {new Date(request.delivered_date).toLocaleString()}</div>
                  )}
                  {request.cancelled_date && (
                    <div><strong>Cancelado:</strong> {new Date(request.cancelled_date).toLocaleString()}</div>
                  )}
                </div>

                {request.approved_by && (
                  <div className="text-xs text-gray-500">
                    <strong>Aprobado por:</strong> {request.approved_by}
                  </div>
                )}

                {request.rejection_reason && (
                  <div className="text-xs text-red-600">
                    <strong>Razón de rechazo:</strong> {request.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Inventory() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('all')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [stats, setStats] = useState<any>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [editActiveTab, setEditActiveTab] = useState('basic')
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null)
  const [editForm, setEditForm] = useState<Partial<Printer>>({})
  const [addForm, setAddForm] = useState<Partial<Printer>>({
    brand: '',
    model: '',
    ip: '',
    hostname: '',
    snmp_profile: 'generic_v2c',
    is_color: false,
    printer_type: 'printer',
    duplex_capable: false,
    network_capable: true,
    wireless_capable: false,
    ownership_type: 'owned',
    status: 'active',
    condition: 'good',
    toner_black_code: '',
    toner_cyan_code: '',
    toner_magenta_code: '',
    toner_yellow_code: '',
    other_supplies: ''
  })
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch printers
      const printersResponse = await fetch(`${API_BASE}/printers`)
      const printersData = await printersResponse.json()
      setPrinters(printersData)

      // Fetch inventory stats
      const statsResponse = await fetch(`${API_BASE}/printers/inventory/stats`)
      const statsData = await statsResponse.json()
      setStats(statsData)

      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  const searchPrinters = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('query', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (conditionFilter !== 'all') params.append('condition', conditionFilter)
      if (ownershipFilter !== 'all') params.append('ownership_type', ownershipFilter)

      const response = await fetch(`${API_BASE}/printers/inventory/search?${params}`)
      const data = await response.json()
      setPrinters(data)
    } catch (error) {
      console.error('Error searching printers:', error)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm || statusFilter !== 'all' || conditionFilter !== 'all' || ownershipFilter !== 'all') {
        searchPrinters()
      } else {
        fetchData()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, conditionFilter, ownershipFilter])

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
      case 'owned': return 'bg-blue-100 text-blue-800'
      case 'leased': return 'bg-green-100 text-green-800'
      case 'rented': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const startEdit = (printer: Printer) => {
    setEditingPrinter(printer)
    setEditForm({ ...printer })
    setSelectedPrinter(null)
  }

  const handleEditSubmit = async (e: any) => {
    e.preventDefault()
    if (!editingPrinter) return

    try {
      const response = await fetch(`${API_BASE}/printers/${editingPrinter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        // Refresh the data
        fetchData()
        setEditingPrinter(null)
        setEditForm({})
        alert('Printer updated successfully!')
      } else {
        alert('Error updating printer')
      }
    } catch (error) {
      console.error('Error updating printer:', error)
      alert('Error updating printer')
    }
  }

  const handleEditCancel = () => {
    setEditingPrinter(null)
    setEditForm({})
    setEditActiveTab('basic')
  }

  const handleDelete = async (printerId: number, printerName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la impresora ${printerName}? Esta acción no se puede deshacer y eliminará también todos los registros relacionados (contadores mensuales, reportes de uso, etc.).`)) {
      return
    }

    try {
      const url = `${API_BASE}/printers/${printerId}`
      console.log('Attempting to delete printer at URL:', url)
      
      const response = await fetch(url, {
        method: 'DELETE',
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (response.ok) {
        const result = await response.json()
        console.log('Delete result:', result)
        
        // Refresh the data
        fetchData()
        setSelectedPrinter(null)
        
        // Show detailed success message
        let message = 'Impresora eliminada exitosamente!'
        if (result.deleted_monthly_counters > 0 || result.deleted_usage_reports > 0) {
          message += `\n\nSe eliminaron también:`
          if (result.deleted_monthly_counters > 0) {
            message += `\n- ${result.deleted_monthly_counters} registros de contadores mensuales`
          }
          if (result.deleted_usage_reports > 0) {
            message += `\n- ${result.deleted_usage_reports} reportes de uso`
          }
        }
        
        alert(message)
      } else {
        const responseText = await response.text()
        console.error('Delete failed. Response text:', responseText)
        try {
          const errorData = JSON.parse(responseText)
          alert(`Error al eliminar la impresora: ${errorData.detail || 'Error desconocido'}`)
        } catch (parseError) {
          alert(`Error al eliminar la impresora: ${response.status} - ${responseText}`)
        }
      }
    } catch (error: any) {
      console.error('Error deleting printer:', error)
      alert(`Error al eliminar la impresora: ${error.message || 'Error de conexión'}`)
    }
  }

  const handleAddSubmit = async (e: any) => {
    e.preventDefault()

    try {
      const response = await fetch(`${API_BASE}/printers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addForm),
      })

      if (response.ok) {
        // Refresh the data
        fetchData()
        setShowAddForm(false)
        setAddForm({
          brand: '',
          model: '',
          ip: '',
          hostname: '',
          snmp_profile: 'generic_v2c',
          is_color: false,
          printer_type: 'printer',
          duplex_capable: false,
          network_capable: true,
          wireless_capable: false,
          ownership_type: 'owned',
          status: 'active',
          condition: 'good',
          toner_black_code: '',
          toner_cyan_code: '',
          toner_magenta_code: '',
          toner_yellow_code: '',
          other_supplies: ''
        })
        alert('Impresora agregada exitosamente!')
      } else {
        const errorData = await response.json()
        alert(`Error al agregar la impresora: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error adding printer:', error)
      alert('Error al agregar la impresora: Error de conexión')
    }
  }

  const handleAddCancel = () => {
    setShowAddForm(false)
    setActiveTab('basic')
    setAddForm({
      brand: '',
      model: '',
      ip: '',
      hostname: '',
      snmp_profile: 'generic_v2c',
      is_color: false,
      printer_type: 'printer',
      duplex_capable: false,
      network_capable: true,
      wireless_capable: false,
      ownership_type: 'owned',
      status: 'active',
      condition: 'good'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Printer Inventory</h1>
          <p className="mt-2 text-gray-600">Complete inventory management system</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="stat-label">Total Printers</dt>
                    <dd className="stat-value">{stats.total_printers}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {stats.status_distribution.find((s: any) => s.status === 'active')?.count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.status_distribution.find((s: any) => s.status === 'active')?.count || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {stats.ownership_distribution.find((o: any) => o.type === 'leased')?.count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Leased</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.ownership_distribution.find((o: any) => o.type === 'leased')?.count || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{stats.warranties_expiring_soon}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Warranties Expiring</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.warranties_expiring_soon}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by brand, model, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Conditions</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ownership</label>
              <select
                value={ownershipFilter}
                onChange={(e) => setOwnershipFilter(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="rented">Rented</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setShowAddForm(true)
                  setActiveTab('basic')
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Agregar Impresora
              </button>
            </div>
          </div>
        </div>

        {/* Printers Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Printer Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ownership
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warranty
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {printers.map((printer) => (
                <tr key={printer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {printer.brand} {printer.model}
                      </div>
                      <div className="text-sm text-gray-500">
                        {printer.serial_number && `S/N: ${printer.serial_number}`}
                        {printer.asset_tag && ` • Asset: ${printer.asset_tag}`}
                        {printer.printer_type && ` • ${
                          printer.printer_type === 'printer' ? 'Impresora' :
                          printer.printer_type === 'multifunction' ? 'Multifunción' :
                          printer.printer_type === 'scanner' ? 'Scanner' : printer.printer_type
                        }`}
                      </div>
                      <div className="text-sm text-gray-500">IP: {printer.ip}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{printer.location || 'N/A'}</div>
                    <div className="text-sm text-gray-500">
                      {printer.department && `Dept: ${printer.department}`}
                      {printer.floor && ` • Floor: ${printer.floor}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(printer.status)}`}>
                        {printer.status}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConditionColor(printer.condition)}`}>
                        {printer.condition}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOwnershipColor(printer.ownership_type)}`}>
                      {printer.ownership_type}
                    </span>
                    {printer.supplier && (
                      <div className="text-xs text-gray-500 mt-1">
                        Supplier: {printer.supplier}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {printer.warranty_expiry ? (
                      <div>
                        <div>{new Date(printer.warranty_expiry).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(printer.warranty_expiry) < new Date() ? 'Expired' : 'Active'}
                        </div>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setSelectedPrinter(printer)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        title="Ver detalles"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => startEdit(printer)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(printer.id, `${printer.brand} ${printer.model}`)
                        }}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {printers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No printers found</div>
            <p className="text-gray-500 mt-2">Adjust your search criteria or add a new printer</p>
          </div>
        )}

        {/* Printer Details Modal */}
        {selectedPrinter && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedPrinter.brand} {selectedPrinter.model}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedPrinter(null)
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
                          <div><span className="font-medium">Brand:</span> {selectedPrinter.brand}</div>
                          <div><span className="font-medium">Model:</span> {selectedPrinter.model}</div>
                          {selectedPrinter.printer_type && (
                            <div><span className="font-medium">Tipo:</span> {
                              selectedPrinter.printer_type === 'printer' ? 'Solo Impresora' :
                              selectedPrinter.printer_type === 'multifunction' ? 'Multifunción' :
                              selectedPrinter.printer_type === 'scanner' ? 'Solo Scanner' :
                              selectedPrinter.printer_type
                            }</div>
                          )}
                          {selectedPrinter.serial_number && (
                            <div><span className="font-medium">Serial Number:</span> {selectedPrinter.serial_number}</div>
                          )}
                          {selectedPrinter.asset_tag && (
                            <div><span className="font-medium">Asset Tag:</span> {selectedPrinter.asset_tag}</div>
                          )}
                          {selectedPrinter.hostname && (
                            <div><span className="font-medium">Hostname (Nombre de Equipo):</span> {selectedPrinter.hostname}</div>
                          )}
                          <div>
                            <span className="font-medium">Type:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedPrinter.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedPrinter.is_color ? 'Color' : 'Monochrome'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium">Status:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedPrinter.status)}`}>
                              {selectedPrinter.status}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Condition:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConditionColor(selectedPrinter.condition)}`}>
                              {selectedPrinter.condition}
                            </span>
                          </div>
                          <div><span className="font-medium">Created:</span> {new Date(selectedPrinter.created_at).toLocaleString()}</div>
                          {selectedPrinter.updated_at && (
                            <div><span className="font-medium">Last Updated:</span> {new Date(selectedPrinter.updated_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                      
                      {selectedPrinter.notes && (
                        <div className="md:col-span-2 bg-yellow-50 p-6 rounded-lg">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">Notes</h4>
                          <p className="text-gray-700">{selectedPrinter.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Network Tab */}
                  {activeTab === 'network' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Network Configuration</h4>
                        <div className="space-y-3">
                          <div><span className="font-medium">IP Address:</span> {selectedPrinter.ip}</div>
                          {selectedPrinter.mac_address && (
                            <div><span className="font-medium">MAC Address:</span> {selectedPrinter.mac_address}</div>
                          )}
                          {selectedPrinter.hostname && (
                            <div><span className="font-medium">Hostname:</span> {selectedPrinter.hostname}</div>
                          )}
                          <div><span className="font-medium">SNMP Profile:</span> {selectedPrinter.snmp_profile}</div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Capabilities</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium">Network:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedPrinter.network_capable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedPrinter.network_capable ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Wireless:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedPrinter.wireless_capable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedPrinter.wireless_capable ? 'Supported' : 'Not Supported'}
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
                          {selectedPrinter.print_technology && (
                            <div><span className="font-medium">Technology:</span> {selectedPrinter.print_technology}</div>
                          )}
                          {selectedPrinter.max_paper_size && (
                            <div><span className="font-medium">Max Paper Size:</span> {selectedPrinter.max_paper_size}</div>
                          )}
                          <div>
                            <span className="font-medium">Duplex:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedPrinter.duplex_capable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedPrinter.duplex_capable ? 'Supported' : 'Not Supported'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Print Type</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium">Color Capability:</span> 
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              selectedPrinter.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedPrinter.is_color ? 'Color Printer' : 'Monochrome Printer'}
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
                          {selectedPrinter.location && (
                            <div><span className="font-medium">Location:</span> {selectedPrinter.location}</div>
                          )}
                          {selectedPrinter.building && (
                            <div><span className="font-medium">Building:</span> {selectedPrinter.building}</div>
                          )}
                          {selectedPrinter.floor && (
                            <div><span className="font-medium">Floor:</span> {selectedPrinter.floor}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Organizational</h4>
                        <div className="space-y-3">
                          {selectedPrinter.department && (
                            <div><span className="font-medium">Department:</span> {selectedPrinter.department}</div>
                          )}
                          {selectedPrinter.sector && (
                            <div><span className="font-medium">Sector:</span> {selectedPrinter.sector}</div>
                          )}
                          {selectedPrinter.responsible_person && (
                            <div><span className="font-medium">Responsible Person:</span> {selectedPrinter.responsible_person}</div>
                          )}
                          {selectedPrinter.cost_center && (
                            <div><span className="font-medium">Cost Center:</span> {selectedPrinter.cost_center}</div>
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
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOwnershipColor(selectedPrinter.ownership_type)}`}>
                              {selectedPrinter.ownership_type}
                            </span>
                          </div>
                          {selectedPrinter.supplier && (
                            <div><span className="font-medium">Supplier:</span> {selectedPrinter.supplier}</div>
                          )}
                          {selectedPrinter.lease_contract && (
                            <div><span className="font-medium">Lease Contract:</span> {selectedPrinter.lease_contract}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Important Dates</h4>
                        <div className="space-y-3">
                          {selectedPrinter.purchase_date && (
                            <div><span className="font-medium">Purchase Date:</span> {new Date(selectedPrinter.purchase_date).toLocaleDateString()}</div>
                          )}
                          {selectedPrinter.installation_date && (
                            <div><span className="font-medium">Installation Date:</span> {new Date(selectedPrinter.installation_date).toLocaleDateString()}</div>
                          )}
                          {selectedPrinter.warranty_expiry && (
                            <div>
                              <span className="font-medium">Warranty Expires:</span> {new Date(selectedPrinter.warranty_expiry).toLocaleDateString()}
                              <span className={`ml-2 text-xs font-medium ${new Date(selectedPrinter.warranty_expiry) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                ({new Date(selectedPrinter.warranty_expiry) < new Date() ? 'EXPIRED' : 'ACTIVE'})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supplies Tab */}
                  {activeTab === 'supplies' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Toner Cartridges</h4>
                        <div className="space-y-3">
                          {selectedPrinter.toner_black_code && (
                            <div>
                              <span className="font-medium">Black Toner:</span> 
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {selectedPrinter.toner_black_code}
                              </span>
                            </div>
                          )}
                          {selectedPrinter.toner_cyan_code && (
                            <div>
                              <span className="font-medium">Cyan Toner:</span> 
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                                {selectedPrinter.toner_cyan_code}
                              </span>
                            </div>
                          )}
                          {selectedPrinter.toner_magenta_code && (
                            <div>
                              <span className="font-medium">Magenta Toner:</span> 
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                                {selectedPrinter.toner_magenta_code}
                              </span>
                            </div>
                          )}
                          {selectedPrinter.toner_yellow_code && (
                            <div>
                              <span className="font-medium">Yellow Toner:</span> 
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {selectedPrinter.toner_yellow_code}
                              </span>
                            </div>
                          )}
                          {!selectedPrinter.toner_black_code && !selectedPrinter.toner_cyan_code && 
                           !selectedPrinter.toner_magenta_code && !selectedPrinter.toner_yellow_code && (
                            <div className="text-gray-500 italic">No toner codes registered</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Other Supplies</h4>
                        <div className="space-y-3">
                          {selectedPrinter.other_supplies ? (
                            <div className="bg-white p-3 rounded border">
                              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                {selectedPrinter.other_supplies}
                              </pre>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">No other supplies registered</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Toner History Tab */}
                  {activeTab === 'toner-history' && (
                    <TonerHistoryTab printerId={selectedPrinter.id} />
                  )}

                  {/* Administrative Tab */}
                  {activeTab === 'admin' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Administrative Information</h4>
                        <div className="space-y-3">
                          {selectedPrinter.responsible_person && (
                            <div><span className="font-medium">Responsible Person:</span> {selectedPrinter.responsible_person}</div>
                          )}
                          {selectedPrinter.cost_center && (
                            <div><span className="font-medium">Cost Center:</span> {selectedPrinter.cost_center}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">System Information</h4>
                        <div className="space-y-3">
                          <div><span className="font-medium">Record Created:</span> {new Date(selectedPrinter.created_at).toLocaleString()}</div>
                          {selectedPrinter.updated_at && (
                            <div><span className="font-medium">Last Modified:</span> {new Date(selectedPrinter.updated_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedPrinter(null)
                      setActiveTab('basic')
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => startEdit(selectedPrinter)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit Printer
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedPrinter.id, `${selectedPrinter.brand} ${selectedPrinter.model}`)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Delete Printer
                  </button>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                    Poll Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Printer Modal */}
        {editingPrinter && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Editar Impresora: {editingPrinter.brand} {editingPrinter.model}
                  </h3>
                  <button
                    onClick={handleEditCancel}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setEditActiveTab('basic')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'basic'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Información Básica
                    </button>
                    <button
                      onClick={() => setEditActiveTab('network')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'network'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Red y Configuración
                    </button>
                    <button
                      onClick={() => setEditActiveTab('technical')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'technical'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Especificaciones
                    </button>
                    <button
                      onClick={() => setEditActiveTab('location')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'location'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Ubicación
                    </button>
                    <button
                      onClick={() => setEditActiveTab('ownership')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'ownership'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Propiedad y Fechas
                    </button>
                    <button
                      onClick={() => setEditActiveTab('supplies')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        editActiveTab === 'supplies'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Insumos
                    </button>
                  </nav>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-6">
                  <div className="min-h-[400px]">
                    {/* Tab Content */}
                    {editActiveTab === 'basic' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Marca *</label>
                          <input
                            type="text"
                            value={editForm.brand || ''}
                            onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Modelo *</label>
                          <input
                            type="text"
                            value={editForm.model || ''}
                            onChange={(e) => setEditForm({...editForm, model: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Número de Serie</label>
                          <input
                            type="text"
                            value={editForm.serial_number || ''}
                            onChange={(e) => setEditForm({...editForm, serial_number: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Código de Inventario *</label>
                          <input
                            type="text"
                            value={editForm.asset_tag || ''}
                            onChange={(e) => setEditForm({...editForm, asset_tag: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Impresora</label>
                          <select
                            value={editForm.printer_type || 'printer'}
                            onChange={(e) => setEditForm({...editForm, printer_type: e.target.value as 'printer' | 'multifunction' | 'scanner'})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="printer">Solo Impresora</option>
                            <option value="multifunction">Multifunción</option>
                            <option value="scanner">Solo Scanner</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                          <select
                            value={editForm.status || 'active'}
                            onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                            <option value="maintenance">En Mantenimiento</option>
                            <option value="retired">Retirado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Condición</label>
                          <select
                            value={editForm.condition || 'good'}
                            onChange={(e) => setEditForm({...editForm, condition: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="excellent">Excelente</option>
                            <option value="good">Bueno</option>
                            <option value="fair">Regular</option>
                            <option value="poor">Malo</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
                          <textarea
                            value={editForm.notes || ''}
                            onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            placeholder="Notas adicionales sobre la impresora"
                          />
                        </div>
                      </div>
                    )}

                    {editActiveTab === 'network' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Dirección IP *</label>
                          <input
                            type="text"
                            value={editForm.ip || ''}
                            onChange={(e) => setEditForm({...editForm, ip: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="192.168.1.100"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de Equipo</label>
                          <input
                            type="text"
                            value={editForm.hostname || ''}
                            onChange={(e) => setEditForm({...editForm, hostname: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre del equipo en la red"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Dirección MAC</label>
                          <input
                            type="text"
                            value={editForm.mac_address || ''}
                            onChange={(e) => setEditForm({...editForm, mac_address: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="AA:BB:CC:DD:EE:FF"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Perfil SNMP</label>
                          <select
                            value={editForm.snmp_profile || 'generic_v2c'}
                            onChange={(e) => setEditForm({...editForm, snmp_profile: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="generic_v2c">Generic v2c</option>
                            <option value="hp">HP</option>
                            <option value="oki">OKI</option>
                            <option value="brother">Brother</option>
                            <option value="canon">Canon</option>
                            <option value="epson">Epson</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editForm.network_capable || false}
                                onChange={(e) => setEditForm({...editForm, network_capable: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Capacidad de Red</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editForm.wireless_capable || false}
                                onChange={(e) => setEditForm({...editForm, wireless_capable: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">WiFi</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {editActiveTab === 'technical' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tecnología de Impresión</label>
                          <select
                            value={editForm.print_technology || ''}
                            onChange={(e) => setEditForm({...editForm, print_technology: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Seleccionar Tecnología</option>
                            <option value="laser">Láser</option>
                            <option value="inkjet">Inyección de Tinta</option>
                            <option value="dot_matrix">Matriz de Puntos</option>
                            <option value="thermal">Térmica</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tamaño Máximo de Papel</label>
                          <select
                            value={editForm.max_paper_size || ''}
                            onChange={(e) => setEditForm({...editForm, max_paper_size: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Seleccionar Tamaño</option>
                            <option value="A4">A4</option>
                            <option value="A3">A3</option>
                            <option value="Letter">Carta</option>
                            <option value="Legal">Legal</option>
                            <option value="Tabloid">Tabloide</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editForm.is_color || false}
                                onChange={(e) => setEditForm({...editForm, is_color: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Impresión a Color</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={editForm.duplex_capable || false}
                                onChange={(e) => setEditForm({...editForm, duplex_capable: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700">Impresión Dúplex</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {editActiveTab === 'location' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                          <input
                            type="text"
                            value={editForm.sector || ''}
                            onChange={(e) => setEditForm({...editForm, sector: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: Administración, Producción"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                          <input
                            type="text"
                            value={editForm.location || ''}
                            onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ubicación específica"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Edificio</label>
                          <input
                            type="text"
                            value={editForm.building || ''}
                            onChange={(e) => setEditForm({...editForm, building: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre del edificio"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Piso</label>
                          <input
                            type="text"
                            value={editForm.floor || ''}
                            onChange={(e) => setEditForm({...editForm, floor: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Número de piso"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                          <input
                            type="text"
                            value={editForm.department || ''}
                            onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Departamento o área"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Persona Responsable</label>
                          <input
                            type="text"
                            value={editForm.responsible_person || ''}
                            onChange={(e) => setEditForm({...editForm, responsible_person: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre del responsable"
                          />
                        </div>
                      </div>
                    )}

                    {editActiveTab === 'ownership' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Propiedad</label>
                          <select
                            value={editForm.ownership_type || 'owned'}
                            onChange={(e) => setEditForm({...editForm, ownership_type: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="owned">Propio</option>
                            <option value="leased">Arrendado</option>
                            <option value="rented">Alquilado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor</label>
                          <input
                            type="text"
                            value={editForm.supplier || ''}
                            onChange={(e) => setEditForm({...editForm, supplier: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre del proveedor"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Compra</label>
                          <input
                            type="date"
                            value={editForm.purchase_date ? new Date(editForm.purchase_date).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditForm({...editForm, purchase_date: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Instalación</label>
                          <input
                            type="date"
                            value={editForm.installation_date ? new Date(editForm.installation_date).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditForm({...editForm, installation_date: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Expiración de Garantía</label>
                          <input
                            type="date"
                            value={editForm.warranty_expiry ? new Date(editForm.warranty_expiry).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditForm({...editForm, warranty_expiry: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Contrato de Arrendamiento</label>
                          <input
                            type="text"
                            value={editForm.lease_contract || ''}
                            onChange={(e) => setEditForm({...editForm, lease_contract: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Número de contrato"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costo</label>
                          <input
                            type="text"
                            value={editForm.cost_center || ''}
                            onChange={(e) => setEditForm({...editForm, cost_center: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Centro de costo"
                          />
                        </div>
                      </div>
                    )}

                    {editActiveTab === 'supplies' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Información sobre el tipo de impresora */}
                        <div className="md:col-span-2 mb-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-medium text-blue-800">
                                {editForm.is_color 
                                  ? 'Impresora a color - Se muestran todos los tóners' 
                                  : 'Impresora monocromática - Solo se muestra tóner negro'
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tóner Negro - Siempre visible */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Código Tóner Negro</label>
                          <input
                            type="text"
                            value={editForm.toner_black_code || ''}
                            onChange={(e) => setEditForm({...editForm, toner_black_code: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ej: HP-12A"
                          />
                        </div>

                        {/* Tóners de color - Solo si es_color está marcado */}
                        {editForm.is_color && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Código Tóner Cian</label>
                              <input
                                type="text"
                                value={editForm.toner_cyan_code || ''}
                                onChange={(e) => setEditForm({...editForm, toner_cyan_code: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: HP-410A-C"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Código Tóner Magenta</label>
                              <input
                                type="text"
                                value={editForm.toner_magenta_code || ''}
                                onChange={(e) => setEditForm({...editForm, toner_magenta_code: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: HP-410A-M"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Código Tóner Amarillo</label>
                              <input
                                type="text"
                                value={editForm.toner_yellow_code || ''}
                                onChange={(e) => setEditForm({...editForm, toner_yellow_code: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: HP-410A-Y"
                              />
                            </div>
                          </>
                        )}

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Otros Insumos</label>
                          <textarea
                            value={editForm.other_supplies || ''}
                            onChange={(e) => setEditForm({...editForm, other_supplies: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={4}
                            placeholder="Tambores, fusores, unidades de imagen, etc."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleEditCancel}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add Printer Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Agregar Nueva Impresora</h3>
                  <button
                    onClick={handleAddCancel}
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
                  </nav>
                </div>
                
                <form onSubmit={handleAddSubmit} className="space-y-6">
                  {/* Tab Content */}
                  <div className="min-h-[450px]">
                    {/* Información Básica Tab */}
                    {activeTab === 'basic' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
                          <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Información del Dispositivo
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Marca *</label>
                              <input
                                type="text"
                                required
                                value={addForm.brand || ''}
                                onChange={(e) => setAddForm({...addForm, brand: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="HP, Canon, Brother..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Modelo *</label>
                              <input
                                type="text"
                                required
                                value={addForm.model || ''}
                                onChange={(e) => setAddForm({...addForm, model: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="LaserJet Pro 400, imageRUNNER..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Impresora *</label>
                              <select
                                required
                                value={addForm.printer_type || 'printer'}
                                onChange={(e) => setAddForm({...addForm, printer_type: e.target.value as 'printer' | 'multifunction' | 'scanner'})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="printer">Solo Impresora</option>
                                <option value="multifunction">Multifunción (Impresora/Scanner/Copia)</option>
                                <option value="scanner">Solo Scanner</option>
                              </select>
                              <p className="text-xs text-gray-500 mt-1">Tipo de dispositivo según sus funcionalidades</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Número de Serie</label>
                              <input
                                type="text"
                                value={addForm.serial_number || ''}
                                onChange={(e) => setAddForm({...addForm, serial_number: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="ABC123456789"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-100">
                          <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Identificación
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Asset Tag *</label>
                              <input
                                type="text"
                                required
                                value={addForm.asset_tag || ''}
                                onChange={(e) => setAddForm({...addForm, asset_tag: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="AT0001, PRINT-001..."
                              />
                              <p className="text-xs text-gray-500 mt-1">Código único obligatorio para identificar la impresora</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                              <select
                                value={addForm.status || 'active'}
                                onChange={(e) => setAddForm({...addForm, status: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="active">Activa</option>
                                <option value="inactive">Inactiva</option>
                                <option value="maintenance">En Mantenimiento</option>
                                <option value="retired">Retirada</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Condición</label>
                              <select
                                value={addForm.condition || 'good'}
                                onChange={(e) => setAddForm({...addForm, condition: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="excellent">Excelente</option>
                                <option value="good">Buena</option>
                                <option value="fair">Regular</option>
                                <option value="poor">Pobre</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Red y Configuración Tab */}
                    {activeTab === 'network' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg border border-purple-100">
                          <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            Configuración de Red
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Dirección IP *</label>
                              <input
                                type="text"
                                required
                                value={addForm.ip || ''}
                                onChange={(e) => setAddForm({...addForm, ip: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="192.168.1.100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Hostname</label>
                              <input
                                type="text"
                                value={addForm.hostname || ''}
                                onChange={(e) => setAddForm({...addForm, hostname: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="printer-office-01"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Dirección MAC</label>
                              <input
                                type="text"
                                value={addForm.mac_address || ''}
                                onChange={(e) => setAddForm({...addForm, mac_address: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="AA:BB:CC:DD:EE:FF"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-lg border border-orange-100">
                          <h4 className="text-lg font-semibold text-orange-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configuración SNMP
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Perfil SNMP</label>
                              <select
                                value={addForm.snmp_profile || 'generic_v2c'}
                                onChange={(e) => setAddForm({...addForm, snmp_profile: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="generic_v2c">Genérico v2c</option>
                                <option value="hp">HP</option>
                                <option value="oki">OKI</option>
                                <option value="brother">Brother</option>
                                <option value="canon">Canon</option>
                                <option value="epson">Epson</option>
                              </select>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center p-3 bg-white rounded-lg border">
                                <input
                                  type="checkbox"
                                  id="network_capable"
                                  checked={addForm.network_capable || true}
                                  onChange={(e) => setAddForm({...addForm, network_capable: e.target.checked})}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="network_capable" className="ml-3 block text-sm text-gray-900 font-medium">
                                  Capacidad de Red
                                </label>
                              </div>
                              <div className="flex items-center p-3 bg-white rounded-lg border">
                                <input
                                  type="checkbox"
                                  id="wireless_capable"
                                  checked={addForm.wireless_capable || false}
                                  onChange={(e) => setAddForm({...addForm, wireless_capable: e.target.checked})}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="wireless_capable" className="ml-3 block text-sm text-gray-900 font-medium">
                                  Capacidad Inalámbrica
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Especificaciones Tab */}
                    {activeTab === 'technical' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-lg border border-cyan-100">
                          <h4 className="text-lg font-semibold text-cyan-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Especificaciones de Impresión
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tecnología de Impresión</label>
                              <select
                                value={addForm.print_technology || ''}
                                onChange={(e) => setAddForm({...addForm, print_technology: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="">Seleccionar Tecnología</option>
                                <option value="laser">Láser</option>
                                <option value="inkjet">Inyección de Tinta</option>
                                <option value="led">LED</option>
                                <option value="thermal">Térmica</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Tamaño Máximo de Papel</label>
                              <select
                                value={addForm.max_paper_size || ''}
                                onChange={(e) => setAddForm({...addForm, max_paper_size: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                              >
                                <option value="">Seleccionar Tamaño</option>
                                <option value="A4">A4</option>
                                <option value="A3">A3</option>
                                <option value="Letter">Carta</option>
                                <option value="Legal">Legal</option>
                                <option value="Tabloid">Tabloide</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-6 rounded-lg border border-pink-100">
                          <h4 className="text-lg font-semibold text-pink-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                            </svg>
                            Capacidades
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center p-3 bg-white rounded-lg border">
                              <input
                                type="checkbox"
                                id="is_color"
                                checked={addForm.is_color || false}
                                onChange={(e) => setAddForm({...addForm, is_color: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="is_color" className="ml-3 block text-sm text-gray-900 font-medium">
                                Impresión a Color
                              </label>
                            </div>
                            <div className="flex items-center p-3 bg-white rounded-lg border">
                              <input
                                type="checkbox"
                                id="duplex_capable"
                                checked={addForm.duplex_capable || false}
                                onChange={(e) => setAddForm({...addForm, duplex_capable: e.target.checked})}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="duplex_capable" className="ml-3 block text-sm text-gray-900 font-medium">
                                Impresión Dúplex (Doble Cara)
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ubicación Tab */}
                    {activeTab === 'location' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100">
                          <h4 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Ubicación Física
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                              <input
                                type="text"
                                value={addForm.location || ''}
                                onChange={(e) => setAddForm({...addForm, location: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Oficina Principal, Planta 1"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Edificio</label>
                              <input
                                type="text"
                                value={addForm.building || ''}
                                onChange={(e) => setAddForm({...addForm, building: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Edificio Principal, Anexo..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Piso</label>
                              <input
                                type="text"
                                value={addForm.floor || ''}
                                onChange={(e) => setAddForm({...addForm, floor: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Piso 1, Piso 2..."
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-100">
                          <h4 className="text-lg font-semibold text-emerald-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Información Organizacional
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                              <input
                                type="text"
                                value={addForm.department || ''}
                                onChange={(e) => setAddForm({...addForm, department: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Administración, IT, Marketing..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                              <input
                                type="text"
                                value={addForm.sector || ''}
                                onChange={(e) => setAddForm({...addForm, sector: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Operaciones, Soporte, Ventas..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Persona Responsable</label>
                              <input
                                type="text"
                                value={addForm.responsible_person || ''}
                                onChange={(e) => setAddForm({...addForm, responsible_person: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="Nombre del responsable"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costos</label>
                              <input
                                type="text"
                                value={addForm.cost_center || ''}
                                onChange={(e) => setAddForm({...addForm, cost_center: e.target.value})}
                                className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                placeholder="CC001, CC-ADM-001..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Propiedad y Fechas Tab */}
                    {activeTab === 'ownership' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-100">
                            <h4 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                              Información de Propiedad
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Propiedad</label>
                                <select
                                  value={addForm.ownership_type || 'owned'}
                                  onChange={(e) => setAddForm({...addForm, ownership_type: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                >
                                  <option value="owned">Propia</option>
                                  <option value="leased">Arrendada</option>
                                  <option value="rented">Alquilada</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor</label>
                                <input
                                  type="text"
                                  value={addForm.supplier || ''}
                                  onChange={(e) => setAddForm({...addForm, supplier: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                  placeholder="Nombre del proveedor"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contrato de Arrendamiento</label>
                                <input
                                  type="text"
                                  value={addForm.lease_contract || ''}
                                  onChange={(e) => setAddForm({...addForm, lease_contract: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                  placeholder="Número de contrato (si aplica)"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-6 rounded-lg border border-slate-100">
                            <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 9l6-6m-6 6l6 6m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Fechas Importantes
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Compra</label>
                                <input
                                  type="date"
                                  value={addForm.purchase_date ? new Date(addForm.purchase_date).toISOString().split('T')[0] : ''}
                                  onChange={(e) => setAddForm({...addForm, purchase_date: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Instalación</label>
                                <input
                                  type="date"
                                  value={addForm.installation_date ? new Date(addForm.installation_date).toISOString().split('T')[0] : ''}
                                  onChange={(e) => setAddForm({...addForm, installation_date: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Vencimiento de Garantía</label>
                                <input
                                  type="date"
                                  value={addForm.warranty_expiry ? new Date(addForm.warranty_expiry).toISOString().split('T')[0] : ''}
                                  onChange={(e) => setAddForm({...addForm, warranty_expiry: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notas */}
                        <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-lg border border-gray-100">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Notas Adicionales
                          </h4>
                          <textarea
                            value={addForm.notes || ''}
                            onChange={(e) => setAddForm({...addForm, notes: e.target.value})}
                            rows={4}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                            placeholder="Información adicional sobre esta impresora, configuraciones especiales, observaciones de mantenimiento, etc..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Insumos Tab */}
                    {activeTab === 'supplies' && (
                      <div className="space-y-6">
                        {/* Información sobre el tipo de impresora */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium text-blue-800">
                              {addForm.is_color 
                                ? 'Impresora a color - Se muestran todos los tóners' 
                                : 'Impresora monocromática - Solo se muestra tóner negro'
                              }
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg border border-purple-100">
                            <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4v16a1 1 0 001 1h8a1 1 0 001-1V4M9 8h6M9 12h6M9 16h6" />
                              </svg>
                              Códigos de Tóner
                            </h4>
                            <div className="space-y-4">
                              {/* Tóner Negro - Siempre visible */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tóner Negro</label>
                                <input
                                  type="text"
                                  value={addForm.toner_black_code || ''}
                                  onChange={(e) => setAddForm({...addForm, toner_black_code: e.target.value})}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                  placeholder="HP 85A, TN-2410, C-EXV33..."
                                />
                              </div>

                              {/* Tóners de color - Solo si is_color está marcado */}
                              {addForm.is_color && (
                                <>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tóner Cian</label>
                                    <input
                                      type="text"
                                      value={addForm.toner_cyan_code || ''}
                                      onChange={(e) => setAddForm({...addForm, toner_cyan_code: e.target.value})}
                                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                      placeholder="HP 201A, TN-245C, C-EXV49C..."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tóner Magenta</label>
                                    <input
                                      type="text"
                                      value={addForm.toner_magenta_code || ''}
                                      onChange={(e) => setAddForm({...addForm, toner_magenta_code: e.target.value})}
                                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                      placeholder="HP 201A, TN-245M, C-EXV49M..."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tóner Amarillo</label>
                                    <input
                                      type="text"
                                      value={addForm.toner_yellow_code || ''}
                                      onChange={(e) => setAddForm({...addForm, toner_yellow_code: e.target.value})}
                                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                      placeholder="HP 201A, TN-245Y, C-EXV49Y..."
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-100">
                            <h4 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                              Otros Insumos
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Insumos Adicionales</label>
                                <textarea
                                  value={addForm.other_supplies || ''}
                                  onChange={(e) => setAddForm({...addForm, other_supplies: e.target.value})}
                                  rows={8}
                                  className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                                  placeholder="Tambores, fusores, kits de mantenimiento, rollos de transferencia, etc.&#10;&#10;Ejemplo:&#10;- Tambor: DR-2400&#10;- Fusor: RM1-6319&#10;- Kit de mantenimiento: MK-8505"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Información de Compatibilidad */}
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
                            <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Información de Compatibilidad
                            </h4>
                            <div className="bg-blue-25 p-4 rounded-lg border border-blue-200">
                              <div className="text-sm text-blue-800">
                                <p className="font-medium mb-2">💡 Consejos para códigos de insumos:</p>
                                <ul className="space-y-1 ml-4">
                                  <li>• Para impresoras B&N, solo completar el campo "Tóner Negro"</li>
                                  <li>• Para impresoras color, completar los 4 colores (CMYK)</li>
                                  <li>• Incluir códigos originales y compatibles si es relevante</li>
                                  <li>• En "Otros insumos" agregar tambores, fusores, kits de mantenimiento</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                    <div className="flex space-x-2">
                      {activeTab !== 'basic' && (
                        <button
                          type="button"
                          onClick={() => {
                            const tabs = ['basic', 'network', 'technical', 'location', 'ownership', 'supplies'];
                            const currentIndex = tabs.indexOf(activeTab);
                            if (currentIndex > 0) {
                              setActiveTab(tabs[currentIndex - 1]);
                            }
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Anterior
                        </button>
                      )}
                      {activeTab !== 'supplies' && (
                        <button
                          type="button"
                          onClick={() => {
                            const tabs = ['basic', 'network', 'technical', 'location', 'ownership', 'supplies'];
                            const currentIndex = tabs.indexOf(activeTab);
                            if (currentIndex < tabs.length - 1) {
                              setActiveTab(tabs[currentIndex + 1]);
                            }
                          }}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center"
                        >
                          Siguiente
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={handleAddCancel}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Agregar Impresora
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}