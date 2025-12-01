'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LeaseContract } from '../../../types/contract'

import API_BASE from '@/app/main'

export default function NewContract() {
  const router = useRouter()
  const [printers, setPrinters] = useState<any[]>([])
  const [selectedPrinters, setSelectedPrinters] = useState<number[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('basic')
  const [isLoadingContractNumber, setIsLoadingContractNumber] = useState(false)
  
  // Exchange rate state
  const [exchangeRates, setExchangeRates] = useState({
    USD_to_ARS: 1445,
    ARS_to_USD: 0.00069,
    source: 'Database',
    last_updated: new Date().toISOString(),
    rate_date: new Date().toISOString()
  })

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
    // Soporte multimoneda
    currency: 'ARS' as 'ARS' | 'USD',
    exchange_rate: 1.0,
    cost_bw_per_copy_usd: 0,
    cost_color_per_copy_usd: 0,
    fixed_monthly_cost_usd: 0,
    fixed_annual_cost_usd: 0,
    total_printers: 0,
    printers_bw_only: 0,
    printers_color: 0,
    multifunction_devices: 0,
    start_date: '',
    end_date: '',
    renewal_date: '',
    status: 'active' as 'active' | 'inactive' | 'expired',
    auto_renewal: false,
    notes: '',
    contact_person: '',
    admin_email: ''
  })

  // Load data on component mount
  useEffect(() => {
    // Add a small delay to ensure API is ready
    const timer = setTimeout(() => {
      fetchPrinters()
      fetchCompanies()
      fetchExchangeRates()
      generateContractNumber()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const fetchPrinters = async () => {
    try {
      const response = await fetch(`${API_BASE}/printers/available`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setPrinters(data)
      } else {
        console.error('Failed to fetch available printers:', response.status, response.statusText)
        // Fallback to all printers if available endpoint doesn't exist
        const fallbackResponse = await fetch(`${API_BASE}/printers/`, {
          headers: {
            'Accept': 'application/json',
          },
        })
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          // Filter out printers that already have contracts (client-side filtering as fallback)
          setPrinters(fallbackData)
        }
      }
    } catch (error) {
      console.error('Error fetching printers:', error)
    }
  }

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE}/companies/`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCompanies(data)
      } else {
        console.error('Failed to fetch companies:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    }
  }

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts/exchange-rates`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.rate && typeof data.rate === 'number' && data.rate > 0) {
          setExchangeRates({
            USD_to_ARS: data.rate,
            ARS_to_USD: 1 / data.rate,
            source: data.source || 'API',
            last_updated: data.last_updated || new Date().toISOString(),
            rate_date: data.rate_date || data.last_updated || new Date().toISOString()
          })
        }
      } else {
        console.error('Failed to fetch exchange rates:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      // Mantener valores por defecto en caso de error
      setExchangeRates(prev => ({
        ...prev,
        source: 'Fallback',
        last_updated: new Date().toISOString()
      }))
    }
  }

  const generateContractNumber = async () => {
    setIsLoadingContractNumber(true)
    try {
      const response = await fetch(`${API_BASE}/contracts/next-contract-number`, {
        headers: {
          'Accept': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setAddForm(prev => ({ ...prev, contract_number: data.contract_number }))
      } else {
        console.error('Failed to generate contract number:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error generating contract number:', error)
    } finally {
      setIsLoadingContractNumber(false)
    }
  }

  const handleCurrencyChange = (currency: 'ARS' | 'USD') => {
    setAddForm(prev => ({ 
      ...prev, 
      currency,
      exchange_rate: currency === 'USD' 
        ? (exchangeRates?.ARS_to_USD || 0.00069) 
        : (exchangeRates?.USD_to_ARS || 1445)
    }))
  }

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount)
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'cost_per_copy': return 'Costo por Copia'
      case 'monthly_fixed': return 'Costo Fijo Mensual'
      case 'annual_fixed': return 'Costo Fijo Anual'
      case 'fixed_cost_per_quantity': return 'Costo Fijo + Cantidad Incluida'
      default: return type
    }
  }

  const handlePrinterSelection = (printerId: number) => {
    setSelectedPrinters(prev => 
      prev.includes(printerId) 
        ? prev.filter(id => id !== printerId)
        : [...prev, printerId]
    )
  }

  const addCompany = () => {
    setSelectedCompanies(prev => [...prev, {
      company_id: 0,
      role: 'client',
      participation_percentage: 100,
      is_primary: prev.length === 0
    }])
  }

  const removeCompany = (index: number) => {
    setSelectedCompanies(prev => prev.filter((_, i) => i !== index))
  }

  const updateCompany = (index: number, field: string, value: any) => {
    setSelectedCompanies(prev => prev.map((company, i) => 
      i === index ? { ...company, [field]: value } : company
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validar fechas requeridas
      if (!addForm.start_date || !addForm.end_date) {
        alert('Las fechas de inicio y fin del contrato son requeridas')
        return
      }

      // Preparar datos del contrato con validación de fechas
      const contractData = {
        ...addForm,
        // Convertir fechas a formato ISO válido
        start_date: new Date(addForm.start_date).toISOString(),
        end_date: new Date(addForm.end_date).toISOString(),
        renewal_date: addForm.renewal_date ? new Date(addForm.renewal_date).toISOString() : null,
        printer_ids: selectedPrinters,
        companies: selectedCompanies,
        total_printers: selectedPrinters.length,
        printers_bw_only: selectedPrinters.filter(id => {
          const printer = printers.find(p => p.id === id)
          return printer && !printer.is_color
        }).length,
        printers_color: selectedPrinters.filter(id => {
          const printer = printers.find(p => p.id === id)
          return printer && printer.is_color
        }).length,
        multifunction_devices: selectedPrinters.filter(id => {
          const printer = printers.find(p => p.id === id)
          return printer && printer.is_multifunction
        }).length,
      }

      // Remover campos null para evitar problemas con el API
      const cleanedData = Object.fromEntries(
        Object.entries(contractData).filter(([_, value]) => value !== null && value !== undefined)
      )

      const response = await fetch(`${API_BASE}/contracts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedData),
      })

      if (response.ok) {
        // Use window.location instead of router.push to avoid webpack redirect boundary issues
        window.location.href = '/contracts'
      } else {
        const errorText = await response.text()
        console.error('Error creating contract:', errorText)
        alert(`Error al crear el contrato: ${errorText}`)
      }
    } catch (error) {
      console.error('Error creating contract:', error)
    }
  }

  const handleCancel = () => {
    window.location.href = '/contracts'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver a Contratos
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Nuevo Contrato de Arrendamiento</h1>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Contrato
              </button>
            </div>
          </div>
        </div>

        {/* Content in single screen layout */}
        <div className="bg-white shadow rounded-lg">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 px-6 py-4">
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
                onClick={() => setActiveTab('costs')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'costs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Costos y Tarifas
              </button>
              <button
                onClick={() => setActiveTab('equipment')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'equipment'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Equipos
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'companies'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Empresas
              </button>
              <button
                onClick={() => setActiveTab('dates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Vigencia y Renovación
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'contact'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Contacto y Admin
              </button>
            </nav>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              
              {/* Basic Information Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de Contrato *
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          required
                          value={addForm.contract_number}
                          onChange={(e) => setAddForm({...addForm, contract_number: e.target.value})}
                          className="flex-1 block w-full border-gray-300 rounded-l-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="AUTO-2024-001"
                          disabled={isLoadingContractNumber}
                        />
                        <button
                          type="button"
                          onClick={generateContractNumber}
                          disabled={isLoadingContractNumber}
                          className="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 disabled:opacity-50"
                        >
                          {isLoadingContractNumber ? '...' : '🔄'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del Contrato *
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.contract_name}
                        onChange={(e) => setAddForm({...addForm, contract_name: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Contrato de Arrendamiento - Oficina Principal"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Proveedor/Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={addForm.supplier}
                        onChange={(e) => setAddForm({...addForm, supplier: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Canon Argentina S.A."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Contrato *
                      </label>
                        <select
                          value={addForm.contract_type}
                          onChange={(e) => setAddForm({...addForm, contract_type: e.target.value})}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          title="Seleccionar tipo de contrato"
                        >
                        <option value="cost_per_copy">Costo por Copia</option>
                        <option value="monthly_fixed">Costo Fijo Mensual</option>
                        <option value="annual_fixed">Costo Fijo Anual</option>
                        <option value="fixed_cost_per_quantity">Costo Fijo + Cantidad Incluida</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estado del Contrato
                      </label>
                      <select
                        value={addForm.status}
                        onChange={(e) => setAddForm({...addForm, status: e.target.value as 'active' | 'inactive' | 'expired'})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        title="Estado del contrato"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                        <option value="expired">Vencido</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={addForm.auto_renewal}
                        onChange={(e) => setAddForm({...addForm, auto_renewal: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        title="Activar renovación automática"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Renovación automática
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas adicionales
                    </label>
                    <textarea
                      value={addForm.notes}
                      onChange={(e) => setAddForm({...addForm, notes: e.target.value})}
                      rows={3}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Información adicional sobre el contrato..."
                    />
                  </div>
                </div>
              )}

              {/* Costs Tab */}
              {activeTab === 'costs' && (
                <div className="space-y-6">
                  {/* Currency Configuration */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-100">
                    <h4 className="text-lg font-semibold text-green-900 mb-4">Configuración de Moneda</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Moneda Principal *
                        </label>
                        <select
                          value={addForm.currency}
                          onChange={(e) => handleCurrencyChange(e.target.value as 'ARS' | 'USD')}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500"
                          title="Seleccionar moneda"
                        >
                          <option value="ARS">🇦🇷 Pesos Argentinos (ARS)</option>
                          <option value="USD">🇺🇸 Dólares Estadounidenses (USD)</option>
                        </select>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <h5 className="font-medium text-gray-900 mb-2">Tasa de Cambio Actual</h5>
                        <div className="text-sm">
                          <span className="text-gray-600">1 USD =</span>
                          <span className="ml-2 font-medium text-lg">{exchangeRates?.USD_to_ARS?.toFixed(2) || '1445.00'} ARS</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Actualizado: {exchangeRates?.last_updated ? formatDateTime(exchangeRates.last_updated) : 'Cargando...'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cost per Copy */}
                  {(addForm.contract_type === 'cost_per_copy' || addForm.contract_type === 'fixed_cost_per_quantity') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo por Copia B&N ({addForm.currency === 'USD' ? 'USD' : '$'})
                          {addForm.contract_type === 'cost_per_copy' && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          required={addForm.contract_type === 'cost_per_copy'}
                          value={addForm.cost_bw_per_copy}
                          onChange={(e) => setAddForm({...addForm, cost_bw_per_copy: parseFloat(e.target.value) || 0})}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.150"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo por Copia Color ({addForm.currency === 'USD' ? 'USD' : '$'})
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={addForm.cost_color_per_copy}
                          onChange={(e) => setAddForm({...addForm, cost_color_per_copy: parseFloat(e.target.value) || 0})}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.450"
                        />
                      </div>
                    </div>
                  )}

                  {/* Fixed Costs */}
                  {(addForm.contract_type === 'monthly_fixed' || addForm.contract_type === 'annual_fixed' || addForm.contract_type === 'fixed_cost_per_quantity') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo Fijo Mensual ({addForm.currency === 'USD' ? 'USD' : '$'})
                          {addForm.contract_type === 'monthly_fixed' && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={addForm.contract_type === 'monthly_fixed'}
                          value={addForm.fixed_monthly_cost}
                          onChange={(e) => {
                            const monthly = parseFloat(e.target.value) || 0;
                            setAddForm({
                              ...addForm, 
                              fixed_monthly_cost: monthly,
                              fixed_annual_cost: monthly * 12
                            });
                          }}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="45000.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Costo Fijo Anual ({addForm.currency === 'USD' ? 'USD' : '$'})
                          {addForm.contract_type === 'annual_fixed' && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required={addForm.contract_type === 'annual_fixed'}
                          value={addForm.fixed_annual_cost}
                          onChange={(e) => {
                            const annual = parseFloat(e.target.value) || 0;
                            setAddForm({
                              ...addForm, 
                              fixed_annual_cost: annual,
                              fixed_monthly_cost: annual / 12
                            });
                          }}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="540000.00"
                        />
                      </div>
                    </div>
                  )}

                  {/* Included Copies */}
                  {addForm.contract_type === 'fixed_cost_per_quantity' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Copias Incluidas B&N
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addForm.included_copies_bw}
                          onChange={(e) => setAddForm({...addForm, included_copies_bw: parseInt(e.target.value) || 0})}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="10000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Copias Incluidas Color
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={addForm.included_copies_color}
                          onChange={(e) => setAddForm({...addForm, included_copies_color: parseInt(e.target.value) || 0})}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="2000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Equipment Tab */}
              {activeTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Equipos Asignados: {selectedPrinters.length} / Total Estimado: {selectedPrinters.length}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedPrinters(printers.map((p: any) => p.id))}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Seleccionar Todos
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {printers.map((printer) => (
                      <div
                        key={printer.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          selectedPrinters.includes(printer.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={selectedPrinters.includes(printer.id)}
                              onChange={() => handlePrinterSelection(printer.id)}
                              className="mr-3"
                              title={`Seleccionar ${printer.brand || 'Sin marca'} ${printer.model}`}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full tracking-tight">
                                  {printer.brand || 'Sin marca'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({printer.asset_tag})
                                </span>
                              </div>
                              <span className="font-medium text-gray-900">
                                {printer.model}
                              </span>
                            </div>
                          </label>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {printer.is_color ? 'Color' : 'B&N'}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          IP: {printer.ip_address} | Ubicación: {printer.location || 'No especificada'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Equipment Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedPrinters.length}</div>
                      <div className="text-sm text-gray-600">Total de Equipos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedPrinters.filter(id => {
                          const printer = printers.find(p => p.id === id)
                          return printer && printer.is_color
                        }).length}
                      </div>
                      <div className="text-sm text-gray-600">Impresoras a Color</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedPrinters.filter(id => {
                          const printer = printers.find(p => p.id === id)
                          return printer && !printer.is_color
                        }).length}
                      </div>
                      <div className="text-sm text-gray-600">Equipos Solo B&N</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedPrinters.filter(id => {
                          const printer = printers.find(p => p.id === id)
                          return printer && printer.is_multifunction
                        }).length}
                      </div>
                      <div className="text-sm text-gray-600">Equipos Multifunción</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies Tab */}
              {activeTab === 'companies' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Empresas Asociadas al Contrato</h3>
                    <button
                      type="button"
                      onClick={addCompany}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      + Agregar Empresa
                    </button>
                  </div>

                  {selectedCompanies.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay empresas asociadas. Agregue al menos una empresa para continuar.
                    </div>
                  )}

                  <div className="space-y-4">
                    {selectedCompanies.map((companyAssociation, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium">Empresa #{index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeCompany(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Empresa</label>
                            <select
                              value={companyAssociation.company_id}
                              onChange={(e) => updateCompany(index, 'company_id', parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              required
                            >
                              <option value={0}>Seleccionar empresa...</option>
                              {companies.map(company => (
                                <option key={company.id} value={company.id}>
                                  {company.name} ({company.tax_id})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Rol</label>
                            <select
                              value={companyAssociation.role}
                              onChange={(e) => updateCompany(index, 'role', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="client">Cliente</option>
                              <option value="partner">Socio</option>
                              <option value="supplier">Proveedor</option>
                              <option value="guarantor">Garante</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Participación (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={companyAssociation.participation_percentage}
                              onChange={(e) => updateCompany(index, 'participation_percentage', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="100.0"
                            />
                          </div>

                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={companyAssociation.is_primary}
                              onChange={(e) => updateCompany(index, 'is_primary', e.target.checked)}
                              className="mr-2"
                            />
                            <label className="text-sm font-medium">Empresa principal</label>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-2">Notas</label>
                          <textarea
                            value={companyAssociation.notes || ''}
                            onChange={(e) => updateCompany(index, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            rows={2}
                            placeholder="Notas específicas de esta asociación..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Company Summary */}
                  {selectedCompanies.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Resumen de Empresas</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Total de empresas: {selectedCompanies.length}</div>
                        <div>
                          Participación total: {selectedCompanies.reduce((sum, c) => sum + (c.participation_percentage || 0), 0).toFixed(1)}%
                        </div>
                        <div>
                          Empresas principales: {selectedCompanies.filter(c => c.is_primary).length}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dates Tab */}
              {activeTab === 'dates' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de Inicio *
                      </label>
                      <input
                        type="date"
                        required
                        value={addForm.start_date}
                        onChange={(e) => setAddForm({...addForm, start_date: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        title="Fecha de inicio del contrato"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de Fin *
                      </label>
                      <input
                        type="date"
                        required
                        value={addForm.end_date}
                        onChange={(e) => setAddForm({...addForm, end_date: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        title="Fecha de fin del contrato"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de Renovación
                      </label>
                      <input
                        type="date"
                        value={addForm.renewal_date}
                        onChange={(e) => setAddForm({...addForm, renewal_date: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        title="Fecha de renovación del contrato"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Tab */}
              {activeTab === 'contact' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Persona de Contacto
                      </label>
                      <input
                        type="text"
                        value={addForm.contact_person}
                        onChange={(e) => setAddForm({...addForm, contact_person: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Juan Pérez - Gerente de Operaciones"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Administrativo
                      </label>
                      <input
                        type="email"
                        value={addForm.admin_email}
                        onChange={(e) => setAddForm({...addForm, admin_email: e.target.value})}
                        className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="admin@empresa.com"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </form>
        </div>
      </div>
    </div>
  )
}