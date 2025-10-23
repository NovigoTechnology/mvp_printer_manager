'use client'

import { useState, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Printer {
  id: number
  // Información básica
  brand: string
  model: string
  serial_number?: string
  asset_tag?: string
  
  // Configuración de red
  ip: string
  mac_address?: string
  hostname?: string
  snmp_profile: string
  
  // Características técnicas
  is_color: boolean
  printer_type: string
  print_technology?: string
  max_paper_size?: string
  duplex_capable: boolean
  network_capable: boolean
  wireless_capable: boolean
  
  // Información de ubicación
  sector?: string
  location?: string
  floor?: string
  building?: string
  department?: string
  
  // Información de adquisición
  supplier?: string
  purchase_date?: string
  installation_date?: string
  warranty_expiry?: string
  lease_contract?: string
  
  // Estado y propiedad
  ownership_type: string
  status: string
  condition: string
  
  // Información adicional
  notes?: string
  responsible_person?: string
  cost_center?: string
  
  created_at: string
}

export default function Printers() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchPrinters()
  }, [])

  const fetchPrinters = async () => {
    try {
      const response = await fetch(`${API_BASE}/printers`)
      const data = await response.json()
      setPrinters(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching printers:', error)
      setLoading(false)
    }
  }

  const pollPrinter = async (printerId: number) => {
    try {
      const response = await fetch(`${API_BASE}/printers/${printerId}/poll`, {
        method: 'POST'
      })
      if (response.ok) {
        alert('Printer polled successfully!')
      } else {
        alert('Failed to poll printer')
      }
    } catch (error) {
      console.error('Error polling printer:', error)
      alert('Error polling printer')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading printers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Printers</h1>
            <p className="mt-2 text-gray-600">Manage your printer fleet</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Add Printer
          </button>
        </div>

        {/* Printers Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {printers.map((printer) => (
            <div key={printer.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {printer.brand} {printer.model}
                    </h3>
                    <p className="text-sm text-gray-500">IP: {printer.ip}</p>
                    {printer.location && (
                      <p className="text-sm text-gray-500">Location: {printer.location}</p>
                    )}
                    {printer.sector && (
                      <p className="text-sm text-gray-500">Sector: {printer.sector}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      printer.is_color ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {printer.is_color ? 'Color' : 'Mono'}
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      {printer.snmp_profile}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => pollPrinter(printer.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Poll Now
                  </button>
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {printers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No printers found</div>
            <p className="text-gray-500 mt-2">Add your first printer to get started</p>
          </div>
        )}

        {/* Add Printer Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Printer</h3>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Brand</label>
                    <input
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="HP, OKI, Brother..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model</label>
                    <input
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="LaserJet 400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Impresora</label>
                    <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                      <option value="printer">Solo Impresora</option>
                      <option value="multifunction">Multifunción (Impresora/Scanner/Copia)</option>
                      <option value="scanner">Solo Scanner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address</label>
                    <input
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Office Floor 1"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Color Printer
                    </label>
                  </div>
                </form>
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Add Printer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}