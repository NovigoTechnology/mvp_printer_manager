'use client'
import { useState, useEffect } from 'react'

interface Printer {
  id: number
  brand: string
  model: string
  serial_number?: string
  asset_tag: string
  location?: string
  department?: string
  is_color?: boolean
  printer_type?: string
  toner_black_code?: string
  toner_cyan_code?: string
  toner_magenta_code?: string
  toner_yellow_code?: string
  status: string
}

interface TonerRequest {
  id: number
  printer_id: number
  request_date: string
  status: string
  priority: string
  supply_type?: string
  toner_black_requested: boolean
  toner_cyan_requested: boolean
  toner_magenta_requested: boolean
  toner_yellow_requested: boolean
  toner_black_code?: string
  toner_cyan_code?: string
  toner_magenta_code?: string
  toner_yellow_code?: string
  other_supply_description?: string
  notes?: string
  requested_by: string
  department?: string
  printer_brand?: string
  printer_model?: string
  printer_asset_tag?: string
  printer_location?: string
}

const TONER_REQUEST_API_BASE = 'http://localhost:8000/api'

export default function SupplyRequestsPage() {
  // Estados principales
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [tonerRequests, setTonerRequests] = useState<TonerRequest[]>([])
  const [loading, setLoading] = useState(false)
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    supply_type: 'toner', // toner, unidad_imagen, papel, otro
    toner_black_requested: false,
    toner_black_quantity: 1,
    toner_cyan_requested: false,
    toner_cyan_quantity: 1,
    toner_magenta_requested: false,
    toner_magenta_quantity: 1,
    toner_yellow_requested: false,
    toner_yellow_quantity: 1,
    other_supply_description: '',
    notes: '',
    requested_by: '',
    department: '',
    priority: 'normal'
  })
  
  // Estados de búsqueda avanzada
  const [advancedSearch, setAdvancedSearch] = useState({
    asset_tag: '',
    serial_number: '',
    brand: '',
    model: '',
    location: '',
    department: ''
  })
  const [searchResults, setSearchResults] = useState<Printer[]>([])

  // Buscar impresora por ID/Asset Tag
  const handleQuickSearch = async () => {
    if (!searchQuery.trim()) return
    
    try {
      setLoading(true)
      const response = await fetch(`${TONER_REQUEST_API_BASE}/printers/search?asset_tag=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const printers = await response.json()
        if (printers.length > 0) {
          setSelectedPrinter(printers[0])
          setSearchQuery('')
        } else {
          alert('No se encontró ninguna impresora con ese código')
        }
      }
    } catch (error) {
      console.error('Error buscando impresora:', error)
      alert('Error al buscar la impresora')
    } finally {
      setLoading(false)
    }
  }

  // Búsqueda avanzada
  const handleAdvancedSearch = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      Object.entries(advancedSearch).forEach(([key, value]) => {
        if (value.trim()) {
          params.append(key, value.trim())
        }
      })
      
      const response = await fetch(`${TONER_REQUEST_API_BASE}/printers/search?${params}`)
      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
      }
    } catch (error) {
      console.error('Error en búsqueda avanzada:', error)
      alert('Error en la búsqueda avanzada')
    } finally {
      setLoading(false)
    }
  }

  // Seleccionar impresora desde los resultados
  const selectPrinter = (printer: Printer) => {
    setSelectedPrinter(printer)
    setShowAdvancedSearch(false)
    setSearchResults([])
    
    // Pre-llenar códigos de tóner
    setFormData(prev => ({
      ...prev,
      department: printer.department || ''
    }))
  }

  // Enviar pedido
  const handleSubmitRequest = async () => {
    if (!selectedPrinter) {
      alert('Debe seleccionar una impresora')
      return
    }

    if (!formData.requested_by.trim()) {
      alert('Debe indicar quién solicita el pedido')
      return
    }

    const hasTonerRequest = formData.toner_black_requested || 
                           formData.toner_cyan_requested || 
                           formData.toner_magenta_requested || 
                           formData.toner_yellow_requested
    
    // Validar que haya seleccionado algo
    if (formData.supply_type === 'toner' && !hasTonerRequest) {
      alert('Debe seleccionar al menos un tóner')
      return
    }
    
    if (formData.supply_type !== 'toner' && !formData.other_supply_description.trim()) {
      alert('Debe describir el insumo solicitado')
      return
    }

    try {
      setLoading(true)
      
      const requestData = {
        printer_id: selectedPrinter.id,
        ...formData,
        toner_black_code: selectedPrinter.toner_black_code,
        toner_cyan_code: selectedPrinter.toner_cyan_code,
        toner_magenta_code: selectedPrinter.toner_magenta_code,
        toner_yellow_code: selectedPrinter.toner_yellow_code
      }
      
      const response = await fetch(`${TONER_REQUEST_API_BASE}/toner-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })
      
      if (response.ok) {
        alert('Pedido de insumos creado exitosamente')
        // Resetear formulario
        setSelectedPrinter(null)
        setFormData({
          supply_type: 'toner',
          toner_black_requested: false,
          toner_black_quantity: 1,
          toner_cyan_requested: false,
          toner_cyan_quantity: 1,
          toner_magenta_requested: false,
          toner_magenta_quantity: 1,
          toner_yellow_requested: false,
          toner_yellow_quantity: 1,
          other_supply_description: '',
          notes: '',
          requested_by: '',
          department: '',
          priority: 'normal'
        })
        // Recargar lista de pedidos
        loadTonerRequests()
      } else {
        const errorData = await response.json()
        alert(`Error al crear pedido: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error creando pedido:', error)
      alert('Error al crear el pedido')
    } finally {
      setLoading(false)
    }
  }

  // Cargar lista de pedidos
  const loadTonerRequests = async () => {
    try {
      const response = await fetch(`${TONER_REQUEST_API_BASE}/toner-requests?limit=20`)
      if (response.ok) {
        const requests = await response.json()
        setTonerRequests(requests)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    }
  }

  // Cargar pedidos al montar componente
  useEffect(() => {
    loadTonerRequests()
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pedidos de Insumos</h1>
          <p className="text-gray-600">Gestión de solicitudes de insumos para impresoras</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Formulario de pedido */}
          <div className="xl:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Nuevo Pedido de Insumos</h2>
            
            {/* Búsqueda de impresora */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID de Inventario (Obligatorio) *
              </label>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ingrese el código de inventario..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleQuickSearch()}
                />
                <button
                  onClick={handleQuickSearch}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Buscar
                </button>
                <button
                  onClick={() => setShowAdvancedSearch(true)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Búsqueda Avanzada
                </button>
              </div>

              {/* Impresora seleccionada */}
              {selectedPrinter && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Impresora Seleccionada</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Marca:</strong> {selectedPrinter.brand}</div>
                    <div><strong>Modelo:</strong> {selectedPrinter.model}</div>
                    <div><strong>Asset Tag:</strong> {selectedPrinter.asset_tag}</div>
                    <div><strong>Serie:</strong> {selectedPrinter.serial_number || 'N/A'}</div>
                    <div><strong>Ubicación:</strong> {selectedPrinter.location || 'N/A'}</div>
                    <div><strong>Departamento:</strong> {selectedPrinter.department || 'N/A'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Formulario de pedido */}
            {selectedPrinter && (
              <div className="space-y-6">
                {/* Selector de tipo de insumo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Insumo *
                  </label>
                  <select
                    value={formData.supply_type}
                    onChange={(e) => setFormData(prev => ({...prev, supply_type: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="toner">Tóner</option>
                    <option value="unidad_imagen">Unidad de Imagen</option>
                    <option value="papel">Papel</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Tóners - Solo mostrar si se selecciona tóner */}
                {formData.supply_type === 'toner' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tóners Solicitados</h3>
                    <div className="space-y-4">
                    {/* Información del tipo de impresora */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-blue-800">
                          Impresora {selectedPrinter.is_color ? 'a color' : 'monocromática (B&N)'} - 
                          {selectedPrinter.printer_type === 'multifunction' ? ' Multifunción' : 
                           selectedPrinter.printer_type === 'printer' ? ' Solo impresión' : ' Scanner'}
                          {selectedPrinter.is_color ? ' (Muestra todos los tóners)' : ' (Solo tóner negro)'}
                        </span>
                      </div>
                    </div>

                    {/* Tóner Negro - Siempre disponible */}
                    {selectedPrinter.toner_black_code && (
                      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <input
                              type="checkbox"
                              id="toner_black"
                              checked={formData.toner_black_requested}
                              onChange={(e) => setFormData(prev => ({...prev, toner_black_requested: e.target.checked}))}
                              className="h-4 w-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <label htmlFor="toner_black" className="font-medium text-gray-900 cursor-pointer">
                                Tóner Negro
                              </label>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                  {selectedPrinter.toner_black_code}
                                </span>
                              </div>
                            </div>
                          </div>
                          {formData.toner_black_requested && (
                            <div className="ml-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={formData.toner_black_quantity}
                                onChange={(e) => setFormData(prev => ({...prev, toner_black_quantity: parseInt(e.target.value) || 1}))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Tóner Cian - Solo para impresoras a color */}
                    {selectedPrinter.is_color && selectedPrinter.toner_cyan_code && (
                      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <input
                              type="checkbox"
                              id="toner_cyan"
                              checked={formData.toner_cyan_requested}
                              onChange={(e) => setFormData(prev => ({...prev, toner_cyan_requested: e.target.checked}))}
                              className="h-4 w-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <label htmlFor="toner_cyan" className="font-medium text-cyan-700 cursor-pointer">
                                Tóner Cian
                              </label>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-mono bg-cyan-100 px-2 py-1 rounded">
                                  {selectedPrinter.toner_cyan_code}
                                </span>
                              </div>
                            </div>
                          </div>
                          {formData.toner_cyan_requested && (
                            <div className="ml-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={formData.toner_cyan_quantity}
                                onChange={(e) => setFormData(prev => ({...prev, toner_cyan_quantity: parseInt(e.target.value) || 1}))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Tóner Magenta - Solo para impresoras a color */}
                    {selectedPrinter.is_color && selectedPrinter.toner_magenta_code && (
                      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <input
                              type="checkbox"
                              id="toner_magenta"
                              checked={formData.toner_magenta_requested}
                              onChange={(e) => setFormData(prev => ({...prev, toner_magenta_requested: e.target.checked}))}
                              className="h-4 w-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <label htmlFor="toner_magenta" className="font-medium text-pink-700 cursor-pointer">
                                Tóner Magenta
                              </label>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-mono bg-pink-100 px-2 py-1 rounded">
                                  {selectedPrinter.toner_magenta_code}
                                </span>
                              </div>
                            </div>
                          </div>
                          {formData.toner_magenta_requested && (
                            <div className="ml-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={formData.toner_magenta_quantity}
                                onChange={(e) => setFormData(prev => ({...prev, toner_magenta_quantity: parseInt(e.target.value) || 1}))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Tóner Amarillo - Solo para impresoras a color */}
                    {selectedPrinter.is_color && selectedPrinter.toner_yellow_code && (
                      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <input
                              type="checkbox"
                              id="toner_yellow"
                              checked={formData.toner_yellow_requested}
                              onChange={(e) => setFormData(prev => ({...prev, toner_yellow_requested: e.target.checked}))}
                              className="h-4 w-4 text-blue-600"
                            />
                            <div className="flex-1">
                              <label htmlFor="toner_yellow" className="font-medium text-yellow-700 cursor-pointer">
                                Tóner Amarillo
                              </label>
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-mono bg-yellow-100 px-2 py-1 rounded">
                                  {selectedPrinter.toner_yellow_code}
                                </span>
                              </div>
                            </div>
                          </div>
                          {formData.toner_yellow_requested && (
                            <div className="ml-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={formData.toner_yellow_quantity}
                                onChange={(e) => setFormData(prev => ({...prev, toner_yellow_quantity: parseInt(e.target.value) || 1}))}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mensaje si no hay tóners registrados */}
                    {(!selectedPrinter.toner_black_code && 
                      (!selectedPrinter.is_color || 
                       (!selectedPrinter.toner_cyan_code && !selectedPrinter.toner_magenta_code && !selectedPrinter.toner_yellow_code))) && (
                      <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-sm font-medium text-orange-800">
                            {selectedPrinter.is_color 
                              ? 'No hay códigos de tóner registrados para este equipo a color.' 
                              : 'No hay código de tóner negro registrado para este equipo monocromático.'
                            } Por favor, especifique los códigos en la descripción del insumo o actualice la información del equipo.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Descripción para otros tipos de insumos */}
                {formData.supply_type !== 'toner' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción del Insumo *
                    </label>
                    <textarea
                      value={formData.other_supply_description}
                      onChange={(e) => setFormData(prev => ({...prev, other_supply_description: e.target.value}))}
                      placeholder={
                        formData.supply_type === 'unidad_imagen' ? 'Especifique el tipo y código de unidad de imagen...' :
                        formData.supply_type === 'papel' ? 'Especifique tipo, tamaño y cantidad de papel...' :
                        'Especifique el insumo necesario...'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      required
                    />
                  </div>
                )}

                {/* Información del solicitante */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Solicitado por *
                    </label>
                    <input
                      type="text"
                      value={formData.requested_by}
                      onChange={(e) => setFormData(prev => ({...prev, requested_by: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Departamento
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({...prev, department: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Prioridad */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridad
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({...prev, priority: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Baja</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                    placeholder="Notas o comentarios adicionales"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                {/* Botón de envío */}
                <div className="pt-4 border-t">
                  <button
                    onClick={handleSubmitRequest}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Enviando...' : 'Enviar Pedido de Insumos'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de pedidos recientes */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Pedidos Recientes</h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {tonerRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-semibold text-gray-900">
                      {request.printer_brand} {request.printer_model}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Asset Tag:</strong> {request.printer_asset_tag}</div>
                    <div><strong>Solicitado por:</strong> {request.requested_by}</div>
                    <div><strong>Fecha:</strong> {new Date(request.request_date).toLocaleDateString()}</div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                    <div className="text-xs text-gray-500">
                      #{request.id}
                    </div>
                  </div>
                </div>
              ))}
              
              {tonerRequests.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No hay pedidos registrados
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de búsqueda avanzada */}
      {showAdvancedSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Búsqueda Avanzada de Equipos</h3>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Asset Tag</label>
                  <input
                    type="text"
                    value={advancedSearch.asset_tag}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, asset_tag: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Número de Serie</label>
                  <input
                    type="text"
                    value={advancedSearch.serial_number}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, serial_number: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={advancedSearch.brand}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, brand: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
                  <input
                    type="text"
                    value={advancedSearch.model}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, model: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
                  <input
                    type="text"
                    value={advancedSearch.location}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, location: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                  <input
                    type="text"
                    value={advancedSearch.department}
                    onChange={(e) => setAdvancedSearch(prev => ({...prev, department: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleAdvancedSearch}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mb-6"
              >
                {loading ? 'Buscando...' : 'Buscar Equipos'}
              </button>

              {/* Resultados de búsqueda */}
              {searchResults.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Resultados de Búsqueda</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((printer) => (
                      <div
                        key={printer.id}
                        onClick={() => selectPrinter(printer)}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                      >
                        <div className="font-semibold">{printer.brand} {printer.model}</div>
                        <div className="text-sm text-gray-600">
                          <div>Asset Tag: {printer.asset_tag}</div>
                          <div>Serie: {printer.serial_number || 'N/A'}</div>
                          <div>Ubicación: {printer.location || 'N/A'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 && advancedSearch.asset_tag && (
                <div className="text-center text-gray-500 py-4">
                  No se encontraron equipos con los criterios especificados
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowAdvancedSearch(false)
                  setSearchResults([])
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}