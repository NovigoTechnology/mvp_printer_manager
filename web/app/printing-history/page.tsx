'use client'

import { useState, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface PrinterHistory {
  printer_id: number
  brand: string
  model: string
  hostname: string
  location: string
  status: string
  monthly_history: MonthlyData[]
}

interface MonthlyData {
  year: number
  month: number
  month_name: string
  period: string
  total_pages: number
  bw_pages: number
  color_pages: number
}

export default function PrintingHistory() {
  const [printers, setPrinters] = useState<PrinterHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterHistory | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPrintingHistory()
  }, [])

  const fetchPrintingHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/printing-history`)
      const data = await response.json()
      setPrinters(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching printing history:', error)
      setLoading(false)
    }
  }

  const filteredPrinters = printers.filter(printer =>
    printer.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    printer.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    printer.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    printer.location?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getTotalPagesForPrinter = (printer: PrinterHistory) => {
    return printer.monthly_history.reduce((total, month) => total + month.total_pages, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading printing history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Historial de Impresiones</h1>
          <p className="mt-2 text-gray-600">Consulta el historial mensual de impresiones por equipo</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="max-w-md">
            <input
              type="text"
              placeholder="Buscar por marca, modelo, hostname o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Printers List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Printers List Panel */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Impresoras ({filteredPrinters.length})
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Selecciona una impresora para ver su historial
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredPrinters.map((printer) => (
                <div
                  key={printer.printer_id}
                  onClick={() => setSelectedPrinter(printer)}
                  className={`px-4 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedPrinter?.printer_id === printer.printer_id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="text-sm font-medium text-gray-900">
                          {printer.brand} {printer.model}
                        </h4>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          printer.status === 'active' ? 'bg-green-100 text-green-800' :
                          printer.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {printer.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {printer.hostname && (
                          <span className="font-medium">{printer.hostname}</span>
                        )}
                        {printer.hostname && printer.location && ' • '}
                        {printer.location && (
                          <span>{printer.location}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Total histórico: {getTotalPagesForPrinter(printer).toLocaleString()} páginas
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {printer.monthly_history.length} meses
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredPrinters.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                No se encontraron impresoras
              </div>
            )}
          </div>

          {/* History Detail Panel */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {selectedPrinter ? 'Historial Mensual' : 'Selecciona una Impresora'}
              </h3>
              {selectedPrinter && (
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {selectedPrinter.brand} {selectedPrinter.model} - {selectedPrinter.hostname}
                </p>
              )}
            </div>
            
            {selectedPrinter ? (
              <div className="max-h-96 overflow-y-auto">
                {selectedPrinter.monthly_history.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {selectedPrinter.monthly_history.map((month, index) => (
                      <div key={`${month.year}-${month.month}`} className="px-4 py-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">
                              {month.period}
                            </h4>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">B&N:</span>
                                <span className="ml-1 font-medium">{month.bw_pages.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Color:</span>
                                <span className="ml-1 font-medium">{month.color_pages.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {month.total_pages.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">páginas</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No hay datos de historial para esta impresora
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <p>Selecciona una impresora de la lista para ver su historial mensual de impresiones</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Statistics */}
        {selectedPrinter && (
          <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 bg-gray-50">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Estadísticas Resumidas
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {getTotalPagesForPrinter(selectedPrinter).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Total Páginas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {selectedPrinter.monthly_history.reduce((total, month) => total + month.bw_pages, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Páginas B&N</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedPrinter.monthly_history.reduce((total, month) => total + month.color_pages, 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Páginas Color</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {selectedPrinter.monthly_history.length}
                  </div>
                  <div className="text-sm text-gray-500">Meses Registrados</div>
                </div>
              </div>
              
              {selectedPrinter.monthly_history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Promedio mensual:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(getTotalPagesForPrinter(selectedPrinter) / selectedPrinter.monthly_history.length).toLocaleString()} páginas
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Mes más activo:</span>
                      <span className="ml-2 font-medium">
                        {selectedPrinter.monthly_history.reduce((max, month) => 
                          month.total_pages > max.total_pages ? month : max, 
                          selectedPrinter.monthly_history[0]
                        ).period} ({selectedPrinter.monthly_history.reduce((max, month) => 
                          month.total_pages > max.total_pages ? month : max, 
                          selectedPrinter.monthly_history[0]
                        ).total_pages.toLocaleString()} páginas)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}