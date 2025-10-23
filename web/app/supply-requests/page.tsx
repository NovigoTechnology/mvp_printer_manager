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
  
  // Estado para agregar nuevo insumo
  const [newSupply, setNewSupply] = useState({
    type: 'toner_black' as SupplyItem['type'],
    description: '',
    quantity: 1,
    code: ''
  })

  // Estados para el modal de insumos
  const [showSuppliesModal, setShowSuppliesModal] = useState(false)
  const [availableSupplies, setAvailableSupplies] = useState<SupplyItem[]>([])

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

  // Función para generar insumos disponibles para la impresora
  const generateAvailableSupplies = (printer: Printer): SupplyItem[] => {
    const supplies: SupplyItem[] = []

    // Agregar tóner negro (siempre disponible)
    supplies.push({
      id: generateId(),
      type: 'toner_black',
      description: `Tóner Negro - ${printer.brand} ${printer.model}`,
      quantity: 1,
      code: printer.toner_black_code || 'No especificado'
    })

    // Agregar tóners de color solo si la impresora es a color
    if (printer.is_color) {
      supplies.push({
        id: generateId(),
        type: 'toner_cyan',
        description: `Tóner Cian - ${printer.brand} ${printer.model}`,
        quantity: 1,
        code: printer.toner_cyan_code || 'No especificado'
      })

      supplies.push({
        id: generateId(),
        type: 'toner_magenta',
        description: `Tóner Magenta - ${printer.brand} ${printer.model}`,
        quantity: 1,
        code: printer.toner_magenta_code || 'No especificado'
      })

      supplies.push({
        id: generateId(),
        type: 'toner_yellow',
        description: `Tóner Amarillo - ${printer.brand} ${printer.model}`,
        quantity: 1,
        code: printer.toner_yellow_code || 'No especificado'
      })
    }

    // Agregar insumos comunes
    supplies.push({
      id: generateId(),
      type: 'unidad_imagen',
      description: `Unidad de Imagen - ${printer.brand} ${printer.model}`,
      quantity: 1,
      code: 'Por especificar'
    })

    supplies.push({
      id: generateId(),
      type: 'papel',
      description: 'Papel A4 75g/m²',
      quantity: 5,
      code: 'Estándar'
    })

    supplies.push({
      id: generateId(),
      type: 'papel',
      description: 'Papel A4 80g/m²',
      quantity: 5,
      code: 'Premium'
    })

    supplies.push({
      id: generateId(),
      type: 'otro',
      description: `Kit de Mantenimiento - ${printer.brand} ${printer.model}`,
      quantity: 1,
      code: 'Por especificar'
    })

    supplies.push({
      id: generateId(),
      type: 'otro',
      description: `Fusor - ${printer.brand} ${printer.model}`,
      quantity: 1,
      code: 'Por especificar'
    })

    supplies.push({
      id: generateId(),
      type: 'otro',
      description: `Tambor - ${printer.brand} ${printer.model}`,
      quantity: 1,
      code: 'Por especificar'
    })

    return supplies
  }

  // Función para abrir el modal de insumos
  const openSuppliesModal = () => {
    if (!selectedPrinter) {
      alert('Por favor seleccione una impresora primero')
      return
    }

    const supplies = generateAvailableSupplies(selectedPrinter)
    setAvailableSupplies(supplies)
    setShowSuppliesModal(true)
  }

  // Función para agregar insumo desde el modal
  const addSupplyFromModal = (supply: SupplyItem) => {
    // Verificar si ya existe este tipo de insumo
    const existingSupply = formData.supplies.find(s => 
      s.type === supply.type && s.code === supply.code
    )

    if (existingSupply) {
      // Si ya existe, incrementar la cantidad
      setFormData(prev => ({
        ...prev,
        supplies: prev.supplies.map(s => 
          s.id === existingSupply.id 
            ? { ...s, quantity: s.quantity + supply.quantity }
            : s
        )
      }))
    } else {
      // Si no existe, agregar nuevo
      const newItem: SupplyItem = {
        ...supply,
        id: generateId() // Generar nuevo ID
      }

      setFormData(prev => ({
        ...prev,
        supplies: [...prev.supplies, newItem]
      }))
    }
  }

  // Función para agregar un insumo a la lista
  const addSupplyItem = () => {
    if (!newSupply.description.trim()) {
      alert('Por favor ingrese una descripción para el insumo')
      return
    }

    // Para toners, usar el código de la impresora si está disponible
    let code = newSupply.code
    if (selectedPrinter && newSupply.type.startsWith('toner_') && !code) {
      switch (newSupply.type) {
        case 'toner_black':
          code = selectedPrinter.toner_black_code || ''
          break
        case 'toner_cyan':
          code = selectedPrinter.toner_cyan_code || ''
          break
        case 'toner_magenta':
          code = selectedPrinter.toner_magenta_code || ''
          break
        case 'toner_yellow':
          code = selectedPrinter.toner_yellow_code || ''
          break
      }
    }

    const newItem: SupplyItem = {
      id: generateId(),
      type: newSupply.type,
      description: newSupply.description,
      quantity: newSupply.quantity,
      code: code
    }

    setFormData(prev => ({
      ...prev,
      supplies: [...prev.supplies, newItem]
    }))

    // Limpiar formulario
    setNewSupply({
      type: 'toner_black',
      description: '',
      quantity: 1,
      code: ''
    })
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

                {/* Sección de Agregar Insumos */}
                {selectedPrinter && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Agregar Insumo</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Tipo de insumo */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de Insumo
                        </label>
                        <select
                          value={newSupply.type}
                          onChange={(e) => setNewSupply(prev => ({
                            ...prev, 
                            type: e.target.value as SupplyItem['type'],
                            // Pre-llenar código si es tóner
                            code: e.target.value.startsWith('toner_') ? (
                              selectedPrinter?.[`${e.target.value}_code` as keyof Printer] as string || ''
                            ) : ''
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(SUPPLY_TYPES).map(([key, value]) => {
                            // Solo mostrar tóners de color si la impresora es a color
                            if (!selectedPrinter.is_color && ['toner_cyan', 'toner_magenta', 'toner_yellow'].includes(key)) {
                              return null
                            }
                            return (
                              <option key={key} value={key}>
                                {value.icon} {value.label}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      {/* Cantidad */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newSupply.quantity}
                          onChange={(e) => setNewSupply(prev => ({...prev, quantity: parseInt(e.target.value) || 1}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Descripción */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción
                        </label>
                        <input
                          type="text"
                          value={newSupply.description}
                          onChange={(e) => setNewSupply(prev => ({...prev, description: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={
                            newSupply.type.startsWith('toner_') ? 'Ej: Tóner original HP' :
                            newSupply.type === 'unidad_imagen' ? 'Ej: Unidad de imagen original' :
                            newSupply.type === 'papel' ? 'Ej: Papel A4 75g' :
                            'Descripción del insumo'
                          }
                        />
                      </div>

                      {/* Código (opcional) */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Código (Opcional)
                        </label>
                        <input
                          type="text"
                          value={newSupply.code}
                          onChange={(e) => setNewSupply(prev => ({...prev, code: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Código específico del insumo"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex space-x-3">
                      <button
                        type="button"
                        onClick={addSupplyItem}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Agregar Manualmente
                      </button>
                      <button
                        type="button"
                        onClick={openSuppliesModal}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        📦 Ver Insumos Disponibles
                      </button>
                    </div>
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
      
      {/* Modal de Insumos Disponibles */}
      {showSuppliesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header del modal */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Insumos Disponibles
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
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Haga clic en "Agregar" para incluir el insumo en su solicitud. 
                  Puede ajustar la cantidad después de agregarlo.
                </p>
              </div>

              {/* Tabla de insumos */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad Sugerida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {availableSupplies.map((supply, index) => (
                      <tr key={supply.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-2">{SUPPLY_TYPES[supply.type].icon}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {SUPPLY_TYPES[supply.type].label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{supply.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            supply.code === 'No especificado' || supply.code === 'Por especificar'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {supply.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {supply.quantity} {supply.type === 'papel' ? 'resmas' : 'unidad(es)'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              addSupplyFromModal(supply)
                              // Mostrar confirmación visual
                              const button = document.getElementById(`add-btn-${supply.id}`)
                              if (button) {
                                const originalText = button.textContent
                                button.textContent = '✓ Agregado'
                                button.className = button.className.replace('bg-blue-600 hover:bg-blue-700', 'bg-green-600')
                                setTimeout(() => {
                                  button.textContent = originalText
                                  button.className = button.className.replace('bg-green-600', 'bg-blue-600 hover:bg-blue-700')
                                }, 1500)
                              }
                            }}
                            id={`add-btn-${supply.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Agregar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  💡 Tip: Los códigos mostrados provienen de la configuración de la impresora
                </div>
                <button
                  onClick={() => setShowSuppliesModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}