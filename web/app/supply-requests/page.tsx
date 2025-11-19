'use client'
import { useState, useEffect } from 'react'

interface Printer {
  id: number
  brand: string
  model: string
  asset_tag: string
  location?: string
  department?: string
  serial_number?: string
  status?: string
}

interface SupplyItem {
  id: string
  type: string
  description: string
  quantity: number
  code: string
}

const TONER_REQUEST_API_BASE = 'http://localhost:8000/api'
console.log('TONER_REQUEST_API_BASE configured as:', TONER_REQUEST_API_BASE)

const SUPPLY_TYPES = {
  toner_black: 'Tóner Negro',
  toner_cyan: 'Tóner Cian',
  toner_magenta: 'Tóner Magenta', 
  toner_yellow: 'Tóner Amarillo',
  unidad_imagen: 'Unidad de Imagen',
  papel: 'Papel',
  otros: 'Otros'
}

// Componente ProductSelector
function ProductSelector({ 
  itemType, 
  onSelect, 
  selectedCode, 
  printerSupplies 
}: { 
  itemType: string
  onSelect: (item: any) => void
  selectedCode?: string
  printerSupplies: any[]
}) {
  const [availableItems, setAvailableItems] = useState<any[]>([])

  useEffect(() => {
    if (!printerSupplies || printerSupplies.length === 0) {
      setAvailableItems([])
      return
    }

    // Filtrar items según el tipo
    const filteredItems = printerSupplies.filter(item => {
      if (itemType === 'toner_black') {
        return item.item_type === 'toner' && 
               (item.item_name.toLowerCase().includes('negro') || 
                item.item_code.toLowerCase().includes('bk') || 
                item.item_code.toLowerCase().includes('black'))
      } else if (itemType === 'toner_cyan') {
        return item.item_type === 'toner' && 
               (item.item_name.toLowerCase().includes('cian') || 
                item.item_code.toLowerCase().includes('cy') || 
                item.item_code.toLowerCase().includes('cyan'))
      } else if (itemType === 'toner_magenta') {
        return item.item_type === 'toner' && 
               (item.item_name.toLowerCase().includes('magenta') || 
                item.item_code.toLowerCase().includes('mg'))
      } else if (itemType === 'toner_yellow') {
        return item.item_type === 'toner' && 
               (item.item_name.toLowerCase().includes('amarillo') || 
                item.item_code.toLowerCase().includes('yl') || 
                item.item_code.toLowerCase().includes('yellow'))
      } else if (itemType === 'papel') {
        return item.item_type === 'papel'
      } else if (itemType === 'unidad_imagen') {
        return (item.item_type === 'repuesto' || item.item_type === 'otro') && 
               (item.item_name.toLowerCase().includes('imagen') || 
                item.item_name.toLowerCase().includes('drum'))
      } else {
        return (item.item_type === 'repuesto' || item.item_type === 'otro') && 
               !(item.item_name.toLowerCase().includes('imagen') || 
                 item.item_name.toLowerCase().includes('drum'))
      }
    })
    
    setAvailableItems(filteredItems)
    
    // Si solo hay un item disponible, seleccionarlo automáticamente
    if (filteredItems.length === 1 && !selectedCode) {
      console.log(`Auto-seleccionando único producto para ${itemType}:`, filteredItems[0])
      onSelect(filteredItems[0])
    }
  }, [itemType, printerSupplies, selectedCode, onSelect])

  return (
    <select
      value={selectedCode || ''}
      onChange={(e) => {
        const selectedItem = availableItems.find(item => item.item_code === e.target.value)
        onSelect(selectedItem || null)
      }}
      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      disabled={availableItems.length === 1} // Deshabilitar si solo hay uno
    >
      <option value="">
        {availableItems.length === 0 
          ? 'No hay productos disponibles' 
          : availableItems.length === 1 
          ? `${availableItems[0].item_name} (${availableItems[0].item_code})` 
          : 'Seleccionar producto...'}
      </option>
      {availableItems.length > 1 && availableItems.map((item) => (
        <option key={item.id} value={item.item_code}>
          {item.item_name} ({item.item_code})
        </option>
      ))}
    </select>
  )
}

export default function SupplyRequestsCompactPage() {
  console.log('=== COMPONENTE INICIANDO ===')
  console.log('Componente SupplyRequestsCompactPage renderizándose')
  console.log('typeof window:', typeof window)
  console.log('window defined:', typeof window !== 'undefined')
  
  // Estado para controlar la hidratación
  const [isMounted, setIsMounted] = useState(false)
  
  // Estados principales
  const [activeTab, setActiveTab] = useState<'insumos' | 'servicio'>('insumos')
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [filteredPrinters, setFilteredPrinters] = useState<Printer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [renderCounter, setRenderCounter] = useState(0)
  const [lastAddedRequestId, setLastAddedRequestId] = useState<number | null>(null)
  const [allRequests, setAllRequests] = useState<any[]>([]) // Para almacenar todas las solicitudes
  const [dataLoaded, setDataLoaded] = useState(false)
  
  console.log('*** ESTADOS INICIALIZADOS - dataLoaded:', dataLoaded, '***')
  console.log('*** PENDING REQUESTS LENGTH EN RENDER:', pendingRequests.length, '***')
  
  // Estados de notificación
  const [notification, setNotification] = useState<{
    show: boolean
    type: 'success' | 'error'
    title: string
    message: string
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  })
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    supplies: [] as SupplyItem[],
    notes: '',
    requested_by: '',
    department: '',
    priority: 'normal',
    service_type: '',
    problem_description: '',
    urgency_level: 'normal',
    preferred_date: '',
    contact_phone: '',
    service_notes: ''
  })

  // Estados del modal de insumos
  const [showSupplyModal, setShowSupplyModal] = useState(false)
  const [modalSupplies, setModalSupplies] = useState<SupplyItem[]>([])
  const [printerSupplyItems, setPrinterSupplyItems] = useState<any[]>([])

  // Función para generar ID temporal
  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Funciones para notificaciones
  const showNotification = (type: 'success' | 'error', title: string, message: string) => {
    setNotification({
      show: true,
      type,
      title,
      message
    })
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }))
    }, 5000)
  }

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, show: false }))
  }

  // Función para categorizar insumos
  const categorizarInsumo = (stockItems: any[]) => {
    return stockItems.map(item => {
      const itemName = item.item_name.toLowerCase()
      const itemCode = item.item_code.toLowerCase()
      
      if (item.item_type === 'toner') {
        if (itemName.includes('negro') || itemCode.includes('bk') || itemCode.includes('black')) {
          return { ...item, supply_type: 'toner_black' }
        } else if (itemName.includes('cian') || itemCode.includes('cy') || itemCode.includes('cyan')) {
          return { ...item, supply_type: 'toner_cyan' }
        } else if (itemName.includes('magenta') || itemCode.includes('mg')) {
          return { ...item, supply_type: 'toner_magenta' }
        } else if (itemName.includes('amarillo') || itemCode.includes('yl') || itemCode.includes('yellow')) {
          return { ...item, supply_type: 'toner_yellow' }
        } else {
          return { ...item, supply_type: 'toner_black' } // Default
        }
      } else if (item.item_type === 'papel') {
        return { ...item, supply_type: 'papel' }
      } else if (item.item_type === 'repuesto' || item.item_type === 'otro') {
        if (itemName.includes('imagen') || itemName.includes('drum')) {
          return { ...item, supply_type: 'unidad_imagen' }
        } else {
          return { ...item, supply_type: 'otros' }
        }
      } else {
        return { ...item, supply_type: 'otros' }
      }
    })
  }

  // Función para cargar insumos de una impresora específica
  const loadPrinterSupplies = async (printerId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/printers/${printerId}/supplies/`)
      if (response.ok) {
        const printerSupplies = await response.json()
        
        if (printerSupplies && printerSupplies.length > 0) {
          // Cargar detalles de los ítems del stock
          const stockResponse = await fetch('http://localhost:8000/stock/items/')
          if (stockResponse.ok) {
            const stockItems = await stockResponse.json()
            
            // Mapear los supplies de la impresora con los detalles del stock
            const printerStockItems = printerSupplies.map((supply: any) => {
              const stockItem = stockItems.find((item: any) => item.id === supply.stock_item_id)
              return {
                ...stockItem,
                supply_id: supply.id
              }
            }).filter(Boolean) // Filtrar items que no se encontraron
          
            setPrinterSupplyItems(categorizarInsumo(printerStockItems))
            console.log('Printer supply items loaded:', categorizarInsumo(printerStockItems))
          } else {
            setPrinterSupplyItems([])
          }
        } else {
          setPrinterSupplyItems([])
        }
      } else {
        console.error('Error loading printer supplies')
        setPrinterSupplyItems([])
      }
    } catch (error) {
      console.error('Error:', error)
      setPrinterSupplyItems([])
    }
  }

  // Función para abrir modal de insumos
  const openSupplyModal = (printer: Printer) => {
    console.log('Opening supply modal for printer:', printer)
    setSelectedPrinter(printer)
    setModalSupplies([])
    loadPrinterSupplies(printer.id)
    setShowSupplyModal(true)
  }

  // Función para cerrar modal de insumos
  const closeSupplyModal = () => {
    setShowSupplyModal(false)
    // NO resetear selectedPrinter aquí para mantener el formulario visible
    setModalSupplies([])
    setPrinterSupplyItems([])
  }

  // Función para agregar fila de insumo
  const addSupplyRow = () => {
    const newSupply: SupplyItem = {
      id: generateTempId(),
      type: 'toner_black',
      description: '',
      quantity: 1,
      code: ''
    }
    console.log('Adding new supply row:', newSupply)
    setModalSupplies(prevSupplies => {
      const updatedSupplies = [...prevSupplies, newSupply]
      console.log('Modal supplies after adding row:', updatedSupplies)
      return updatedSupplies
    })
  }

  // Función para actualizar fila en modal
  const updateRowInModal = (id: string, field: keyof SupplyItem, value: any) => {
    console.log(`Updating ${field} for ${id}:`, value)
    setModalSupplies(prevSupplies => {
      const updatedSupplies = prevSupplies.map(supply => 
        supply.id === id ? { ...supply, [field]: value } : supply
      )
      console.log('Updated supplies after change:', updatedSupplies)
      return updatedSupplies
    })
  }

  // Función para remover item de insumo
  const removeSupplyItem = (id: string) => {
    setModalSupplies(prevSupplies => prevSupplies.filter(supply => supply.id !== id))
  }

  // Función para guardar insumos del modal
  const saveSuppliesFromModal = () => {
    console.log('=== SAVE SUPPLIES DEBUG ===')
    console.log('Total modal supplies:', modalSupplies.length)
    console.log('Modal supplies complete data:', modalSupplies)
    
    modalSupplies.forEach((supply, index) => {
      console.log(`Supply ${index + 1}:`, {
        id: supply.id,
        type: supply.type,
        description: supply.description,
        descriptionLength: supply.description ? supply.description.trim().length : 0,
        quantity: supply.quantity,
        code: supply.code,
        isDescriptionValid: supply.description && supply.description.trim() !== '',
        isQuantityValid: supply.quantity > 0,
        isValid: supply.description && supply.description.trim() !== '' && supply.quantity > 0
      })
    })
    
    const validSupplies = modalSupplies.filter(supply => 
      supply.description && supply.description.trim() !== '' && supply.quantity > 0
    )
    
    console.log('Valid supplies after filter:', validSupplies.length)
    console.log('Valid supplies data:', validSupplies)
    
    if (validSupplies.length === 0) {
      console.log('ERROR: No valid supplies found!')
      showNotification('error', 'Error en insumos', 'Debe agregar al menos un insumo válido')
      return
    }

    // Agregar todas las solicitudes válidas
    console.log('Adding valid supplies to formData:', validSupplies)
    setFormData(prev => {
      const updatedFormData = {
        ...prev,
        supplies: [...prev.supplies, ...validSupplies]
      }
      console.log('FormData supplies updated:', updatedFormData.supplies)
      return updatedFormData
    })

    closeSupplyModal()
  }

  // Función para validar formulario
  const validateForm = () => {
    if (!selectedPrinter) {
      showNotification('error', 'Selección requerida', 'Debe seleccionar una impresora')
      return false
    }

    if (activeTab === 'insumos') {
      if (formData.supplies.length === 0) {
        showNotification('error', 'Insumos requeridos', 'Debe agregar al menos un insumo')
        return false
      }
    } else {
      if (!formData.service_type || !formData.problem_description) {
        showNotification('error', 'Datos incompletos', 'Debe completar el tipo de servicio y la descripción del problema')
        return false
      }
    }

    if (!formData.requested_by.trim()) {
      showNotification('error', 'Campo requerido', 'Debe especificar quien solicita')
      return false
    }

    if (!formData.department.trim()) {
      showNotification('error', 'Campo requerido', 'Debe especificar el departamento')
      return false
    }

    return true
  }

  // Función para enviar la solicitud
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      let requestData
      
      if (activeTab === 'insumos') {
        // Convertir la lista de insumos al formato del backend
        requestData = {
          printer_id: selectedPrinter!.id,
          supply_type: 'insumos',
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
      } else {
        // Solicitud de servicio
        requestData = {
          printer_id: selectedPrinter!.id,
          supply_type: 'servicio',
          toner_black_requested: false,
          toner_cyan_requested: false,
          toner_magenta_requested: false,
          toner_yellow_requested: false,
          other_supplies_requested: `SERVICIO: ${formData.service_type} - ${formData.problem_description}`,
          notes: `Tipo de Servicio: ${formData.service_type}\nDescripción: ${formData.problem_description}\nUrgencia: ${formData.urgency_level}\nFecha Preferida: ${formData.preferred_date || 'Sin preferencia'}\nTeléfono: ${formData.contact_phone || 'No especificado'}\nNotas: ${formData.service_notes}`,
          requested_by: formData.requested_by,
          department: formData.department,
          priority: formData.urgency_level,
          service_type: formData.service_type,
          problem_description: formData.problem_description,
          urgency_level: formData.urgency_level,
          preferred_date: formData.preferred_date,
          contact_phone: formData.contact_phone,
          service_notes: formData.service_notes
        }
      }

      const response = await fetch(`${TONER_REQUEST_API_BASE}/toner-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        const responseData = await response.json()
        const solicitudId = responseData.id
        const tipoSolicitud = activeTab === 'insumos' ? 'insumos' : 'servicio'
        
        // Guardar el ID de la nueva solicitud para destacarla
        setLastAddedRequestId(solicitudId)
        
        // Mostrar notificación de éxito con ID
        showNotification(
          'success',
          '¡Solicitud creada exitosamente!',
          `ID: #${solicitudId}\n` +
          `Tipo: Solicitud de ${tipoSolicitud}\n` +
          `Impresora: ${selectedPrinter!.brand} ${selectedPrinter!.model}\n` +
          `Solicitado por: ${formData.requested_by}`
        )
        
        console.log('Solicitud creada exitosamente:', responseData)
        
        // Limpiar formulario
        setFormData({
          supplies: [],
          notes: '',
          requested_by: '',
          department: '',
          priority: 'normal',
          service_type: '',
          problem_description: '',
          urgency_level: 'normal',
          preferred_date: '',
          contact_phone: '',
          service_notes: ''
        })
        setSelectedPrinter(null)
        setSearchQuery('')
        
        // Recargar solicitudes pendientes
        fetchPendingRequests()
        
        // Quitar el destacado después de 10 segundos
        setTimeout(() => {
          setLastAddedRequestId(null)
        }, 10000)
        
      } else {
        // Manejo de errores del servidor
        let errorMessage = 'Error desconocido'
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || 'Error del servidor'
        } catch (parseError) {
          errorMessage = `Error HTTP ${response.status}: ${response.statusText}`
        }
        
        showNotification(
          'error',
          'Error al crear la solicitud',
          `Estado: ${response.status}\n` +
          `Detalle: ${errorMessage}\n\n` +
          `Por favor, verifique los datos e intente nuevamente.`
        )
        
        console.error('Error del servidor:', response.status, errorMessage)
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      showNotification(
        'error',
        'Error de conexión',
        `No se pudo conectar con el servidor.\n` +
        `Verifique su conexión a internet e intente nuevamente.\n\n` +
        `Error técnico: ${error instanceof Error ? error.message : 'Error desconocido'}`
      )
    } finally {
      setLoading(false)
    }
  }

  // Función para cargar impresoras
  const fetchPrinters = async () => {
    console.log('fetchPrinters ejecutándose')
    try {
      const response = await fetch('http://localhost:8000/printers/')
      if (response.ok) {
        const data = await response.json()
        console.log('Impresoras cargadas:', data.length)
        setPrinters(data)
        setFilteredPrinters(data)
      }
    } catch (error) {
      console.error('Error fetching printers:', error)
    }
  }

  // Función para cargar solicitudes pendientes
  // Función para obtener solicitudes ordenadas por impresora seleccionada
  const getOrderedRequests = () => {
    if (!selectedPrinter || allRequests.length === 0) {
      return pendingRequests
    }

    // Filtrar solicitudes de la impresora seleccionada
    const printerRequests = allRequests.filter(request => 
      request.printer_brand === selectedPrinter.brand && 
      request.printer_model === selectedPrinter.model &&
      request.status === 'pending'
    )

    // Filtrar solicitudes de otras impresoras (solo pendientes)
    const otherRequests = pendingRequests.filter(request => 
      !(request.printer_brand === selectedPrinter.brand && 
        request.printer_model === selectedPrinter.model)
    )

    // Combinar: primero las de la impresora seleccionada, luego las otras
    return [...printerRequests, ...otherRequests]
  }

  const fetchPendingRequests = async () => {
    try {
      const timestamp = new Date().getTime()
      // Traer todas las solicitudes para poder filtrar por impresora
      const url = `http://localhost:8000/api/toner-requests?_t=${timestamp}`
      
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Solicitudes cargadas:', data.length)
        
        // Ordenar de más nueva a más vieja
        const sortedData = data.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        
        // Almacenar todas las solicitudes
        setAllRequests(sortedData)
        
        // Filtrar solo las pendientes para mostrar en la columna derecha
        const pendingOnly = sortedData.filter((request: any) => request.status === 'pending')
        
        setPendingRequests(pendingOnly)
        setRenderCounter(prev => prev + 1)
      } else {
        console.error('Error response:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  // Efecto para controlar la hidratación
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Test useEffect para debug
  useEffect(() => {
    console.log('*** useEffect EJECUTÁNDOSE ***')
    console.log('window en useEffect:', typeof window)
    
    // Cargar impresoras
    fetchPrinters()
    
    // Cargar solicitudes pendientes
    console.log('Llamando fetchPendingRequests desde useEffect...')
    fetchPendingRequests()
  }, [])

  // Efecto adicional para asegurar la carga
  useEffect(() => {
    console.log('*** SEGUNDO useEffect - FORZANDO CARGA ***')
    const timer = setTimeout(() => {
      console.log('Timer ejecutándose - forzando carga de solicitudes')
      fetchPendingRequests()
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [])

  // Efecto para monitorear cambios en pendingRequests
  useEffect(() => {
    console.log('*** CAMBIO EN PENDING REQUESTS ***', pendingRequests.length)
  }, [pendingRequests])

  // useEffect para refrescar cuando cambie la impresora seleccionada
  useEffect(() => {
    if (selectedPrinter) {
      console.log('Impresora seleccionada:', selectedPrinter.brand, selectedPrinter.model);
      setRenderCounter(prev => prev + 1); // Forzar re-render
    }
  }, [selectedPrinter]);

  // SIMPLE: Solo ejecutar desde el cliente una vez cuando el componente se monta
  useEffect(() => {
    console.log('*** SIMPLE useEffect - MONTAJE DEL COMPONENTE ***')
    console.log('Ejecutando desde:', typeof window === 'undefined' ? 'SERVIDOR' : 'CLIENTE')
    
    // Ejecutar siempre, tanto desde servidor como cliente
    console.log('Cargando datos...')
    fetchPrinters()
    fetchPendingRequests()
  }, [])

  // Efecto para filtrar impresoras
  useEffect(() => {
    let filtered = printers

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = printers.filter(printer => 
        printer.brand.toLowerCase().includes(query) ||
        printer.model.toLowerCase().includes(query) ||
        (printer.asset_tag && printer.asset_tag.toLowerCase().includes(query)) ||
        (printer.location && printer.location.toLowerCase().includes(query)) ||
        (printer.department && printer.department.toLowerCase().includes(query))
      )
    }

    setFilteredPrinters(filtered)
  }, [printers, searchQuery])

  // Log del render
  console.log('Rendering form with supplies:', formData.supplies)
  console.log('Current formData.supplies length:', formData.supplies.length)

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header compacto */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Solicitud de Servicio/Insumos</h1>
          
          {/* Tabs inline */}
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('insumos')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'insumos'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Solicitud de Insumos
            </button>
            <button
              onClick={() => setActiveTab('servicio')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'servicio'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Solicitud de Servicio
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          
          {/* Panel izquierdo: Selección de impresora (25%) */}
          <div className="col-span-3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Seleccionar Impresora</h2>
            </div>
            
            {/* Búsqueda compacta */}
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                placeholder="Buscar impresora..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Lista de impresoras */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPrinters.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No se encontraron impresoras
                </div>
              ) : (
                filteredPrinters.map((printer) => (
                  <div
                    key={printer.id}
                    onClick={() => setSelectedPrinter(printer)}
                    className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                      selectedPrinter?.id === printer.id
                        ? 'bg-blue-50 border-2 border-blue-200'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {printer.brand} {printer.model}
                    </div>
                    <div className="text-xs text-gray-600">
                      {printer.asset_tag} • {printer.location}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Panel central: Formulario (50%) */}
          <div className="col-span-6 bg-white rounded-lg shadow overflow-hidden flex flex-col">
            {selectedPrinter ? (
              <>
                {/* Header del formulario */}
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {activeTab === 'insumos' ? 'Solicitud de Insumos' : 'Solicitud de Servicio'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedPrinter.brand} {selectedPrinter.model} - {selectedPrinter.asset_tag}
                  </p>
                </div>

                {/* Contenido del formulario */}
                <div className="flex-1 overflow-y-auto p-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {activeTab === 'insumos' ? (
                      <>
                        {/* Sección de Insumos */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Insumos Solicitados
                            </label>
                            <button
                              type="button"
                              onClick={() => openSupplyModal(selectedPrinter)}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Agregar Insumos
                            </button>
                          </div>
                          
                          {formData.supplies.length === 0 ? (
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
                              No hay insumos agregados
                            </div>
                          ) : (
                            <div className="border border-gray-200 rounded">
                              {formData.supplies.map((supply, index) => (
                                <div key={supply.id} className="p-3 border-b border-gray-200 last:border-b-0">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <div className="font-medium text-sm">{supply.description}</div>
                                      <div className="text-xs text-gray-600">
                                        Cantidad: {supply.quantity} • Código: {supply.code}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          supplies: prev.supplies.filter(s => s.id !== supply.id)
                                        }))
                                      }}
                                      className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Formulario de Servicio */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tipo de Servicio
                            </label>
                            <select
                              value={formData.service_type}
                              onChange={(e) => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                            >
                              <option value="">Seleccionar...</option>
                              <option value="mantenimiento">Mantenimiento Preventivo</option>
                              <option value="reparacion">Reparación</option>
                              <option value="instalacion">Instalación</option>
                              <option value="configuracion">Configuración</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nivel de Urgencia
                            </label>
                            <select
                              value={formData.urgency_level}
                              onChange={(e) => setFormData(prev => ({ ...prev, urgency_level: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="baja">Baja</option>
                              <option value="normal">Normal</option>
                              <option value="alta">Alta</option>
                              <option value="critica">Crítica</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descripción del Problema
                          </label>
                          <textarea
                            value={formData.problem_description}
                            onChange={(e) => setFormData(prev => ({ ...prev, problem_description: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={3}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Fecha Preferida
                            </label>
                            <input
                              type="date"
                              value={formData.preferred_date}
                              onChange={(e) => setFormData(prev => ({ ...prev, preferred_date: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Teléfono de Contacto
                            </label>
                            <input
                              type="tel"
                              value={formData.contact_phone}
                              onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Campos comunes */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Solicitado por
                        </label>
                        <input
                          type="text"
                          value={formData.requested_by}
                          onChange={(e) => setFormData(prev => ({ ...prev, requested_by: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notas Adicionales
                      </label>
                      <textarea
                        value={activeTab === 'insumos' ? formData.notes : formData.service_notes}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          [activeTab === 'insumos' ? 'notes' : 'service_notes']: e.target.value 
                        }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            supplies: [],
                            notes: '',
                            requested_by: '',
                            department: '',
                            priority: 'normal',
                            service_type: '',
                            problem_description: '',
                            urgency_level: 'normal',
                            preferred_date: '',
                            contact_phone: '',
                            service_notes: ''
                          })
                          setSelectedPrinter(null)
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 border border-transparent rounded-md hover:bg-blue-600 disabled:opacity-50"
                      >
                        {loading ? 'Guardando...' : 'Crear Solicitud'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg mb-2">Seleccione una impresora</div>
                  <div className="text-sm">Elija una impresora de la lista para continuar</div>
                </div>
              </div>
            )}
          </div>

        {/* Panel derecho: Solicitudes Pendientes (25%) */}
        <div className="col-span-3" key={`pending-requests-${pendingRequests.length}-${renderCounter}`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Solicitudes Pendientes</h2>
              <p className="text-sm text-gray-500 mt-1">
                Total: {getOrderedRequests().length}
                {selectedPrinter && (
                  <span className="ml-2 text-blue-600">
                    ({getOrderedRequests().filter(r => 
                      r.printer_brand === selectedPrinter.brand && 
                      r.printer_model === selectedPrinter.model
                    ).length} del equipo seleccionado)
                  </span>
                )}
              </p>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {!isMounted ? (
                <div className="text-center text-gray-500 py-8">
                  <p>Cargando solicitudes...</p>
                </div>
              ) : getOrderedRequests().length > 0 ? (
                <div className="space-y-3">
                  {getOrderedRequests().map((request) => {
                    const isNewRequest = lastAddedRequestId === request.id
                    const isSelectedPrinterRequest = selectedPrinter && 
                      request.printer_brand === selectedPrinter.brand && 
                      request.printer_model === selectedPrinter.model
                    return (
                      <div 
                        key={request.id} 
                        className={`p-3 border rounded-lg transition-colors ${
                          isNewRequest 
                            ? 'border-green-400 bg-green-50 shadow-md' 
                            : isSelectedPrinterRequest
                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className={`text-sm font-medium ${
                            isNewRequest 
                              ? 'text-green-900' 
                              : isSelectedPrinterRequest 
                              ? 'text-blue-900'
                              : 'text-gray-900'
                          }`}>
                            #{request.id}
                            {isNewRequest && (
                              <span className="ml-2 px-2 py-1 text-xs bg-green-200 text-green-800 rounded-full">
                                ¡NUEVA!
                              </span>
                            )}
                            {isSelectedPrinterRequest && !isNewRequest && (
                              <span className="ml-2 px-2 py-1 text-xs bg-blue-200 text-blue-800 rounded-full">
                                EQUIPO SELECCIONADO
                              </span>
                            )}
                          </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          request.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {request.status === 'pending' ? 'Pendiente' : 
                           request.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Impresora:</strong> {request.printer_brand} {request.printer_model}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Tipo:</strong> {request.other_supplies_requested && request.other_supplies_requested.includes('SERVICIO:') ? 'Servicio' : 'Insumos'}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Solicitado por:</strong> {request.requested_by}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(request.created_at).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-sm mb-2">No hay solicitudes pendientes</div>
                  <div className="text-xs">Las nuevas solicitudes aparecerán aquí</div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        </div> {/* Cierre del grid */}
      </div> {/* Cierre del contenido principal */}

      {/* Modal de Insumos */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Agregar Insumos</h3>
                <button
                  onClick={closeSupplyModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <button
                  onClick={addSupplyRow}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Agregar Fila
                </button>
              </div>

              {modalSupplies.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Tipo</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Producto</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Cantidad</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalSupplies.map((supply) => (
                        <tr key={supply.id} className="border-b">
                          <td className="px-4 py-2">
                            <select
                              value={supply.type}
                              onChange={(e) => updateRowInModal(supply.id, 'type', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            >
                              {Object.entries(SUPPLY_TYPES).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <ProductSelector
                              itemType={supply.type}
                              selectedCode={supply.code}
                              onSelect={(item) => {
                                console.log('Product selected:', item)
                                if (item) {
                                  console.log('Setting description to:', item.item_name)
                                  console.log('Setting code to:', item.item_code)
                                  updateRowInModal(supply.id, 'description', item.item_name)
                                  updateRowInModal(supply.id, 'code', item.item_code)
                                } else {
                                  updateRowInModal(supply.id, 'description', '')
                                  updateRowInModal(supply.id, 'code', '')
                                }
                              }}
                              printerSupplies={printerSupplyItems}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              value={supply.quantity}
                              onChange={(e) => updateRowInModal(supply.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => removeSupplyItem(supply.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeSupplyModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveSuppliesFromModal}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 border border-transparent rounded-md hover:bg-blue-600"
                >
                  Guardar Insumos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Componente de Notificación */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full">
          <div className={`rounded-lg shadow-lg p-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {notification.title}
                </h3>
                <div className={`mt-2 text-sm ${
                  notification.type === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">{notification.message}</pre>
                </div>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={closeNotification}
                  className={`inline-flex rounded-md p-1.5 ${
                    notification.type === 'success' 
                      ? 'text-green-500 hover:bg-green-100' 
                      : 'text-red-500 hover:bg-red-100'
                  } focus:outline-none`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}