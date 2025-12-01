'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LeaseContract, ContractStats } from '../../types/contract'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

export default function Contracts() {
  const router = useRouter()
  const [contracts, setContracts] = useState<LeaseContract[]>([])
  const [printers, setPrinters] = useState<any[]>([])
  const [selectedPrinters, setSelectedPrinters] = useState<number[]>([])
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedContract, setSelectedContract] = useState<LeaseContract | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsActiveTab, setDetailsActiveTab] = useState('general')
  const [editingContract, setEditingContract] = useState<LeaseContract | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [editActiveTab, setEditActiveTab] = useState('basic')
  const [isLoadingContractNumber, setIsLoadingContractNumber] = useState(false)
  
  // Tabs configuration for the modal
  const tabs = [
    { id: 'general', label: 'General', icon: '📋' },
    { id: 'costs', label: 'Costos', icon: '💰' },
    { id: 'equipment', label: 'Equipos', icon: '🖨️' },
    { id: 'companies', label: 'Empresas', icon: '🏢' },
    { id: 'dates', label:'Fechas', icon: '📅' },
    { id: 'contact', label: 'Contacto', icon: '📞' }
  ]
  
  const [addForm, setAddForm] = useState({
    contract_number: '',
    contract_name: '',
    supplier: '',
    contract_type: 'cost_per_copy',
    cost_bw_per_copy: 0,
    cost_color_per_copy: 0,
    fixed_monthly_cost: 0,
    fixed_annual_cost: 0,
    included_copies_bw: 0,
    included_copies_color: 0,
    overage_cost_bw: 0,
    overage_cost_color: 0,
    currency: 'ARS',
    exchange_rate: 1.0,
    cost_bw_per_copy_usd: 0,
    cost_color_per_copy_usd: 0,
    fixed_monthly_cost_usd: 0,
    fixed_annual_cost_usd: 0,
    overage_cost_bw_usd: 0,
    overage_cost_color_usd: 0,
    total_printers: 0,
    printers_bw_only: 0,
    printers_color: 0,
    multifunction_devices: 0,
    start_date: '',
    end_date: '',
    renewal_date: '',
    status: 'active',
    auto_renewal: false,
    renewal_notice_days: 30,
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    contact_position: '',
    priority: 'medium',
    department: '',
    cost_center: '',
    budget_code: '',
    internal_notes: '',
    special_conditions: '',
    terms_and_conditions: '',
    notes: ''
  })

  const [exchangeRates, setExchangeRates] = useState({ 
    ARS_to_USD: 0.0011, 
    USD_to_ARS: 900.0,
    last_updated: null,
    rate_date: null,
    source: 'default'
  })

  const [contractPrinters, setContractPrinters] = useState<any[]>([])
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)

  useEffect(() => {
    fetchData()
    fetchExchangeRates()
  }, [])

  // Cargar datos del contrato cuando se abre el modal de edición
  useEffect(() => {
    if (editingContract && showEditForm) {
      // Precargar el formulario con los datos del contrato
      setAddForm({
        contract_number: editingContract.contract_number,
        contract_name: editingContract.contract_name,
        supplier: editingContract.supplier,
        contract_type: editingContract.contract_type,
        cost_bw_per_copy: editingContract.cost_bw_per_copy,
        cost_color_per_copy: editingContract.cost_color_per_copy,
        fixed_monthly_cost: editingContract.fixed_monthly_cost,
        fixed_annual_cost: editingContract.fixed_annual_cost,
        included_copies_bw: editingContract.included_copies_bw,
        included_copies_color: editingContract.included_copies_color,
        overage_cost_bw: editingContract.overage_cost_bw || 0,
        overage_cost_color: editingContract.overage_cost_color || 0,
        currency: editingContract.currency,
        exchange_rate: editingContract.exchange_rate || 1.0,
        cost_bw_per_copy_usd: editingContract.cost_bw_per_copy_usd || 0,
        cost_color_per_copy_usd: editingContract.cost_color_per_copy_usd || 0,
        fixed_monthly_cost_usd: editingContract.fixed_monthly_cost_usd || 0,
        fixed_annual_cost_usd: editingContract.fixed_annual_cost_usd || 0,
        overage_cost_bw_usd: editingContract.overage_cost_bw_usd || 0,
        overage_cost_color_usd: editingContract.overage_cost_color_usd || 0,
        total_printers: editingContract.total_printers || 0,
        printers_bw_only: editingContract.printers_bw_only || 0,
        printers_color: editingContract.printers_color || 0,
        multifunction_devices: editingContract.multifunction_devices || 0,
        start_date: editingContract.start_date ? editingContract.start_date.split('T')[0] : '',
        end_date: editingContract.end_date ? editingContract.end_date.split('T')[0] : '',
        renewal_date: editingContract.renewal_date ? editingContract.renewal_date.split('T')[0] : '',
        status: editingContract.status,
        auto_renewal: editingContract.auto_renewal || false,
        renewal_notice_days: editingContract.renewal_notice_days || 30,
        contact_person: editingContract.contact_person || '',
        contact_email: editingContract.contact_email || '',
        contact_phone: editingContract.contact_phone || '',
        contact_position: editingContract.contact_position || '',
        priority: editingContract.priority || 'medium',
        department: editingContract.department || '',
        cost_center: editingContract.cost_center || '',
        budget_code: editingContract.budget_code || '',
        internal_notes: editingContract.internal_notes || '',
        special_conditions: editingContract.special_conditions || '',
        terms_and_conditions: editingContract.terms_and_conditions || '',
        notes: editingContract.notes || ''
      })

      // Cargar las impresoras asociadas al contrato
      const loadContractPrinters = async () => {
        try {
          const response = await fetch(`${API_BASE}/contracts/${editingContract.id}/printers`)
          if (response.ok) {
            const contractPrintersData = await response.json()
            const printerIds = contractPrintersData.map((p: any) => p.id)
            setSelectedPrinters(printerIds)
          }
        } catch (error) {
          console.error('Error loading contract printers:', error)
        }
      }
      
      loadContractPrinters()
    }
  }, [editingContract, showEditForm])

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts/exchange-rates`)
      const data = await response.json()
      setExchangeRates(data)
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch contracts
      const contractsResponse = await fetch(`${API_BASE}/contracts/`)
      if (contractsResponse.ok) {
        const contractsData = await contractsResponse.json()
        setContracts(contractsData)
      }

      // Fetch stats
      const statsResponse = await fetch(`${API_BASE}/contracts/stats/summary`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Fetch printers
      const printersResponse = await fetch(`${API_BASE}/printers/`)
      if (printersResponse.ok) {
        const printersData = await printersResponse.json()
        setPrinters(printersData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    
    const date = new Date(dateString)
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount
    if (fromCurrency === 'ARS' && toCurrency === 'USD') {
      return amount * exchangeRates.ARS_to_USD
    }
    if (fromCurrency === 'USD' && toCurrency === 'ARS') {
      return amount * exchangeRates.USD_to_ARS
    }
    return amount
  }

  const handleAddSubmit = async (e: any) => {
    e.preventDefault()
    
    try {
      // Validar fechas requeridas
      if (!addForm.start_date || !addForm.end_date) {
        alert('Las fechas de inicio y finalización son obligatorias')
        return
      }

      // Convertir fechas YYYY-MM-DD a formato datetime ISO (YYYY-MM-DDTHH:MM:SS)
      const formatDateToDateTime = (dateString: string) => {
        if (!dateString) return null
        // Si ya tiene hora, dejarlo como está
        if (dateString.includes('T')) return dateString
        // Agregar hora 00:00:00 en zona horaria local
        return `${dateString}T00:00:00`
      }

      // Preparar los datos del contrato incluyendo las impresoras seleccionadas
      const contractData = {
        ...addForm,
        // Convertir fechas a formato datetime
        start_date: formatDateToDateTime(addForm.start_date),
        end_date: formatDateToDateTime(addForm.end_date),
        renewal_date: addForm.renewal_date ? formatDateToDateTime(addForm.renewal_date) : null,
        printer_ids: selectedPrinters
      }
      
      // Determinar si es crear o actualizar
      const isEditing = editingContract !== null
      const url = isEditing 
        ? `${API_BASE}/contracts/${editingContract.id}` 
        : `${API_BASE}/contracts/`
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contractData),
      })

      if (response.ok) {
        await fetchData()
        setShowAddForm(false)
        setShowEditForm(false)
        // Reset form
        setAddForm({
          contract_number: '',
          contract_name: '',
          supplier: '',
          contract_type: 'cost_per_copy',
          cost_bw_per_copy: 0,
          cost_color_per_copy: 0,
          fixed_monthly_cost: 0,
          fixed_annual_cost: 0,
          included_copies_bw: 0,
          included_copies_color: 0,
          overage_cost_bw: 0,
          overage_cost_color: 0,
          currency: 'ARS',
          exchange_rate: 1.0,
          cost_bw_per_copy_usd: 0,
          cost_color_per_copy_usd: 0,
          fixed_monthly_cost_usd: 0,
          fixed_annual_cost_usd: 0,
          overage_cost_bw_usd: 0,
          overage_cost_color_usd: 0,
          total_printers: 0,
          printers_bw_only: 0,
          printers_color: 0,
          multifunction_devices: 0,
          start_date: '',
          end_date: '',
          renewal_date: '',
          status: 'active',
          auto_renewal: false,
          renewal_notice_days: 30,
          contact_person: '',
          contact_email: '',
          contact_phone: '',
          contact_position: '',
          priority: 'medium',
          department: '',
          cost_center: '',
          budget_code: '',
          internal_notes: '',
          special_conditions: '',
          terms_and_conditions: '',
          notes: ''
        })
        // Reset selected printers
        setSelectedPrinters([])
        setEditingContract(null)
        alert(isEditing ? 'Contrato actualizado exitosamente' : 'Contrato creado exitosamente')
      } else {
        const errorData = await response.json()
        // Manejar errores de validación de FastAPI
        if (Array.isArray(errorData.detail)) {
          // Traducir mensajes de error técnicos a mensajes amigables
          const fieldTranslations: Record<string, string> = {
            'start_date': 'Fecha de Inicio',
            'end_date': 'Fecha de Finalización',
            'renewal_date': 'Fecha de Renovación',
            'contract_number': 'Número de Contrato',
            'contract_name': 'Nombre del Contrato',
            'supplier': 'Proveedor',
            'contract_type': 'Tipo de Contrato',
            'currency': 'Moneda',
            'status': 'Estado'
          }
          
          const errorMessages = errorData.detail.map((err: any) => {
            const field = err.loc && err.loc.length > 1 ? err.loc[1] : 'Campo desconocido'
            const fieldName = fieldTranslations[field] || field
            
            // Traducir mensajes comunes
            let message = err.msg
            if (message.includes('Input should be a valid datetime')) {
              message = 'debe tener un formato de fecha válido (AAAA-MM-DD)'
            } else if (message.includes('invalid datetime separator')) {
              message = 'formato de fecha inválido, use el formato AAAA-MM-DD'
            } else if (message.includes('Field required')) {
              message = 'es obligatorio'
            } else if (message.includes('invalid')) {
              message = 'tiene un valor inválido'
            }
            
            return `• ${fieldName}: ${message}`
          }).join('\n')
          
          alert(`No se pudo ${isEditing ? 'actualizar' : 'crear'} el contrato. Por favor corrija los siguientes errores:\n\n${errorMessages}`)
        } else {
          alert(`Error al ${isEditing ? 'actualizar' : 'crear'} contrato: ${errorData.detail || 'Error desconocido'}`)
        }
      }
    } catch (error) {
      console.error('Error al procesar contrato:', error)
      alert('Error de conexión al procesar contrato')
    }
  }

  const handleAddCancel = () => {
    setShowAddForm(false)
    setShowEditForm(false)
    setEditingContract(null)
    // Reset form
    setAddForm({
      contract_number: '',
      contract_name: '',
      supplier: '',
      contract_type: 'cost_per_copy',
      cost_bw_per_copy: 0,
      cost_color_per_copy: 0,
      fixed_monthly_cost: 0,
      fixed_annual_cost: 0,
      included_copies_bw: 0,
      included_copies_color: 0,
      overage_cost_bw: 0,
      overage_cost_color: 0,
      currency: 'ARS',
      exchange_rate: 1.0,
      cost_bw_per_copy_usd: 0,
      cost_color_per_copy_usd: 0,
      fixed_monthly_cost_usd: 0,
      fixed_annual_cost_usd: 0,
      overage_cost_bw_usd: 0,
      overage_cost_color_usd: 0,
      total_printers: 0,
      printers_bw_only: 0,
      printers_color: 0,
      multifunction_devices: 0,
      start_date: '',
      end_date: '',
      renewal_date: '',
      status: 'active',
      auto_renewal: false,
      renewal_notice_days: 30,
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      contact_position: '',
      priority: 'medium',
      department: '',
      cost_center: '',
      budget_code: '',
      internal_notes: '',
      special_conditions: '',
      terms_and_conditions: '',
      notes: ''
    })
    setSelectedPrinters([])
  }

  const handleViewDetails = (contract: LeaseContract) => {
    setSelectedContract(contract)
    setShowDetails(true)
  }

  const handleEdit = async (contract: LeaseContract) => {
    setEditingContract(contract)
    setShowEditForm(true)
  }

  const handleDelete = async (contract: LeaseContract) => {
    if (confirm(`¿Está seguro de que desea eliminar el contrato ${contract.contract_number}?`)) {
      try {
        const response = await fetch(`${API_BASE}/contracts/${contract.id}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          await fetchData()
          alert('Contrato eliminado exitosamente')
        } else {
          const errorData = await response.json()
          alert(`Error al eliminar contrato: ${errorData.detail}`)
        }
      } catch (error) {
        alert('Error de conexión al eliminar contrato')
      }
    }
  }

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Cargando contratos...</p>
        </div>
      </div>
    )
  }

  // Render principal
  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Contratos de Arrendamiento</h1>
          <p className="mt-2 text-gray-600">Administra todos los contratos de equipos de impresión</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Contratos</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.total_contracts}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {stats.status_distribution.find(s => s.status === 'active')?.count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Activos</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.status_distribution.find(s => s.status === 'active')?.count || 0}
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
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{stats.contracts_expiring_soon}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Por Vencer</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.contracts_expiring_soon}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{stats.total_equipment}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Equipos</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.total_equipment}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Valor Total</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${((stats as any)?.total_monthly_cost || 0).toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar contratos..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Filtrar por estado"
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="expired">Expirado</option>
              <option value="pending">Pendiente</option>
            </select>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Nuevo Contrato
            </button>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {contracts.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay contratos</h3>
                <p className="mt-1 text-sm text-gray-500">Comienza creando un nuevo contrato de arrendamiento.</p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Nuevo Contrato
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{contract.contract_number}</div>
                            <div className="text-sm text-gray-500">{contract.contract_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.supplier}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.contract_type === 'cost_per_copy' ? 'Por Copia' : 'Cuota Fija'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            contract.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : contract.status === 'expired' 
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {contract.status === 'active' ? 'Activo' : contract.status === 'expired' ? 'Expirado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.total_printers || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contract.end_date ? new Date(contract.end_date).toLocaleDateString('es-AR') : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            {/* View/Details Button */}
                            <button
                              onClick={() => {
                                setSelectedContract(contract)
                                setShowDetails(true)
                              }}
                              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingContract(contract)
                                setShowEditForm(true)
                              }}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Editar contrato"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            
                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(contract)}
                              className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar contrato"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            )}
          </div>
        </div>
      </div>

      {/* Add Contract Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-11/12 max-w-4xl max-h-[90vh] shadow-lg rounded-md bg-white overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-900">Nuevo Contrato</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleAddSubmit} className="space-y-8" id="contract-form">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab('basic')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'basic'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Información Básica
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('costs')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'costs'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Costos
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dates')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'dates'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Fechas
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('equipment')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'equipment'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Equipos
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('contact')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'contact'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Contacto
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('management')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'management'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Gestión
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('notes')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === 'notes'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Notas
                    </button>
                  </nav>
                </div>

                {/* Basic Information Tab */}
                {activeTab === 'basic' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Número de Contrato *</label>
                      <input
                        type="text"
                        value={addForm.contract_number}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_number: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: C-2024-001"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Contrato *</label>
                      <input
                        type="text"
                        value={addForm.contract_name}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_name: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: Arrendamiento impresoras oficina principal"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor *</label>
                      <input
                        type="text"
                        value={addForm.supplier}
                        onChange={(e) => setAddForm(prev => ({ ...prev, supplier: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: HP Argentina S.A."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Contrato *</label>
                      <select
                        value={addForm.contract_type}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_type: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Seleccione el tipo de contrato"
                      >
                        <option value="cost_per_copy">Costo por Copia</option>
                        <option value="fixed_cost_per_quantity">Costo Fijo por Cantidad</option>
                        <option value="monthly_fixed">Costo Fijo Mensual</option>
                        <option value="annual_fixed">Costo Fijo Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                      <select
                        value={addForm.status}
                        onChange={(e) => setAddForm(prev => ({ ...prev, status: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Estado del contrato"
                      >
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                        <option value="cancelled">Cancelado</option>
                        <option value="expired">Expirado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                      <select
                        value={addForm.currency}
                        onChange={(e) => setAddForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Moneda del contrato"
                      >
                        <option value="ARS">Pesos Argentinos (ARS)</option>
                        <option value="USD">Dólares Estadounidenses (USD)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Costs Tab */}
                {activeTab === 'costs' && (
                  <div className="space-y-8 min-h-[500px]">
                    {/* Costos por Copia */}
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos por Copia</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo B/N por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.cost_bw_per_copy}
                            onChange={(e) => setAddForm(prev => ({ ...prev, cost_bw_per_copy: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.05"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Color por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.cost_color_per_copy}
                            onChange={(e) => setAddForm(prev => ({ ...prev, cost_color_per_copy: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.15"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Costos Fijos */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos Fijos</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Fijo Mensual ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={addForm.fixed_monthly_cost}
                            onChange={(e) => setAddForm(prev => ({ ...prev, fixed_monthly_cost: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="5000.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Fijo Anual ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={addForm.fixed_annual_cost}
                            onChange={(e) => setAddForm(prev => ({ ...prev, fixed_annual_cost: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="60000.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Copias Incluidas */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Copias Incluidas Mensualmente</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Copias Incluidas B/N</label>
                          <input
                            type="number"
                            value={addForm.included_copies_bw}
                            onChange={(e) => setAddForm(prev => ({ ...prev, included_copies_bw: parseInt(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="10000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Copias Incluidas Color</label>
                          <input
                            type="number"
                            value={addForm.included_copies_color}
                            onChange={(e) => setAddForm(prev => ({ ...prev, included_copies_color: parseInt(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="2000"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Costos de Exceso */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos de Exceso</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exceso B/N por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.overage_cost_bw}
                            onChange={(e) => setAddForm(prev => ({ ...prev, overage_cost_bw: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.08"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exceso Color por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.overage_cost_color}
                            onChange={(e) => setAddForm(prev => ({ ...prev, overage_cost_color: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.25"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates Tab */}
                {activeTab === 'dates' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio *</label>
                      <input
                        type="date"
                        value={addForm.start_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, start_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Finalización *</label>
                      <input
                        type="date"
                        value={addForm.end_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, end_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Renovación</label>
                      <input
                        type="date"
                        value={addForm.renewal_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, renewal_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Días de Aviso de Renovación</label>
                      <input
                        type="number"
                        value={addForm.renewal_notice_days}
                        onChange={(e) => setAddForm(prev => ({ ...prev, renewal_notice_days: parseInt(e.target.value) || 30 }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="30"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addForm.auto_renewal}
                          onChange={(e) => setAddForm(prev => ({ ...prev, auto_renewal: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">Renovación Automática</label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Equipment Tab */}
                {activeTab === 'equipment' && (
                  <div className="space-y-8 min-h-[500px]">
                    {/* Resumen de Equipos */}
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Resumen de Equipos</h4>
                      <div className="grid grid-cols-4 gap-x-6 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Total de Impresoras</label>
                          <input
                            type="number"
                            value={addForm.total_printers}
                            onChange={(e) => setAddForm(prev => ({ ...prev, total_printers: parseInt(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            placeholder="5"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Impresoras Solo B/N</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && !printer.is_color;
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Impresoras Color</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && printer.is_color;
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Equipos Multifunción</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && printer.model && printer.model.toLowerCase().includes('mf');
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>

                    {/* Selección de Impresoras */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-semibold text-gray-900">Seleccionar Impresoras para el Contrato</h4>
                        {printers.length > 0 && (
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPrinters(printers.map(p => p.id));
                                setAddForm(prev => ({ ...prev, total_printers: printers.length }));
                              }}
                              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            >
                              Seleccionar Todas
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPrinters([]);
                                setAddForm(prev => ({ ...prev, total_printers: 0 }));
                              }}
                              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                            >
                              Deseleccionar Todas
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                        {printers.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="mt-2">No hay impresoras disponibles</p>
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            {printers.map((printer) => (
                              <div key={printer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedPrinters.includes(printer.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPrinters(prev => [...prev, printer.id]);
                                        setAddForm(prev => ({ ...prev, total_printers: prev.total_printers + 1 }));
                                      } else {
                                        setSelectedPrinters(prev => prev.filter(id => id !== printer.id));
                                        setAddForm(prev => ({ ...prev, total_printers: Math.max(0, prev.total_printers - 1) }));
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {printer.brand} {printer.model}
                                      </span>
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        printer.is_color 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {printer.is_color ? 'Color' : 'B/N'}
                                      </span>
                                      {printer.model && printer.model.toLowerCase().includes('mf') && (
                                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                          Multifunción
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                      <span>📍 {printer.location || 'Sin ubicación'}</span>
                                      <span>🏷️ {printer.asset_tag || 'Sin etiqueta'}</span>
                                      <span className={`inline-flex items-center ${
                                        printer.status === 'active' 
                                          ? 'text-green-600' 
                                          : printer.status === 'maintenance' 
                                          ? 'text-yellow-600' 
                                          : 'text-red-600'
                                      }`}>
                                        ● {printer.status === 'active' ? 'Activa' : 
                                           printer.status === 'maintenance' ? 'Mantenimiento' : 
                                           'Inactiva'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400">
                                  ID: {printer.id}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {selectedPrinters.length > 0 && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="ml-2 text-sm text-indigo-800">
                              {selectedPrinters.length} impresora{selectedPrinters.length !== 1 ? 's' : ''} seleccionada{selectedPrinters.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Tab */}
                {activeTab === 'contact' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Persona de Contacto</label>
                      <input
                        type="text"
                        value={addForm.contact_person}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_person: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cargo/Posición</label>
                      <input
                        type="text"
                        value={addForm.contact_position}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_position: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Gerente de Compras"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email de Contacto</label>
                      <input
                        type="email"
                        value={addForm.contact_email}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_email: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="juan.perez@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono de Contacto</label>
                      <input
                        type="tel"
                        value={addForm.contact_phone}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="+54 11 1234-5678"
                      />
                    </div>
                  </div>
                )}

                {/* Management Tab */}
                {activeTab === 'management' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                      <input
                        type="text"
                        value={addForm.department}
                        onChange={(e) => setAddForm(prev => ({ ...prev, department: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Administración"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costo</label>
                      <input
                        type="text"
                        value={addForm.cost_center}
                        onChange={(e) => setAddForm(prev => ({ ...prev, cost_center: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="CC-001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Código de Presupuesto</label>
                      <input
                        type="text"
                        value={addForm.budget_code}
                        onChange={(e) => setAddForm(prev => ({ ...prev, budget_code: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="PRES-2024-001"
                      />
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                  <div className="space-y-6 min-h-[500px]">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notas Internas</label>
                      <textarea
                        value={addForm.internal_notes}
                        onChange={(e) => setAddForm(prev => ({ ...prev, internal_notes: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Notas para uso interno del equipo..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Condiciones Especiales</label>
                      <textarea
                        value={addForm.special_conditions}
                        onChange={(e) => setAddForm(prev => ({ ...prev, special_conditions: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Condiciones especiales acordadas..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Términos y Condiciones</label>
                      <textarea
                        value={addForm.terms_and_conditions}
                        onChange={(e) => setAddForm(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                        rows={4}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Términos y condiciones del contrato..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notas Adicionales</label>
                      <textarea
                        value={addForm.notes}
                        onChange={(e) => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Cualquier información adicional relevante..."
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>
            
            {/* Form Actions - Fixed at bottom */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="contract-form"
                  className="px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Crear Contrato
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetails && selectedContract && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-11/12 max-w-4xl max-h-[90vh] shadow-lg rounded-md bg-white overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-gray-900">Detalles del Contrato</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailsActiveTab(tab.id)}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        detailsActiveTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* General Tab */}
              {detailsActiveTab === 'general' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Número de Contrato</label>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{selectedContract.contract_number}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Nombre del Contrato</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.contract_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Proveedor</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.supplier}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Tipo de Contrato</label>
                      <p className="mt-1 text-lg text-gray-900">
                        {selectedContract.contract_type === 'cost_per_copy' ? 'Costo por Copia' : 'Costo Fijo'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Estado</label>
                      <span className={`inline-flex mt-1 px-3 py-1 text-sm font-semibold rounded-full ${
                        selectedContract.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : selectedContract.status === 'expired' 
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedContract.status === 'active' ? 'Activo' : selectedContract.status === 'expired' ? 'Expirado' : 'Pendiente'}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Moneda</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.currency}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Costs Tab */}
              {detailsActiveTab === 'costs' && (
                <div className="space-y-8">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Costos por Copia</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Costo B/N por Copia</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.currency} {selectedContract.cost_bw_per_copy.toFixed(4)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Costo Color por Copia</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.currency} {selectedContract.cost_color_per_copy.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Costos Fijos</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Costo Fijo Mensual</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.currency} {selectedContract.fixed_monthly_cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Costo Fijo Anual</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.currency} {selectedContract.fixed_annual_cost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Copias Incluidas</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Copias Incluidas B/N</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.included_copies_bw.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">Copias Incluidas Color</label>
                        <p className="mt-1 text-lg text-gray-900">{selectedContract.included_copies_color.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Equipment Tab */}
              {detailsActiveTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500">Total Impresoras</label>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{selectedContract.total_printers || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500">Solo B/N</label>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{selectedContract.printers_bw_only || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500">Color</label>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{selectedContract.printers_color || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500">Multifunción</label>
                      <p className="mt-2 text-3xl font-bold text-gray-900">{selectedContract.multifunction_devices || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies Tab */}
              {detailsActiveTab === 'companies' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Departamento</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.department || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Centro de Costo</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.cost_center || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Código de Presupuesto</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.budget_code || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates Tab */}
              {detailsActiveTab === 'dates' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Fecha de Inicio</label>
                      <p className="mt-1 text-lg text-gray-900">
                        {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('es-AR') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Fecha de Finalización</label>
                      <p className="mt-1 text-lg text-gray-900">
                        {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('es-AR') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Fecha de Renovación</label>
                      <p className="mt-1 text-lg text-gray-900">
                        {selectedContract.renewal_date ? new Date(selectedContract.renewal_date).toLocaleDateString('es-AR') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Renovación Automática</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.auto_renewal ? 'Sí' : 'No'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Tab */}
              {detailsActiveTab === 'contact' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Persona de Contacto</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.contact_person || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Cargo/Posición</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.contact_position || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.contact_email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Teléfono</label>
                      <p className="mt-1 text-lg text-gray-900">{selectedContract.contact_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contract Modal */}
      {showEditForm && editingContract && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-11/12 max-w-4xl max-h-[90vh] shadow-lg rounded-md bg-white overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-900">Editar Contrato</h3>
              <p className="mt-1 text-sm text-gray-500">Modificando: {editingContract.contract_number}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleAddSubmit} className="space-y-8" id="contract-edit-form">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('basic')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'basic'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Información Básica
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('costs')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'costs'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Costos
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('dates')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'dates'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Fechas
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('equipment')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'equipment'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Equipos
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('contact')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'contact'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Contacto
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('management')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'management'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Gestión
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActiveTab('notes')}
                      className={`py-3 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        editActiveTab === 'notes'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Notas
                    </button>
                  </nav>
                </div>

                {/* Basic Information Tab */}
                {editActiveTab === 'basic' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Número de Contrato *</label>
                      <input
                        type="text"
                        value={addForm.contract_number}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_number: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: C-2024-001"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Contrato *</label>
                      <input
                        type="text"
                        value={addForm.contract_name}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_name: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: Arrendamiento impresoras oficina principal"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor *</label>
                      <input
                        type="text"
                        value={addForm.supplier}
                        onChange={(e) => setAddForm(prev => ({ ...prev, supplier: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Ej: HP Argentina S.A."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Contrato *</label>
                      <select
                        value={addForm.contract_type}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contract_type: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Seleccione el tipo de contrato"
                      >
                        <option value="cost_per_copy">Costo por Copia</option>
                        <option value="fixed_cost_per_quantity">Costo Fijo por Cantidad</option>
                        <option value="monthly_fixed">Costo Fijo Mensual</option>
                        <option value="annual_fixed">Costo Fijo Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                      <select
                        value={addForm.status}
                        onChange={(e) => setAddForm(prev => ({ ...prev, status: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Estado del contrato"
                      >
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                        <option value="cancelled">Cancelado</option>
                        <option value="expired">Expirado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                      <select
                        value={addForm.currency}
                        onChange={(e) => setAddForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white"
                        title="Moneda del contrato"
                      >
                        <option value="ARS">Pesos Argentinos (ARS)</option>
                        <option value="USD">Dólares Estadounidenses (USD)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Costs Tab */}
                {editActiveTab === 'costs' && (
                  <div className="space-y-8 min-h-[500px]">
                    {/* Costos por Copia */}
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos por Copia</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo B/N por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.cost_bw_per_copy}
                            onChange={(e) => setAddForm(prev => ({ ...prev, cost_bw_per_copy: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.05"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Color por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.cost_color_per_copy}
                            onChange={(e) => setAddForm(prev => ({ ...prev, cost_color_per_copy: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.15"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Costos Fijos */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos Fijos</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Fijo Mensual ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={addForm.fixed_monthly_cost}
                            onChange={(e) => setAddForm(prev => ({ ...prev, fixed_monthly_cost: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="5000.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Costo Fijo Anual ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={addForm.fixed_annual_cost}
                            onChange={(e) => setAddForm(prev => ({ ...prev, fixed_annual_cost: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="60000.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Copias Incluidas */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Copias Incluidas Mensualmente</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Copias Incluidas B/N</label>
                          <input
                            type="number"
                            value={addForm.included_copies_bw}
                            onChange={(e) => setAddForm(prev => ({ ...prev, included_copies_bw: parseInt(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="10000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Copias Incluidas Color</label>
                          <input
                            type="number"
                            value={addForm.included_copies_color}
                            onChange={(e) => setAddForm(prev => ({ ...prev, included_copies_color: parseInt(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="2000"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Costos de Exceso */}
                    <div className="pt-8 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Costos de Exceso</h4>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exceso B/N por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.overage_cost_bw}
                            onChange={(e) => setAddForm(prev => ({ ...prev, overage_cost_bw: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.08"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exceso Color por Copia ({addForm.currency})</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={addForm.overage_cost_color}
                            onChange={(e) => setAddForm(prev => ({ ...prev, overage_cost_color: parseFloat(e.target.value) || 0 }))}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                            placeholder="0.25"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates Tab */}
                {editActiveTab === 'dates' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio *</label>
                      <input
                        type="date"
                        value={addForm.start_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, start_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Finalización *</label>
                      <input
                        type="date"
                        value={addForm.end_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, end_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Renovación</label>
                      <input
                        type="date"
                        value={addForm.renewal_date}
                        onChange={(e) => setAddForm(prev => ({ ...prev, renewal_date: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Días de Aviso de Renovación</label>
                      <input
                        type="number"
                        value={addForm.renewal_notice_days}
                        onChange={(e) => setAddForm(prev => ({ ...prev, renewal_notice_days: parseInt(e.target.value) || 30 }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="30"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addForm.auto_renewal}
                          onChange={(e) => setAddForm(prev => ({ ...prev, auto_renewal: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">Renovación Automática</label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Equipment Tab */}
                {editActiveTab === 'equipment' && (
                  <div className="space-y-8 min-h-[500px]">
                    {/* Resumen de Equipos */}
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-4">Resumen de Equipos</h4>
                      <div className="grid grid-cols-4 gap-x-6 gap-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Total de Impresoras</label>
                          <input
                            type="number"
                            value={selectedPrinters.length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            placeholder="5"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Impresoras Solo B/N</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && !printer.is_color;
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Impresoras Color</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && printer.is_color;
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Equipos Multifunción</label>
                          <input
                            type="number"
                            value={selectedPrinters.filter(id => {
                              const printer = printers.find(p => p.id === id);
                              return printer && printer.model && printer.model.toLowerCase().includes('mf');
                            }).length}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-gray-50"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>

                    {/* Selección de Impresoras */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-semibold text-gray-900">Seleccionar Impresoras para el Contrato</h4>
                        {printers.length > 0 && (
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPrinters(printers.map(p => p.id));
                                setAddForm(prev => ({ ...prev, total_printers: printers.length }));
                              }}
                              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            >
                              Seleccionar Todas
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPrinters([]);
                                setAddForm(prev => ({ ...prev, total_printers: 0 }));
                              }}
                              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                            >
                              Deseleccionar Todas
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md">
                        {printers.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="mt-2">No hay impresoras disponibles</p>
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            {printers.map((printer) => (
                              <div key={printer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedPrinters.includes(printer.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPrinters(prev => [...prev, printer.id]);
                                        setAddForm(prev => ({ ...prev, total_printers: prev.total_printers + 1 }));
                                      } else {
                                        setSelectedPrinters(prev => prev.filter(id => id !== printer.id));
                                        setAddForm(prev => ({ ...prev, total_printers: Math.max(0, prev.total_printers - 1) }));
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {printer.brand} {printer.model}
                                      </span>
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        printer.is_color 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {printer.is_color ? 'Color' : 'B/N'}
                                      </span>
                                      {printer.model && printer.model.toLowerCase().includes('mf') && (
                                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                          Multifunción
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                      <span>📍 {printer.location || 'Sin ubicación'}</span>
                                      <span>🏷️ {printer.asset_tag || 'Sin etiqueta'}</span>
                                      <span className={`inline-flex items-center ${
                                        printer.status === 'active' 
                                          ? 'text-green-600' 
                                          : printer.status === 'maintenance' 
                                          ? 'text-yellow-600' 
                                          : 'text-red-600'
                                      }`}>
                                        ● {printer.status === 'active' ? 'Activa' : 
                                           printer.status === 'maintenance' ? 'Mantenimiento' : 
                                           'Inactiva'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400">
                                  ID: {printer.id}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {selectedPrinters.length > 0 && (
                        <div className="mt-3 p-3 bg-indigo-50 rounded-lg">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="ml-2 text-sm text-indigo-800">
                              {selectedPrinters.length} impresora{selectedPrinters.length !== 1 ? 's' : ''} seleccionada{selectedPrinters.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Tab */}
                {editActiveTab === 'contact' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Persona de Contacto</label>
                      <input
                        type="text"
                        value={addForm.contact_person}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_person: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cargo/Posición</label>
                      <input
                        type="text"
                        value={addForm.contact_position}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_position: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Gerente de Compras"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email de Contacto</label>
                      <input
                        type="email"
                        value={addForm.contact_email}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_email: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="juan.perez@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono de Contacto</label>
                      <input
                        type="tel"
                        value={addForm.contact_phone}
                        onChange={(e) => setAddForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="+54 11 1234-5678"
                      />
                    </div>
                  </div>
                )}

                {/* Management Tab */}
                {editActiveTab === 'management' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 min-h-[500px] content-start">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                      <input
                        type="text"
                        value={addForm.department}
                        onChange={(e) => setAddForm(prev => ({ ...prev, department: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Administración"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Centro de Costo</label>
                      <input
                        type="text"
                        value={addForm.cost_center}
                        onChange={(e) => setAddForm(prev => ({ ...prev, cost_center: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="CC-001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Código de Presupuesto</label>
                      <input
                        type="text"
                        value={addForm.budget_code}
                        onChange={(e) => setAddForm(prev => ({ ...prev, budget_code: e.target.value }))}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="PRES-2024-001"
                      />
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {editActiveTab === 'notes' && (
                  <div className="space-y-6 min-h-[500px]">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notas Internas</label>
                      <textarea
                        value={addForm.internal_notes}
                        onChange={(e) => setAddForm(prev => ({ ...prev, internal_notes: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Notas para uso interno del equipo..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Condiciones Especiales</label>
                      <textarea
                        value={addForm.special_conditions}
                        onChange={(e) => setAddForm(prev => ({ ...prev, special_conditions: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Condiciones especiales acordadas..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Términos y Condiciones</label>
                      <textarea
                        value={addForm.terms_and_conditions}
                        onChange={(e) => setAddForm(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                        rows={4}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Términos y condiciones del contrato..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notas Adicionales</label>
                      <textarea
                        value={addForm.notes}
                        onChange={(e) => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        placeholder="Cualquier información adicional relevante..."
                      />
                    </div>
                  </div>
                )}
              </form>
            </div>
            
            {/* Form Actions - Fixed at bottom */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingContract(null)
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="contract-edit-form"
                  className="px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Actualizar Contrato
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}