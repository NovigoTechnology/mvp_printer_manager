'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LeaseContract } from '@/types/contract'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

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

interface WizardStep {
  number: number
  title: string
  description: string
  completed: boolean
}

const PartialBillingWizard: React.FC = () => {
  // Estados principales
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Datos del wizard
  const [periods, setPeriods] = useState<BillingPeriod[]>([])
  const [contracts, setContracts] = useState<LeaseContract[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null)
  const [selectedContract, setSelectedContract] = useState<LeaseContract | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  
  // Estados de filtros
  const [clientFilter, setClientFilter] = useState('')

  const steps: WizardStep[] = [
    { number: 1, title: 'Período y Cliente', description: 'Seleccionar período de facturación y cliente', completed: false },
    { number: 2, title: 'Tipo de Contrato', description: 'Revisar condiciones y reglas de facturación', completed: false },
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

  const handleContractSelect = async (contract: LeaseContract) => {
    setSelectedContract(contract)
    setLoading(true)
    
    if (selectedPeriod) {
      await fetchContractPrinters(contract.id)
    }
    
    setLoading(false)
  }

  const getFilteredContracts = () => {
    return contracts.filter(contract => {
      const matchesClient = !clientFilter || 
        contract.contract_name.toLowerCase().includes(clientFilter.toLowerCase()) ||
        contract.supplier.toLowerCase().includes(clientFilter.toLowerCase())
      
      return matchesClient
    })
  }

  const canProceedFromStep1 = () => {
    return selectedPeriod && selectedContract
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

  const renderStep1 = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Seleccionar Período de Facturación</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {periods.map(period => (
            <div
              key={period.id}
              onClick={() => setSelectedPeriod(period)}
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
            </div>
          ))}
        </div>
      </Card>

      {selectedPeriod && (
        <Card className="p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Seleccionar Contrato</h4>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filtrar por cliente o proveedor..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              title="Filtrar contratos"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Condiciones del Contrato</h4>
        {selectedContract && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Información General</h5>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Nombre:</span> {selectedContract.contract_name}</p>
                <p><span className="font-medium">Contrato:</span> {selectedContract.contract_number}</p>
                <p><span className="font-medium">Proveedor:</span> {selectedContract.supplier}</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🧙‍♂️ Wizard de Facturación (Parcial)</h1>
        <p className="text-gray-600">Generación guiada de facturas paso a paso - Versión de prueba</p>
      </div>

      {/* Indicador de progreso */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.number
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-500'
              }`}>
                {step.completed ? '✓' : step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-medium text-gray-900">
            {steps[currentStep - 1].title}
          </h3>
          <p className="text-gray-600">{steps[currentStep - 1].description}</p>
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div className="min-h-96">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
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

export default PartialBillingWizard