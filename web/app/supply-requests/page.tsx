'use client'
import { useState, useEffect } from 'react'

interface SupplyItem {
  id: string // Identificador único temporal para el frontend
  type: 'toner_black' | 'toner_cyan' | 'toner_magenta' | 'toner_yellow' | 'unidad_imagen' | 'papel' | 'otro'
  description: string
  quantity: number
  code?: string // Para toners y otros insumos con código específico
}

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

const SUPPLY_TYPES = {
  toner_black: { label: 'Tóner Negro', icon: '⚫', color: 'gray' },
  toner_cyan: { label: 'Tóner Cian', icon: '🔵', color: 'blue' },
  toner_magenta: { label: 'Tóner Magenta', icon: '🟣', color: 'purple' },
  toner_yellow: { label: 'Tóner Amarillo', icon: '🟡', color: 'yellow' },
  unidad_imagen: { label: 'Unidad de Imagen', icon: '📸', color: 'green' },
  papel: { label: 'Papel', icon: '📄', color: 'orange' },
  otro: { label: 'Otro Insumo', icon: '📦', color: 'indigo' }
}

export default function SupplyRequestsPage() {
  // Estados principales
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [tonerRequests, setTonerRequests] = useState<TonerRequest[]>([])
  const [loading, setLoading] = useState(false)
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    supplies: [] as SupplyItem[], // Lista de insumos solicitados
    notes: '',
    requested_by: '',
    department: '',
    priority: 'normal'
  })

  // Estados para el modal de insumos
  const [showSuppliesModal, setShowSuppliesModal] = useState(false)
  const [modalSupplies, setModalSupplies] = useState<SupplyItem[]>([])

  // Estados de búsqueda avanzada
  const [advancedSearch, setAdvancedSearch] = useState({
    asset_tag: '',
    serial_number: '',
    brand: '',
    model: '',
    location: '',
    department: '',
    status: ''
  })

  // Estados adicionales
  const [printers, setPrinters] = useState<Printer[]>([])
  const [filteredPrinters, setFilteredPrinters] = useState<Printer[]>([])

  // Funciones para generar ID único
  const generateId = () => Math.random().toString(36).substr(2, 9)

  // Función para abrir el modal de insumos
  const openSuppliesModal = () => {
    if (!selectedPrinter) {
      alert('Por favor seleccione una impresora primero')
      return
    }

    // Inicializar con una fila vacía
    setModalSupplies([{
      id: generateId(),
      type: 'toner_black',
      description: '',
      quantity: 1,
      code: ''
    }])
    setShowSuppliesModal(true)
  }

  // Función para agregar nueva fila en el modal
  const addRowInModal = () => {
    setModalSupplies(prev => [...prev, {
      id: generateId(),
      type: 'toner_black',
      description: '',
      quantity: 1,
      code: ''
    }])
  }

  // Función para eliminar fila del modal
  const removeRowFromModal = (id: string) => {
    setModalSupplies(prev => prev.filter(item => item.id !== id))
  }

  // Función para actualizar fila en el modal
  const updateRowInModal = (id: string, field: keyof SupplyItem, value: any) => {
    setModalSupplies(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Función para confirmar y agregar todos los insumos del modal
  const confirmModalSupplies = () => {
    const validSupplies = modalSupplies.filter(supply => 
      supply.description.trim() !== '' || (supply.code && supply.code.trim() !== '')
    )

    if (validSupplies.length === 0) {
      alert('Por favor agregue al menos un insumo con descripción o código')
      return
    }

    // Agregar los insumos válidos a la lista principal
    setFormData(prev => ({
      ...prev,
      supplies: [...prev.supplies, ...validSupplies.map(supply => ({
        ...supply,
        id: generateId() // Generar nuevo ID para evitar conflictos
      }))]
    }))

    // Cerrar modal
    setShowSuppliesModal(false)
    setModalSupplies([])
  }

  // Función para eliminar un insumo
  const removeSupplyItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      supplies: prev.supplies.filter(item => item.id !== id)
    }))
  }

  // Función para validar el formulario
  const validateForm = () => {
    if (!selectedPrinter) {
      alert('Por favor seleccione una impresora')
      return false
    }

    if (formData.supplies.length === 0) {
      alert('Por favor agregue al menos un insumo a la solicitud')
      return false
    }

    if (!formData.requested_by.trim()) {
      alert('Por favor ingrese el nombre del solicitante')
      return false
    }

    return true
  }

  // Función para enviar la solicitud
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      // Convertir la lista de insumos al formato del backend
      const requestData = {
        printer_id: selectedPrinter!.id,
        toner_black_requested: formData.supplies.some(s => s.type === 'toner_black'),
        toner_black_quantity: formData.supplies.find(s => s.type === 'toner_black')?.quantity || 1,
        toner_cyan_requested: formData.supplies.some(s => s.type === 'toner_cyan'),
        toner_cyan_quantity: formData.supplies.find(s => s.type === 'toner_cyan')?.quantity || 1,
        toner_magenta_requested: formData.supplies.some(s => s.type === 'toner_magenta'),
        toner_magenta_quantity: formData.supplies.find(s => s.type === 'toner_magenta')?.quantity || 1,
        toner_yellow_requested: formData.supplies.some(s => s.type === 'toner_yellow'),
        toner_yellow_quantity: formData.supplies.find(s => s.type === 'toner_yellow')?.quantity || 1,
        toner_black_code: formData.supplies.find(s => s.type === 'toner_black')?.code,
        toner_cyan_code: formData.supplies.find(s => s.type === 'toner_cyan')?.code,
        toner_magenta_code: formData.supplies.find(s => s.type === 'toner_magenta')?.code,
        toner_yellow_code: formData.supplies.find(s => s.type === 'toner_yellow')?.code,
        other_supplies_requested: formData.supplies
          .filter(s => !s.type.startsWith('toner_'))
          .map(s => `${s.description} (Cantidad: ${s.quantity}${s.code ? ', Código: ' + s.code : ''})`)
          .join('; '),
        notes: formData.notes,
        requested_by: formData.requested_by,
        department: formData.department,
        priority: formData.priority
      }

      const response = await fetch(`${TONER_REQUEST_API_BASE}/toner-requests/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        alert('Solicitud de insumos creada exitosamente')
        
        // Limpiar formulario
        setFormData({
          supplies: [],
          notes: '',
          requested_by: '',
          department: '',
          priority: 'normal'
        })
        setSelectedPrinter(null)
        setSearchQuery('')
        
        // Recargar las solicitudes
        fetchTonerRequests()
      } else {
        const errorData = await response.json()
        alert(`Error al crear la solicitud: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Error de conexión al crear la solicitud')
    } finally {
      setLoading(false)
    }
  }

  // Función para cargar solicitudes de tóner
  const fetchTonerRequests = async () => {
    try {
      const response = await fetch(`${TONER_REQUEST_API_BASE}/toner-requests/`)
      if (response.ok) {
        const data = await response.json()
        setTonerRequests(data)
      }
    } catch (error) {
      console.error('Error fetching toner requests:', error)
    }
  }

  // Función para cargar impresoras
  const fetchPrinters = async () => {
    try {
      const response = await fetch('http://localhost:8000/printers/')
      if (response.ok) {
        const data = await response.json()
        setPrinters(data)
        setFilteredPrinters(data)
      }
    } catch (error) {
      console.error('Error fetching printers:', error)
    }
  }

  // Efecto para cargar datos iniciales
  useEffect(() => {
    fetchPrinters()
    fetchTonerRequests()
  }, [])

  // Efecto para filtrar impresoras
  useEffect(() => {
    let filtered = printers

    if (searchQuery) {
      filtered = filtered.filter(printer =>
        printer.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        printer.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        printer.asset_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (printer.location && printer.location.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Aplicar filtros avanzados
    if (advancedSearch.asset_tag) {
      filtered = filtered.filter(p => p.asset_tag.toLowerCase().includes(advancedSearch.asset_tag.toLowerCase()))
    }
    if (advancedSearch.serial_number) {
      filtered = filtered.filter(p => p.serial_number?.toLowerCase().includes(advancedSearch.serial_number.toLowerCase()))
    }
    if (advancedSearch.brand) {
      filtered = filtered.filter(p => p.brand.toLowerCase().includes(advancedSearch.brand.toLowerCase()))
    }
    if (advancedSearch.model) {
      filtered = filtered.filter(p => p.model.toLowerCase().includes(advancedSearch.model.toLowerCase()))
    }
    if (advancedSearch.location) {
      filtered = filtered.filter(p => p.location?.toLowerCase().includes(advancedSearch.location.toLowerCase()))
    }
    if (advancedSearch.department) {
      filtered = filtered.filter(p => p.department?.toLowerCase().includes(advancedSearch.department.toLowerCase()))
    }
    if (advancedSearch.status) {
      filtered = filtered.filter(p => p.status === advancedSearch.status)
    }

    setFilteredPrinters(filtered)
  }, [searchQuery, advancedSearch, printers])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pedidos de Insumos</h1>
          <p className="mt-2 text-gray-600">
            Gestione las solicitudes de tóners y otros insumos para impresoras
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel de Solicitud */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nueva Solicitud de Insumos</h2>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selector de Impresora */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar Impresora
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar por marca, modelo, etiqueta o ubicación..."
                    />
                    
                    {/* Impresora seleccionada */}
                    {selectedPrinter && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-blue-900">
                              {selectedPrinter.brand} {selectedPrinter.model}
                            </p>
                            <p className="text-sm text-blue-700">
                              Etiqueta: {selectedPrinter.asset_tag}
                            </p>
                            {selectedPrinter.location && (
                              <p className="text-sm text-blue-700">
                                Ubicación: {selectedPrinter.location}
                              </p>
                            )}
                            <p className="text-sm text-blue-700">
                              Tipo: {selectedPrinter.is_color ? 'Color' : 'Monocromática'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedPrinter(null)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Lista de impresoras disponibles */}
                    {!selectedPrinter && searchQuery && (
                      <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                        {filteredPrinters.length > 0 ? (
                          filteredPrinters.map(printer => (
                            <button
                              key={printer.id}
                              type="button"
                              onClick={() => setSelectedPrinter(printer)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">{printer.brand} {printer.model}</div>
                              <div className="text-sm text-gray-600">
                                {printer.asset_tag} • {printer.location || 'Sin ubicación'} • 
                                {printer.is_color ? ' Color' : ' B&N'}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500">
                            No se encontraron impresoras
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón para Agregar Insumos */}
                {selectedPrinter && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={openSuppliesModal}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                    >
                      📦 Agregar Insumo
                    </button>
                  </div>
                )}

                {/* Lista de Insumos Agregados */}
                {formData.supplies.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Insumos Solicitados</h3>
                    
                    <div className="space-y-2">
                      {formData.supplies.map(supply => (
                        <div key={supply.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{SUPPLY_TYPES[supply.type].icon}</span>
                              <span className="font-medium">{SUPPLY_TYPES[supply.type].label}</span>
                              <span className="text-gray-500">×{supply.quantity}</span>
                            </div>
                            <p className="text-sm text-gray-700">{supply.description}</p>
                            {supply.code && (
                              <p className="text-sm text-gray-500">Código: {supply.code}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSupplyItem(supply.id)}
                            className="text-red-600 hover:text-red-800 ml-2"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Información Adicional */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Solicitado por *
                    </label>
                    <input
                      type="text"
                      value={formData.requested_by}
                      onChange={(e) => setFormData(prev => ({...prev, requested_by: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre del solicitante"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({...prev, department: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Departamento"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Información adicional sobre la solicitud..."
                  />
                </div>

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={loading || !selectedPrinter || formData.supplies.length === 0}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enviando...' : 'Crear Solicitud de Insumos'}
                </button>
              </form>
            </div>
          </div>

          {/* Panel de Solicitudes Existentes */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Solicitudes Recientes</h2>
            </div>
            
            <div className="p-6">
              {tonerRequests.length > 0 ? (
                <div className="space-y-4">
                  {tonerRequests.slice(0, 10).map(request => (
                    <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium">
                            {request.printer_brand} {request.printer_model}
                          </p>
                          <p className="text-sm text-gray-600">
                            {request.printer_asset_tag} • {request.printer_location}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.status === 'pending' ? 'Pendiente' :
                           request.status === 'approved' ? 'Aprobado' :
                           request.status === 'delivered' ? 'Entregado' :
                           request.status}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-700">
                        <p className="mb-1">Solicitado por: {request.requested_by}</p>
                        <p className="mb-1">Fecha: {new Date(request.request_date).toLocaleDateString()}</p>
                        
                        {/* Mostrar insumos solicitados */}
                        <div className="mt-2">
                          <p className="font-medium">Insumos:</p>
                          <ul className="list-disc list-inside ml-4 text-sm">
                            {request.toner_black_requested && (
                              <li>⚫ Tóner Negro {request.toner_black_code && `(${request.toner_black_code})`}</li>
                            )}
                            {request.toner_cyan_requested && (
                              <li>🔵 Tóner Cian {request.toner_cyan_code && `(${request.toner_cyan_code})`}</li>
                            )}
                            {request.toner_magenta_requested && (
                              <li>🟣 Tóner Magenta {request.toner_magenta_code && `(${request.toner_magenta_code})`}</li>
                            )}
                            {request.toner_yellow_requested && (
                              <li>🟡 Tóner Amarillo {request.toner_yellow_code && `(${request.toner_yellow_code})`}</li>
                            )}
                            {request.other_supply_description && (
                              <li>📦 Otros: {request.other_supply_description}</li>
                            )}
                          </ul>
                        </div>
                        
                        {request.notes && (
                          <p className="mt-2 text-gray-600">Notas: {request.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay solicitudes de insumos registradas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Agregar Insumos */}
      {showSuppliesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            {/* Header del modal */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Agregar Insumos
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedPrinter?.brand} {selectedPrinter?.model} - {selectedPrinter?.asset_tag}
                  </p>
                </div>
                <button
                  onClick={() => setShowSuppliesModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-160px)]">
              {/* Tabla minimalista y compacta */}
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-1/3">
                          Código
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-1/2">
                          Descripción
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 w-20">
                          Cantidad
                        </th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      {modalSupplies.map((supply, index) => (
                        <tr key={supply.id} className="border-b border-gray-100">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={supply.code || ''}
                              onChange={(e) => updateRowInModal(supply.id, 'code', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Código del insumo"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={supply.description}
                              onChange={(e) => updateRowInModal(supply.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Descripción del insumo"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="1"
                              value={supply.quantity}
                              onChange={(e) => updateRowInModal(supply.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-1">
                            {modalSupplies.length > 1 && (
                              <button
                                onClick={() => removeRowFromModal(supply.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                                title="Eliminar fila"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Botón para agregar nueva fila */}
                <div className="flex justify-start">
                  <button
                    onClick={addRowInModal}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    + Agregar otra fila
                  </button>
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
              <button
                onClick={() => setShowSuppliesModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModalSupplies}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Agregar Insumos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}