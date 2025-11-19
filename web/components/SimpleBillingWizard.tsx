'use client'

import React, { useState } from 'react'

const SimpleBillingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">🧙‍♂️ Wizard de Facturación</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <p>Paso actual: {currentStep}</p>
        <p>Este es el wizard de facturación simplificado</p>
        
        <div className="mt-4 space-x-4">
          <button 
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Anterior
          </button>
          <button 
            onClick={() => setCurrentStep(prev => Math.min(7, prev + 1))}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}

export default SimpleBillingWizard