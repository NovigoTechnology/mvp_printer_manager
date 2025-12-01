'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LeaseContract } from '@/types/contract'

import API_BASE from '@/app/main'

interface BillingPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  cut_off_date: string
  status: string
  description?: string
}

interface Printer {
  id: number
  ip_address: string
  location?: string
  model?: string
  brand?: string
  initial_counter_bw?: number
  initial_counter_color?: number
  initial_counter_total?: number
}

interface CounterReading {
  id: number
  printer_id: number
  reading_date: string
  counter_bw_current: number
  counter_color_current: number
  counter_total_current: number
  counter_bw_previous: number
  counter_color_previous: number
  counter_total_previous: number
  prints_bw_period: number
  prints_color_period: number
  prints_total_period: number
}

interface WizardStep {
  number: number
  title: string
  description: string
  completed: boolean
}

interface InvoiceCalculation {
  contract: LeaseContract
  readings: CounterReading[]
  baseAmount: number
  excessAmount: number
  subtotal: number
  taxAmount: number
  total: number
  notes?: string
}

const BillingWizard: React.FC = () => {
  // Estados principales
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Datos del wizard
  const [periods, setPeriods] = useState<BillingPeriod[]>([])
  const [contracts, setContracts] = useState<LeaseContract[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null)
  const [selectedContract, setSelectedContract] = useState<LeaseContract | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [readings, setReadings] = useState<CounterReading[]>([])
  const [invoiceCalculations, setInvoiceCalculations] = useState<InvoiceCalculation[]>([])
  
  // Estados de filtros
  const [clientFilter, setClientFilter] = useState('')
  const [contractStatusFilter, setContractStatusFilter] = useState('')
  const [contractTypeFilter, setContractTypeFilter] = useState('')

  const steps: WizardStep[] = [
    { number: 1, title: 'Período y Cliente', description: 'Seleccionar período de facturación y cliente', completed: false },
    { number: 2, title: 'Tipo de Contrato', description: 'Revisar condiciones y reglas de facturación', completed: false },
    { number: 3, title: 'Validación de Contadores', description: 'Verificar lecturas y calcular copias', completed: false },
    { number: 4, title: 'Cálculo de Montos', description: 'Aplicar tarifas, descuentos e impuestos', completed: false },
    { number: 5, title: 'Vista Previa', description: 'Validar datos antes de generar factura', completed: false },
    { number: 6, title: 'Generar Borrador', description: 'Crear factura en estado borrador', completed: false },
    { number: 7, title: 'Envío Final', description: 'Enviar y registrar factura', completed: false }
  ]

  useEffect(() => {
    fetchPeriods()
    fetchContracts()
  }, [])

  const fetchPeriods = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/periods`)
      if (response.ok) {
        const data = await response.json()
        setPeriods(data.filter((p: BillingPeriod) => p.status === 'closed'))
      }
    } catch (error) {
      console.error('Error fetching periods:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts`)
      if (response.ok) {
        const data = await response.json()
        setContracts(data)
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    }
  }

  const fetchContractPrinters = async (contractId: number) => {
    try {
      const response = await fetch(`${API_BASE}/contracts/${contractId}/printers`)
      if (response.ok) {
        const data = await response.json()
        setPrinters(data)
      }
    } catch (error) {
      console.error('Error fetching contract printers:', error)
    }
  }

  const fetchReadings = async (periodId: number, contractId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/readings?period_id=${periodId}&contract_id=${contractId}`)
      if (response.ok) {
        const data = await response.json()
        setReadings(data)
      }
    } catch (error) {
      console.error('Error fetching readings:', error)
    }
  }

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handlePeriodSelect = (period: BillingPeriod) => {
    setSelectedPeriod(period)
  }

  const handleContractSelect = async (contract: LeaseContract) => {
    setSelectedContract(contract)
    setLoading(true)
    
    if (selectedPeriod) {
      await fetchContractPrinters(contract.id)
      await fetchReadings(selectedPeriod.id, contract.id)
    }
    
    setLoading(false)
  }

  const getFilteredContracts = () => {
    return contracts.filter(contract => {
      const matchesClient = !clientFilter || 
        contract.contract_name.toLowerCase().includes(clientFilter.toLowerCase()) ||
        contract.supplier.toLowerCase().includes(clientFilter.toLowerCase())
      
      const matchesStatus = !contractStatusFilter || contract.status === contractStatusFilter
      const matchesType = !contractTypeFilter || contract.contract_type === contractTypeFilter
      
      return matchesClient && matchesStatus && matchesType
    })
  }

  const canProceedFromStep1 = () => {
    return selectedPeriod && selectedContract
  }

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep === step.number 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : currentStep > step.number
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-gray-200 border-gray-300 text-gray-500'
            }`}>
              {currentStep > step.number ? '✓' : step.number}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-16 h-1 mx-2 ${
                currentStep > step.number ? 'bg-green-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <h3 className="text-lg font-semibold text-gray-900">{steps[currentStep - 1].title}</h3>
        <p className="text-sm text-gray-600">{steps[currentStep - 1].description}</p>
      </div>
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">1. Seleccionar Período de Facturación</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {periods.map(period => (
            <div
              key={period.id}
              onClick={() => handlePeriodSelect(period)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPeriod?.id === period.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <h5 className="font-medium text-gray-900">{period.name}</h5>
              <p className="text-sm text-gray-600">
                {period.start_date} - {period.end_date}
              </p>
              <p className="text-xs text-gray-500">Corte: {period.cut_off_date}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                Cerrado
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedPeriod && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">2. Seleccionar Cliente y Contrato</h4>
          
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente</label>
              <input
                type="text"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                placeholder="Nombre de cliente o contrato..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                title="Filtrar por estado del contrato"
                value={contractStatusFilter}
                onChange={(e) => setContractStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activo</option>
                <option value="paused">En pausa</option>
                <option value="terminated">Finalizado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                title="Filtrar por tipo de contrato"
                value={contractTypeFilter}
                onChange={(e) => setContractTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los tipos</option>
                <option value="per_copy">Por contador</option>
                <option value="fixed_fee">Cuota fija</option>
                <option value="mixed">Mixto</option>
                <option value="supplies">Por insumos</option>
              </select>
            </div>
          </div>

          {/* Lista de contratos */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getFilteredContracts().map(contract => (
              <div
                key={contract.id}
                onClick={() => handleContractSelect(contract)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedContract?.id === contract.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-gray-900">{contract.contract_name}</h5>
                    <p className="text-sm text-gray-600">Contrato: {contract.contract_number}</p>
                    <p className="text-xs text-gray-500">Proveedor: {contract.supplier}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      contract.status === 'active' ? 'bg-green-100 text-green-800' :
                      contract.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {contract.status === 'active' ? 'Activo' : 
                       contract.status === 'suspended' ? 'Suspendido' : 
                       contract.status === 'expired' ? 'Expirado' : 'Cancelado'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {contract.contract_type === 'cost_per_copy' ? 'Por copia' :
                       contract.contract_type === 'monthly_fixed' ? 'Cuota fija mensual' :
                       contract.contract_type === 'annual_fixed' ? 'Cuota fija anual' : 'Costo fijo por cantidad'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Condiciones del Contrato</h4>
        {selectedContract && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Información General</h5>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Nombre:</span> {selectedContract.contract_name}</p>
                <p><span className="font-medium">Contrato:</span> {selectedContract.contract_number}</p>
                <p><span className="font-medium">Proveedor:</span> {selectedContract.supplier}</p>
                <p><span className="font-medium">Tipo:</span> {
                  selectedContract.contract_type === 'cost_per_copy' ? 'Por copia' :
                  selectedContract.contract_type === 'monthly_fixed' ? 'Cuota fija mensual' :
                  selectedContract.contract_type === 'annual_fixed' ? 'Cuota fija anual' : 'Costo fijo por cantidad'
                }</p>
                <p><span className="font-medium">Estado:</span> {selectedContract.status}</p>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Condiciones Financieras</h5>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Costo B/N por copia:</span> ${selectedContract.cost_bw_per_copy}</p>
                <p><span className="font-medium">Costo Color por copia:</span> ${selectedContract.cost_color_per_copy}</p>
                <p><span className="font-medium">Cuota fija mensual:</span> ${selectedContract.fixed_monthly_cost}</p>
                <p><span className="font-medium">Cuota fija anual:</span> ${selectedContract.fixed_annual_cost}</p>
                <p><span className="font-medium">Copias B/N incluidas:</span> {selectedContract.included_copies_bw}</p>
                <p><span className="font-medium">Copias Color incluidas:</span> {selectedContract.included_copies_color}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Equipos Asociados</h4>
        {loading ? (
          <div className="text-center py-4">
            <div className="text-gray-500">Cargando equipos...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map(printer => (
              <div key={printer.id} className="p-4 border border-gray-200 rounded-lg">
                <h6 className="font-medium text-gray-900">{printer.brand} {printer.model}</h6>
                <p className="text-sm text-gray-600">IP: {printer.ip_address}</p>
                <p className="text-sm text-gray-600">Ubicación: {printer.location}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // Paso 3: Validación de contadores
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">📊 Validación de Contadores</h4>
        {selectedContract && (
          <div className="space-y-6">
            {/* Resumen del período seleccionado */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-2">Período de Facturación</h5>
              <p className="text-blue-800">{selectedPeriod?.name}</p>
              <p className="text-sm text-blue-700">
                Del {selectedPeriod?.start_date} al {selectedPeriod?.end_date}
              </p>
            </div>

            {/* Lista de impresoras del contrato */}
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Impresoras en el Contrato</h5>
              {printers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No hay impresoras asignadas a este contrato</p>
                  <p className="text-sm mt-2">Se necesita asignar impresoras al contrato para poder facturar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {printers.map((printer) => (
                    <div key={printer.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h6 className="font-medium text-gray-900">
                            {printer.brand} {printer.model}
                          </h6>
                          <p className="text-sm text-gray-600">IP: {printer.ip_address}</p>
                          <p className="text-sm text-gray-600">Ubicación: {printer.location || 'No especificada'}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            📡 Leer SNMP
                          </button>
                          <button className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            ✏️ Manual
                          </button>
                        </div>
                      </div>

                      {/* Contadores actuales */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Contador B/N Actual
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Contador Color Actual
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Contador Total
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                            disabled
                          />
                        </div>
                      </div>

                      {/* Contadores del período anterior */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 opacity-75">
                        <div className="bg-gray-100 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            B/N Anterior
                          </label>
                          <span className="text-sm text-gray-700">
                            {printer.initial_counter_bw || 0}
                          </span>
                        </div>
                        <div className="bg-gray-100 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Color Anterior
                          </label>
                          <span className="text-sm text-gray-700">
                            {printer.initial_counter_color || 0}
                          </span>
                        </div>
                        <div className="bg-gray-100 p-3 rounded">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Total Anterior
                          </label>
                          <span className="text-sm text-gray-700">
                            {printer.initial_counter_total || 0}
                          </span>
                        </div>
                      </div>

                      {/* Copias del período calculadas */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-green-50 rounded">
                        <div className="text-center">
                          <span className="block text-lg font-bold text-green-700">0</span>
                          <span className="text-xs text-green-600">Copias B/N</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-lg font-bold text-green-700">0</span>
                          <span className="text-xs text-green-600">Copias Color</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-lg font-bold text-green-700">0</span>
                          <span className="text-xs text-green-600">Total Período</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón para validar todos los contadores */}
            {printers.length > 0 && (
              <div className="flex justify-center">
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  🔄 Actualizar Todos los Contadores por SNMP
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // Paso 4: Cálculo de montos
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">💰 Cálculo de Montos</h4>
        {selectedContract && (
          <div className="space-y-6">
            {/* Resumen de contadores */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-medium text-blue-900 mb-3">Resumen de Contadores del Período</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-blue-700">0</span>
                  <span className="text-sm text-blue-600">Total Copias B/N</span>
                </div>
                <div className="text-center">
                  <span className="block text-2xl font-bold text-blue-700">0</span>
                  <span className="text-sm text-blue-600">Total Copias Color</span>
                </div>
                <div className="text-center">
                  <span className="block text-2xl font-bold text-blue-700">0</span>
                  <span className="text-sm text-blue-600">Total General</span>
                </div>
              </div>
            </div>

            {/* Estructura de costos según el tipo de contrato */}
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Estructura de Costos</h5>
              {selectedContract.contract_type === 'cost_per_copy' ? (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h6 className="font-medium text-green-800 mb-3">📋 Facturación por Copia</h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Costo por copia B/N:</span>
                        <span className="font-medium">${selectedContract.cost_bw_per_copy}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Copias B/N incluidas:</span>
                        <span className="font-medium">{selectedContract.included_copies_bw}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Copias B/N excedentes:</span>
                        <span className="font-medium text-red-600">0</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between items-center font-medium">
                          <span>Subtotal B/N:</span>
                          <span>$0.00</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Costo por copia Color:</span>
                        <span className="font-medium">${selectedContract.cost_color_per_copy}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Copias Color incluidas:</span>
                        <span className="font-medium">{selectedContract.included_copies_color}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Copias Color excedentes:</span>
                        <span className="font-medium text-red-600">0</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between items-center font-medium">
                          <span>Subtotal Color:</span>
                          <span>$0.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h6 className="font-medium text-yellow-800 mb-3">📅 Facturación de Cuota Fija</h6>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Cuota fija mensual:</span>
                      <span className="font-medium">${selectedContract.fixed_monthly_cost}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Cuota fija anual:</span>
                      <span className="font-medium">${selectedContract.fixed_annual_cost}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center font-medium">
                        <span>Monto base:</span>
                        <span>${selectedContract.contract_type === 'monthly_fixed' ? selectedContract.fixed_monthly_cost : selectedContract.fixed_annual_cost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cálculo final */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-4">💵 Resumen de Facturación</h5>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Descuentos:</span>
                  <span className="font-medium text-green-600">-$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Base imponible:</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">IVA (21%):</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total a Facturar:</span>
                    <span className="text-green-600">$0.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-center space-x-4">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                🔄 Recalcular
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                💾 Guardar Cálculo
              </button>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones del Cálculo:
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agregar notas o observaciones sobre el cálculo..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Paso 5: Vista previa
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">👁️ Vista Previa de la Factura</h4>
        {selectedContract && selectedPeriod && (
          <div className="space-y-6">
            {/* Cabecera de la factura */}
            <div className="border-2 border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h5 className="font-bold text-lg text-gray-900 mb-3">📄 Datos de la Factura</h5>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Número de Factura:</span> <span className="text-blue-600">FACT-2024-001</span></p>
                    <p><span className="font-medium">Fecha de Emisión:</span> {new Date().toLocaleDateString()}</p>
                    <p><span className="font-medium">Período Facturado:</span> {selectedPeriod.name}</p>
                    <p><span className="font-medium">Vencimiento:</span> {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div>
                  <h5 className="font-bold text-lg text-gray-900 mb-3">🏢 Datos del Cliente</h5>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Proveedor:</span> {selectedContract.supplier}</p>
                    <p><span className="font-medium">Contrato:</span> {selectedContract.contract_number}</p>
                    <p><span className="font-medium">Nombre:</span> {selectedContract.contract_name}</p>
                    <p><span className="font-medium">Contacto:</span> {selectedContract.contact_person || 'No especificado'}</p>
                    <p><span className="font-medium">Email:</span> {selectedContract.contact_email || 'No especificado'}</p>
                  </div>
                </div>
              </div>

              {/* Detalle de la facturación */}
              <div className="border-t pt-6">
                <h5 className="font-bold text-lg text-gray-900 mb-4">📊 Detalle de Servicios</h5>
                
                {/* Tabla de equipos y consumos */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Copias B/N</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Copias Color</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {printers.map((printer, index) => (
                        <tr key={printer.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">{printer.brand} {printer.model}</div>
                              <div className="text-sm text-gray-500">{printer.location}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">0</td>
                          <td className="px-4 py-3 text-center">0</td>
                          <td className="px-4 py-3 text-center font-medium">0</td>
                          <td className="px-4 py-3 text-right font-medium">$0.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen financiero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h6 className="font-medium text-gray-900 mb-3">📋 Resumen de Servicios</h6>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total copias B/N:</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total copias Color:</span>
                        <span className="font-medium">0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Equipos facturados:</span>
                        <span className="font-medium">{printers.length}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-2">
                        <span>Total copias período:</span>
                        <span>0</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h6 className="font-medium text-gray-900 mb-3">💰 Resumen Financiero</h6>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">$0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Descuentos:</span>
                        <span className="font-medium text-green-600">-$0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Base imponible:</span>
                        <span className="font-medium">$0.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA (21%):</span>
                        <span className="font-medium">$0.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span className="text-green-600">$0.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-center space-x-4">
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                📄 Generar PDF
              </button>
              <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                📤 Exportar Excel
              </button>
              <button className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                ✏️ Editar Datos
              </button>
            </div>

            {/* Validaciones */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h6 className="font-medium text-yellow-800 mb-2">⚠️ Validaciones</h6>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>✅ Período de facturación válido</li>
                <li>✅ Contrato activo y vigente</li>
                <li>⚠️ Se requiere validar contadores de equipos</li>
                <li>⚠️ Algunos equipos pueden tener lecturas pendientes</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Paso 6: Generar borrador
  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">💾 Generar Borrador de Factura</h4>
        {selectedContract && selectedPeriod && (
          <div className="space-y-6">
            {/* Estado del borrador */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <h5 className="font-medium text-blue-900">Estado del Borrador</h5>
              </div>
              <p className="text-blue-800 text-sm">
                La factura será creada en estado "Borrador" y podrá ser editada antes del envío final.
              </p>
            </div>

            {/* Resumen de la factura a generar */}
            <div className="border rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-4">📄 Resumen de la Factura</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Número de factura:</span>
                    <span className="font-medium">DRAFT-2024-001</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Período:</span>
                    <span className="font-medium">{selectedPeriod.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contrato:</span>
                    <span className="font-medium">{selectedContract.contract_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{selectedContract.supplier}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total equipos:</span>
                    <span className="font-medium">{printers.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total copias:</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-green-600">$0.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Opciones de generación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h6 className="font-medium text-gray-900 mb-3">⚙️ Opciones de Generación</h6>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm">Generar PDF automáticamente</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm">Exportar a Excel</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-sm">Enviar notificación por email</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-sm">Guardar en el sistema</span>
                  </label>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h6 className="font-medium text-gray-900 mb-3">📅 Fechas Importantes</h6>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fecha de emisión:
                    </label>
                    <input
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Fecha de vencimiento:
                    </label>
                    <input
                      type="date"
                      defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Observaciones finales */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones para el borrador:
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Agregar notas internas o comentarios sobre esta factura..."
              />
            </div>

            {/* Botón de generación */}
            <div className="flex justify-center">
              <button className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                💾 Generar Borrador
              </button>
            </div>

            {/* Estado de generación */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h6 className="font-medium text-yellow-800 mb-2">📋 Qué sucederá:</h6>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Se creará una factura en estado "Borrador"</li>
                <li>Se generarán los archivos PDF y Excel si están seleccionados</li>
                <li>Se guardará en el sistema para futuras modificaciones</li>
                <li>Podrás revisar y editar antes del envío final</li>
                <li>No se enviará automáticamente al cliente</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Paso 7: Envío final
  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium text-gray-900 mb-4">📤 Envío Final de la Factura</h4>
        {selectedContract && selectedPeriod && (
          <div className="space-y-6">
            {/* Estado actual de la factura */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <h5 className="font-medium text-green-900">✅ Factura Lista para Envío</h5>
              </div>
              <p className="text-green-800 text-sm">
                El borrador ha sido validado y está listo para ser enviado al cliente.
              </p>
            </div>

            {/* Resumen final */}
            <div className="border rounded-lg p-6">
              <h5 className="font-medium text-gray-900 mb-4">📄 Resumen Final</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h6 className="font-medium text-gray-800 mb-2">🏢 Cliente</h6>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>{selectedContract.supplier}</p>
                    <p>Contrato: {selectedContract.contract_number}</p>
                    <p>Contacto: {selectedContract.contact_person || 'No especificado'}</p>
                    <p>Email: {selectedContract.contact_email || 'No especificado'}</p>
                  </div>
                </div>

                <div>
                  <h6 className="font-medium text-gray-800 mb-2">📊 Servicios</h6>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Período: {selectedPeriod.name}</p>
                    <p>Equipos: {printers.length}</p>
                    <p>Total copias: 0</p>
                    <p>Tipo: {selectedContract.contract_type === 'cost_per_copy' ? 'Por copia' : 'Cuota fija'}</p>
                  </div>
                </div>

                <div>
                  <h6 className="font-medium text-gray-800 mb-2">💰 Facturación</h6>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Subtotal: $0.00</p>
                    <p>IVA (21%): $0.00</p>
                    <p className="font-bold text-lg text-green-600">Total: $0.00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Opciones de envío */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h6 className="font-medium text-gray-900 mb-3">📧 Opciones de Envío</h6>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked title="Enviar por email" />
                    <span className="text-sm">Enviar por email</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" title="Generar PDF" />
                    <span className="text-sm">Generar PDF adicional</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked title="Actualizar estado en sistema" />
                    <span className="text-sm">Actualizar estado en sistema</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-2" title="Registrar en historial" />
                    <span className="text-sm">Registrar en historial</span>
                  </label>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h6 className="font-medium text-gray-900 mb-3">👥 Destinatarios</h6>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email principal:
                    </label>
                    <input
                      type="email"
                      defaultValue={selectedContract.contact_email || ''}
                      placeholder="cliente@email.com"
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Emails adicionales (opcional):
                    </label>
                    <input
                      type="email"
                      placeholder="copia@email.com"
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje personalizado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensaje para el cliente:
              </label>
              <textarea
                rows={4}
                title="Mensaje para el cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                defaultValue={`Estimado/a ${selectedContract.contact_person || 'Cliente'},

Adjuntamos la factura correspondiente al período ${selectedPeriod.name} por los servicios de impresión según contrato ${selectedContract.contract_number}.

Saludos cordiales,
Equipo de Facturación`}
              />
            </div>

            {/* Confirmación final */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h6 className="font-medium text-red-800 mb-2">⚠️ Confirmación de Envío</h6>
              <p className="text-red-700 text-sm mb-3">
                Una vez enviada, la factura no podrá ser modificada. Asegúrese de que todos los datos son correctos.
              </p>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" title="Confirmar envío" />
                <span className="text-sm font-medium text-red-800">
                  Confirmo que he revisado todos los datos y autorizo el envío
                </span>
              </label>
            </div>

            {/* Botones de acción final */}
            <div className="flex justify-center space-x-4">
              <button className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                👁️ Vista Previa Final
              </button>
              <button className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                📤 Enviar Factura
              </button>
            </div>

            {/* Estado de envío */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h6 className="font-medium text-blue-800 mb-2">🚀 Proceso de Envío</h6>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Validación final de todos los datos</li>
                <li>Generación de PDF y archivos adjuntos</li>
                <li>Envío de email al cliente</li>
                <li>Actualización del estado en el sistema</li>
                <li>Registro en historial de facturación</li>
                <li>Confirmación de envío exitoso</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderStepPlaceholder = (stepNumber: number, title: string) => (
    <div className="bg-white p-6 rounded-lg shadow text-center">
      <div className="text-gray-400 mb-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">{stepNumber}</span>
        </div>
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600">Esta funcionalidad se implementará en los siguientes pasos.</p>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Wizard de Facturación</h1>
        <p className="text-gray-600">Proceso guiado para generar facturas de impresoras</p>
      </div>

      {renderStepIndicator()}

      <div className="min-h-96">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
        {currentStep === 7 && renderStep7()}
      </div>

      {/* Botones de navegación */}
      <div className="flex justify-between mt-8">
        <button
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium transition-colors"
        >
          ← Anterior
        </button>
        
        <button
          onClick={handleNextStep}
          disabled={currentStep === 1 && !canProceedFromStep1()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:text-blue-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

export default BillingWizard