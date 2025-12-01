'use client'

import React, { useState, useEffect } from 'react'
import { LeaseContract } from '@/types/contract'
import { WizardStep1 } from './wizard/WizardStep1'
import { WizardStep2 } from './wizard/WizardStep2'

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

interface WizardStep {
  number: number
  title: string
  description: string
  completed: boolean
}

const OptimizedBillingWizard: React.FC = () => {
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

  const handleContractSelect = async (contract: LeaseContract) => {
    setSelectedContract(contract)
    setLoading(true)
    
    if (selectedPeriod) {
      await fetchContractPrinters(contract.id)
    }
    
    setLoading(false)
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

  const renderStepPlaceholder = (stepNumber: number, title: string) => (
    <div className="bg-white p-6 rounded-lg shadow text-center">
      <div className="text-gray-400 mb-4">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">{stepNumber}</span>
        </div>
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600 mb-4">Este paso será implementado en la siguiente fase</p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-yellow-800 text-sm">🚧 En desarrollo</p>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🧙‍♂️ Wizard de Facturación</h1>
        <p className="text-gray-600">Generación guiada de facturas paso a paso</p>
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
        {currentStep === 1 && (
          <WizardStep1
            periods={periods}
            contracts={contracts}
            selectedPeriod={selectedPeriod}
            selectedContract={selectedContract}
            clientFilter={clientFilter}
            onPeriodSelect={setSelectedPeriod}
            onContractSelect={handleContractSelect}
            onClientFilterChange={setClientFilter}
          />
        )}
        {currentStep === 2 && (
          <WizardStep2
            selectedContract={selectedContract}
            printers={printers}
            loading={loading}
          />
        )}
        {currentStep === 3 && renderStepPlaceholder(3, 'Validación de Contadores')}
        {currentStep === 4 && renderStepPlaceholder(4, 'Cálculo de Montos')}
        {currentStep === 5 && renderStepPlaceholder(5, 'Vista Previa')}
        {currentStep === 6 && renderStepPlaceholder(6, 'Generar Borrador')}
        {currentStep === 7 && renderStepPlaceholder(7, 'Envío Final')}
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

export default OptimizedBillingWizard