'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

import API_BASE from '@/app/main'

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

interface DailyUsageData {
  chart_data: any[]
  printers: {
    printer_id: number
    name: string
    hostname: string
    asset_tag: string
  }[]
  date_range: {
    start: string
    end: string
    days: number
  }
}

export default function PrintingHistory() {
  const [printers, setPrinters] = useState<PrinterHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterHistory | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dailyUsage, setDailyUsage] = useState<DailyUsageData | null>(null)
  const [loadingDaily, setLoadingDaily] = useState(false)
  const [chartDays, setChartDays] = useState(30)
  const [activeTab, setActiveTab] = useState<'monthly' | 'daily'>('monthly')

  useEffect(() => {
    fetchPrintingHistory()
    if (activeTab === 'daily') {
      fetchDailyUsage()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyUsage()
    }
  }, [chartDays, selectedPrinter])

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

  const fetchDailyUsage = async () => {
    try {
      setLoadingDaily(true)
      const response = await fetch(`${API_BASE}/reports/daily-usage?days=${chartDays}${selectedPrinter ? `&printer_id=${selectedPrinter.printer_id}` : ''}`)
      const data = await response.json()
      setDailyUsage(data)
      setLoadingDaily(false)
    } catch (error) {
      console.error('Error fetching daily usage:', error)
      setLoadingDaily(false)
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

  // Generate colors for chart lines
  const generateColors = (count: number) => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
      '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1',
      '#d084d0', '#87d068', '#ffc0cb', '#ff6b6b', '#4ecdc4'
    ]
    return Array.from({ length: count }, (_, i) => colors[i % colors.length])
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
          
          {/* Tab Navigation */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('monthly')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'monthly'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Vista Mensual
              </button>
              <button
                onClick={() => setActiveTab('daily')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'daily'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📈 Gráfico Diario
              </button>
            </nav>
          </div>
        </div>

        {/* Search Bar - Only show in monthly view */}
        {activeTab === 'monthly' && (
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
        )}

        {/* Daily Chart View */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Chart Controls */}
            <div className="bg-white shadow sm:rounded-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Gráfico de Copias Diarias por Equipo
                </h3>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Días a mostrar
                    </label>
                    <select
                      value={chartDays}
                      onChange={(e) => setChartDays(parseInt(e.target.value))}
                      className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={7}>Últimos 7 días</option>
                      <option value={14}>Últimos 14 días</option>
                      <option value={30}>Últimos 30 días</option>
                      <option value={60}>Últimos 60 días</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Impresora específica
                    </label>
                    <select
                      value={selectedPrinter?.printer_id || ''}
                      onChange={(e) => {
                        const printerId = parseInt(e.target.value)
                        const printer = printers.find(p => p.printer_id === printerId)
                        setSelectedPrinter(printer || null)
                      }}
                      className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Todas las impresoras</option>
                      {printers.map(printer => (
                        <option key={printer.printer_id} value={printer.printer_id}>
                          {printer.brand} {printer.model} - {printer.hostname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white shadow sm:rounded-lg p-6">
              {loadingDaily ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando datos del gráfico...</p>
                  </div>
                </div>
              ) : dailyUsage && dailyUsage.chart_data.length > 0 ? (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Páginas Impresas Diarias
                    {selectedPrinter && ` - ${selectedPrinter.brand} ${selectedPrinter.model}`}
                  </h4>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyUsage.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          labelFormatter={(value) => `Fecha: ${value}`}
                          formatter={(value: number, name: string) => [
                            value?.toLocaleString() || 0, 
                            name.replace('_total', '').replace('_bw', ' (B&N)').replace('_color', ' (Color)')
                          ]}
                        />
                        <Legend />
                        {dailyUsage.printers.map((printer, index) => {
                          const colors = generateColors(dailyUsage.printers.length)
                          return (
                            <Line
                              key={`${printer.printer_id}_total`}
                              type="monotone"
                              dataKey={`${printer.name}_total`}
                              stroke={colors[index]}
                              strokeWidth={2}
                              dot={{ fill: colors[index], strokeWidth: 2, r: 4 }}
                              name={printer.name}
                            />
                          )
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Chart Summary */}
                  {dailyUsage.date_range && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Período:</span>
                          <span className="ml-2">{dailyUsage.date_range.start} al {dailyUsage.date_range.end}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Equipos monitoreados:</span>
                          <span className="ml-2">{dailyUsage.printers.length}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Días con datos:</span>
                          <span className="ml-2">{dailyUsage.chart_data.length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">📊</div>
                    <p className="text-lg font-medium">No hay datos disponibles</p>
                    <p className="text-sm mt-2">
                      No se encontraron registros de impresión para el período seleccionado.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly View */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            {/* Printers List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPrinters.map((printer) => (
                <div key={printer.printer_id} className="bg-white shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          {printer.brand} {printer.model}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {printer.hostname} - {printer.location}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedPrinter(selectedPrinter?.printer_id === printer.printer_id ? null : printer)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {selectedPrinter?.printer_id === printer.printer_id ? 'Ocultar detalles' : 'Ver detalles'}
                      </button>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Total páginas</dt>
                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                          {getTotalPagesForPrinter(printer).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">B&N</dt>
                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                          {printer.monthly_history.reduce((total, month) => total + month.bw_pages, 0).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Color</dt>
                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                          {printer.monthly_history.reduce((total, month) => total + month.color_pages, 0).toLocaleString()}
                        </dd>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Printer Details */}
            {selectedPrinter && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                    Historial detallado - {selectedPrinter.brand} {selectedPrinter.model}
                  </h3>

                  {/* Summary Statistics */}
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-blue-600">Total páginas impresas</dt>
                      <dd className="mt-2 text-3xl font-bold text-blue-900">
                        {getTotalPagesForPrinter(selectedPrinter).toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-gray-600">Páginas B&N</dt>
                      <dd className="mt-2 text-3xl font-bold text-gray-900">
                        {selectedPrinter.monthly_history.reduce((total, month) => total + month.bw_pages, 0).toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-green-600">Páginas Color</dt>
                      <dd className="mt-2 text-3xl font-bold text-green-900">
                        {selectedPrinter.monthly_history.reduce((total, month) => total + month.color_pages, 0).toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <dt className="text-sm font-medium text-purple-600">Meses registrados</dt>
                      <dd className="mt-2 text-3xl font-bold text-purple-900">
                        {selectedPrinter.monthly_history.length}
                      </dd>
                    </div>
                  </div>

                  {/* Additional Statistics */}
                  {selectedPrinter.monthly_history.length > 0 && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <dt className="text-sm font-medium text-yellow-700">Promedio mensual</dt>
                        <dd className="mt-2 text-2xl font-semibold text-yellow-900">
                          {Math.round(getTotalPagesForPrinter(selectedPrinter) / selectedPrinter.monthly_history.length).toLocaleString()} páginas
                        </dd>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <dt className="text-sm font-medium text-red-700">Mes con mayor uso</dt>
                        <dd className="mt-2 text-lg font-semibold text-red-900">
                          {selectedPrinter.monthly_history.reduce((max, month) =>
                            (month.bw_pages + month.color_pages) > (max.bw_pages + max.color_pages) ? month : max,
                            selectedPrinter.monthly_history[0]
                          ).period} ({selectedPrinter.monthly_history.reduce((max, month) =>
                            (month.bw_pages + month.color_pages) > (max.bw_pages + max.color_pages) ? month : max,
                            selectedPrinter.monthly_history[0]
                          ).bw_pages + selectedPrinter.monthly_history.reduce((max, month) =>
                            (month.bw_pages + month.color_pages) > (max.bw_pages + max.color_pages) ? month : max,
                            selectedPrinter.monthly_history[0]
                          ).color_pages} páginas)
                        </dd>
                      </div>
                    </div>
                  )}

                  {/* Monthly History Table */}
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Período
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Páginas B&N
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Páginas Color
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedPrinter.monthly_history.map((month, index) => (
                          <tr key={month.period} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {month.period}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {month.bw_pages.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {month.color_pages.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {(month.bw_pages + month.color_pages).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}