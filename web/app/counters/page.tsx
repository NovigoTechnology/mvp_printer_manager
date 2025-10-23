'use client'

import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:8000'

interface Printer {
  id: number
  brand: string
  model: string
  ip: string
  location?: string
  supplier?: string
}

interface MonthlyCounter {
  id: number
  printer_id: number
  printer: {
    brand: string
    model: string
    ip: string
    location?: string
  }
  year: number
  month: number
  counter_bw: number
  counter_color: number
  counter_total: number
  previous_counter_bw: number
  previous_counter_color: number
  previous_counter_total: number
  pages_printed_bw: number
  pages_printed_color: number
  pages_printed_total: number
  recorded_at: string
  notes?: string
  locked: boolean
}

interface CounterForm {
  printer_id: number
  year: number
  month: number
  counter_bw: number
  counter_color: number
  counter_total: number
  notes?: string
}

interface ManualCounterForm {
  printer_id: number
  year: number
  month: number
  pages_printed_bw: number
  pages_printed_color: number
  pages_printed_total: number
  notes?: string
}

export default function Counters() {
  const [counters, setCounters] = useState<MonthlyCounter[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = todos los meses
  const [selectedPrinter, setSelectedPrinter] = useState(0) // 0 = todas las impresoras
  const [selectedSupplier, setSelectedSupplier] = useState('') // '' = todos los proveedores
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCounter, setEditingCounter] = useState<MonthlyCounter | null>(null)
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form')
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'counter' | 'manual'>('counter')
  const [lastCounters, setLastCounters] = useState<{
    counter_bw: number, 
    counter_color: number, 
    counter_total: number,
    year: number,
    month: number
  } | null>(null)
  const [formData, setFormData] = useState<CounterForm>({
    printer_id: 0,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    counter_bw: 0,
    counter_color: 0,
    counter_total: 0,
    notes: ''
  })
  const [manualFormData, setManualFormData] = useState<ManualCounterForm>({
    printer_id: 0,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    pages_printed_bw: 0,
    pages_printed_color: 0,
    pages_printed_total: 0,
    notes: ''
  })

  useEffect(() => {
    fetchData()
    if (viewMode === 'table') {
      fetchComparisonData()
    }
  }, [selectedYear, selectedMonth, viewMode])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch counters for selected month/year
      let countersUrl = `${API_BASE}/counters?year=${selectedYear}`
      if (selectedMonth > 0) {
        countersUrl += `&month=${selectedMonth}`
      }
      const countersResponse = await fetch(countersUrl)
      const countersData = await countersResponse.json()
      setCounters(countersData)

      // Fetch all printers for the form
      const printersResponse = await fetch(`${API_BASE}/printers`)
      const printersData = await printersResponse.json()
      setPrinters(printersData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComparisonData = async () => {
    try {
      setLoading(true)
      
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1
      
      // Calculate previous month
      let prevMonth = currentMonth - 1
      let prevYear = currentYear
      if (prevMonth === 0) {
        prevMonth = 12
        prevYear = currentYear - 1
      }

      // Fetch active printers
      const printersResponse = await fetch(`${API_BASE}/printers`)
      const allPrinters = await printersResponse.json()
      const activePrinters = allPrinters.filter((p: any) => p.status === 'active')

      // Fetch current month counters
      const currentCountersResponse = await fetch(
        `${API_BASE}/counters?year=${currentYear}&month=${currentMonth}`
      )
      const currentCounters = await currentCountersResponse.json()

      // Fetch previous month counters
      const prevCountersResponse = await fetch(
        `${API_BASE}/counters?year=${prevYear}&month=${prevMonth}`
      )
      const prevCounters = await prevCountersResponse.json()

      // Combine data
      const comparisonData = activePrinters.map((printer: any) => {
        const currentCounter = currentCounters.find((c: any) => c.printer_id === printer.id)
        const prevCounter = prevCounters.find((c: any) => c.printer_id === printer.id)
        
        return {
          printer,
          currentMonth: {
            year: currentYear,
            month: currentMonth,
            counter: currentCounter,
            monthName: new Date(currentYear, currentMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          },
          previousMonth: {
            year: prevYear,
            month: prevMonth,
            counter: prevCounter,
            monthName: new Date(prevYear, prevMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          }
        }
      })

      setComparisonData(comparisonData)
    } catch (error) {
      console.error('Error fetching comparison data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLastCounters = async (printerId: number, year?: number, month?: number) => {
    try {
      // Get last month's data for the same printer
      const response = await fetch(`${API_BASE}/counters?printer_id=${printerId}`)
      const data = await response.json()
      
      // Find the most recent counter for this printer (excluding current month if provided)
      const printerCounters = data
        .filter((counter: MonthlyCounter) => {
          if (counter.printer_id !== printerId) return false
          // If year/month provided, exclude that specific month
          if (year && month && counter.year === year && counter.month === month) return false
          return true
        })
        .sort((a: MonthlyCounter, b: MonthlyCounter) => {
          if (a.year !== b.year) return b.year - a.year
          return b.month - a.month
        })

      if (printerCounters.length > 0) {
        const lastCounter = printerCounters[0]
        setLastCounters({
          counter_bw: lastCounter.counter_bw,
          counter_color: lastCounter.counter_color,
          counter_total: lastCounter.counter_total,
          year: lastCounter.year,
          month: lastCounter.month
        })
      } else {
        setLastCounters({
          counter_bw: 0,
          counter_color: 0,
          counter_total: 0,
          year: new Date().getFullYear(),
          month: new Date().getMonth()
        })
      }
    } catch (error) {
      console.error('Error fetching last counters:', error)
      setLastCounters({
        counter_bw: 0,
        counter_color: 0,
        counter_total: 0,
        year: new Date().getFullYear(),
        month: new Date().getMonth()
      })
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    
    try {
      let dataToSend

      if (activeTab === 'counter') {
        // Calculate pages printed based on difference from last counters
        const pagesBW = lastCounters ? Math.max(0, formData.counter_bw - lastCounters.counter_bw) : formData.counter_bw
        const pagesColor = lastCounters ? Math.max(0, formData.counter_color - lastCounters.counter_color) : formData.counter_color
        const pagesTotal = lastCounters ? Math.max(0, formData.counter_total - lastCounters.counter_total) : formData.counter_total

        dataToSend = {
          printer_id: formData.printer_id,
          year: formData.year,
          month: formData.month,
          counter_bw: formData.counter_bw,
          counter_color: formData.counter_color,
          counter_total: formData.counter_total,
          previous_counter_bw: lastCounters?.counter_bw || 0,
          previous_counter_color: lastCounters?.counter_color || 0,
          previous_counter_total: lastCounters?.counter_total || 0,
          pages_printed_bw: pagesBW,
          pages_printed_color: pagesColor,
          pages_printed_total: pagesTotal,
          notes: formData.notes
        }
      } else {
        // Manual entry mode - use the manual form data directly
        dataToSend = {
          printer_id: manualFormData.printer_id,
          year: manualFormData.year,
          month: manualFormData.month,
          counter_bw: 0, // Set to 0 as we don't have counter data
          counter_color: 0,
          counter_total: 0,
          previous_counter_bw: 0,
          previous_counter_color: 0,
          previous_counter_total: 0,
          pages_printed_bw: manualFormData.pages_printed_bw,
          pages_printed_color: manualFormData.pages_printed_color,
          pages_printed_total: manualFormData.pages_printed_total,
          notes: manualFormData.notes
        }
      }
      
      const url = editingCounter 
        ? `${API_BASE}/counters/${editingCounter.id}`
        : `${API_BASE}/counters`
      
      const method = editingCounter ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        fetchData()
        handleCancel() // This will reset both forms and close modal
        alert(editingCounter ? 'Counter updated successfully!' : 'Counter added successfully!')
      } else {
        const errorData = await response.json()
        alert(`Error saving counter: ${errorData.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving counter:', error)
      alert('Error saving counter')
    }
  }

  const handleEdit = (counter: MonthlyCounter) => {
    // Get the current state of the counter from the updated counters array
    const currentCounter = counters.find(c => c.id === counter.id)
    if (!currentCounter) {
      alert('Counter record not found.')
      return
    }
    
    if (currentCounter.locked) {
      alert('This counter record is locked. Unlock it first to edit.')
      return
    }
    
    setEditingCounter(currentCounter)
    setFormData({
      printer_id: currentCounter.printer_id,
      year: currentCounter.year,
      month: currentCounter.month,
      counter_bw: currentCounter.counter_bw,
      counter_color: currentCounter.counter_color,
      counter_total: currentCounter.counter_total,
      notes: currentCounter.notes || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this counter record?')) return

    try {
      const response = await fetch(`${API_BASE}/counters/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchData()
        alert('Counter deleted successfully!')
      } else {
        alert('Error deleting counter')
      }
    } catch (error) {
      console.error('Error deleting counter:', error)
      alert('Error deleting counter')
    }
  }

  const handleToggleLock = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/counters/${id}/toggle-lock`, {
        method: 'PATCH',
      })

      if (response.ok) {
        // Get the updated counter data from the response
        const updatedCounter = await response.json()
        
        // Update the local state immediately
        setCounters(prevCounters => 
          prevCounters.map(counter => 
            counter.id === id ? updatedCounter : counter
          )
        )
        
        console.log('Lock status toggled successfully', updatedCounter)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail || 'Failed to toggle lock'}`)
      }
    } catch (error) {
      console.error('Error toggling lock:', error)
      alert('Error toggling lock')
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingCounter(null)
    setActiveTab('counter')
    setLastCounters(null)
    setFormData({
      printer_id: 0,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      counter_bw: 0,
      counter_color: 0,
      counter_total: 0,
      notes: ''
    })
    setManualFormData({
      printer_id: 0,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      pages_printed_bw: 0,
      pages_printed_color: 0,
      pages_printed_total: 0,
      notes: ''
    })
  }

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1]
  }

  // Get unique suppliers from printers
  const getUniqueSuppliers = () => {
    const suppliers = printers
      .map(printer => printer.supplier)
      .filter(supplier => supplier && supplier.trim() !== '')
      .filter((supplier, index, array) => array.indexOf(supplier) === index)
      .sort()
    return suppliers
  }

  // Filter counters based on selected filters
  const filteredCounters = counters.filter(counter => {
    // Filter by printer
    if (selectedPrinter > 0 && counter.printer_id !== selectedPrinter) {
      return false
    }
    
    // Filter by supplier
    if (selectedSupplier !== '') {
      const printer = printers.find(p => p.id === counter.printer_id)
      if (!printer || printer.supplier !== selectedSupplier) {
        return false
      }
    }
    
    return true
  })

  const calculatePagesDifference = (current: number, previous: number) => {
    return Math.max(0, current - previous)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading counters...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Monthly Counters Management</h1>
          <p className="mt-2 text-gray-600">Track and manage printer usage counters by month</p>
        </div>

        {/* Controls */}
        <div className="card mb-8">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* View Mode Selector */}
                <div>
                  <label className="form-label">View Mode</label>
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'form' | 'table')}
                    className="form-select"
                  >
                    <option value="form">Form View</option>
                    <option value="table">Comparison Table</option>
                  </select>
                </div>

                {/* Year Selector - Only show in form mode */}
                {viewMode === 'form' && (
                  <div>
                    <label className="form-label">Year</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="form-select"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month Selector - Only show in form mode */}
                {viewMode === 'form' && (
                  <div>
                    <label className="form-label">Month</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="form-select"
                    >
                      <option value={0}>Todos los meses</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month}>
                          {getMonthName(month)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Printer Selector - Only show in form mode */}
                {viewMode === 'form' && (
                  <div>
                    <label className="form-label">Printer</label>
                    <select
                      value={selectedPrinter}
                      onChange={(e) => setSelectedPrinter(parseInt(e.target.value))}
                      className="form-select"
                    >
                      <option value={0}>All Printers</option>
                      {printers.map(printer => (
                        <option key={printer.id} value={printer.id}>
                          {printer.brand} {printer.model} - {printer.ip}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Supplier Selector - Only show in form mode */}
                {viewMode === 'form' && (
                  <div>
                    <label className="form-label">Supplier</label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      className="form-select"
                    >
                      <option value="">All Suppliers</option>
                      {getUniqueSuppliers().map(supplier => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {viewMode === 'form' && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="btn btn-primary"
                >
                  Add New Counter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form View - Regular counters table */}
        {viewMode === 'form' && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">
                Counters for {selectedMonth === 0 ? 'todos los meses de' : getMonthName(selectedMonth)} {selectedYear}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Printer</th>
                    <th>Location</th>
                    <th>Month</th>
                    <th>B&W Counter</th>
                    <th>Color Counter</th>
                    <th>Total Counter</th>
                    <th>B&W Pages</th>
                    <th>Color Pages</th>
                    <th>Total Pages</th>
                    <th>Recorded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
              <tbody>
                {filteredCounters.map((counter) => (
                  <tr key={counter.id}>
                    <td>
                      <div>
                        <div className="font-medium text-gray-900">
                          {counter.printer.brand} {counter.printer.model}
                        </div>
                        <div className="text-sm text-gray-500">{counter.printer.ip}</div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">
                      {counter.printer.location || 'N/A'}
                    </td>
                    <td className="text-sm text-gray-600">
                      <div className="font-medium">{getMonthName(counter.month)} {counter.year}</div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div className="font-medium">{counter.counter_bw.toLocaleString()}</div>
                        <div className="text-gray-500">
                          (prev: {counter.previous_counter_bw.toLocaleString()})
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div className="font-medium">{counter.counter_color.toLocaleString()}</div>
                        <div className="text-gray-500">
                          (prev: {counter.previous_counter_color.toLocaleString()})
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <div className="font-medium">{counter.counter_total.toLocaleString()}</div>
                        <div className="text-gray-500">
                          (prev: {counter.previous_counter_total.toLocaleString()})
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {counter.pages_printed_bw.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">
                        {counter.pages_printed_color.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {counter.pages_printed_total.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {new Date(counter.recorded_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleLock(counter.id)}
                          className={`btn btn-ghost btn-sm ${counter.locked ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}`}
                          title={counter.locked ? 'Unlock record for editing' : 'Lock record to prevent editing'}
                        >
                          {counter.locked ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(counter)}
                          className={`btn btn-ghost btn-sm ${counter.locked ? 'text-gray-400 cursor-not-allowed' : ''}`}
                          disabled={counter.locked}
                          title={counter.locked ? 'Unlock record first to edit' : 'Edit record'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary totals */}
            {filteredCounters.length > 0 && (
              <div className="border-t bg-gray-50 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total B&W Pages</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {filteredCounters.reduce((sum, counter) => sum + counter.pages_printed_bw, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total Color Pages</div>
                    <div className="text-2xl font-bold text-green-600">
                      {filteredCounters.reduce((sum, counter) => sum + counter.pages_printed_color, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total Pages</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {filteredCounters.reduce((sum, counter) => sum + counter.pages_printed_total, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  Summary for {filteredCounters.length} printer{filteredCounters.length !== 1 ? 's' : ''} in {selectedMonth === 0 ? `all months of ${selectedYear}` : `${getMonthName(selectedMonth)} ${selectedYear}`}
                </div>
              </div>
            )}

            {filteredCounters.length === 0 && counters.length > 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No counter records match the filters</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters to see more results.
                </p>
              </div>
            )}

            {counters.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No counter records</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by adding counter records for {selectedMonth === 0 ? `el año ${selectedYear}` : `${getMonthName(selectedMonth)} ${selectedYear}`}.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Table View - Comparison table */}
        {viewMode === 'table' && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">
                Active Printers Counter Comparison
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Current month vs previous month comparison for all active printers
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="border-r">Printer</th>
                    <th rowSpan={2} className="border-r">Location</th>
                    <th colSpan={4} className="text-center border-r">Current Month</th>
                    <th colSpan={4} className="text-center border-r">Previous Month</th>
                    <th colSpan={3} className="text-center">Difference</th>
                  </tr>
                  <tr>
                    <th className="text-xs">B&W</th>
                    <th className="text-xs">Color</th>
                    <th className="text-xs">Total</th>
                    <th className="text-xs border-r">Pages</th>
                    <th className="text-xs">B&W</th>
                    <th className="text-xs">Color</th>
                    <th className="text-xs">Total</th>
                    <th className="text-xs border-r">Pages</th>
                    <th className="text-xs">B&W</th>
                    <th className="text-xs">Color</th>
                    <th className="text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((item: any, index: number) => (
                    <tr key={item.printer.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="border-r">
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.printer.brand} {item.printer.model}
                          </div>
                          <div className="text-sm text-gray-500">{item.printer.ip}</div>
                          {item.printer.hostname && (
                            <div className="text-xs text-blue-600">{item.printer.hostname}</div>
                          )}
                        </div>
                      </td>
                      <td className="border-r">
                        <div className="text-sm">
                          {item.printer.location || 'N/A'}
                          {item.printer.building && (
                            <div className="text-xs text-gray-500">{item.printer.building}</div>
                          )}
                        </div>
                      </td>
                      
                      {/* Current Month */}
                      <td className="text-center">
                        {item.currentMonth.counter ? 
                          item.currentMonth.counter.counter_bw.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.currentMonth.counter ? 
                          item.currentMonth.counter.counter_color.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.currentMonth.counter ? 
                          item.currentMonth.counter.counter_total.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center border-r">
                        {item.currentMonth.counter ? 
                          (item.currentMonth.counter.pages_printed_bw + item.currentMonth.counter.pages_printed_color).toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      
                      {/* Previous Month */}
                      <td className="text-center">
                        {item.previousMonth.counter ? 
                          item.previousMonth.counter.counter_bw.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.previousMonth.counter ? 
                          item.previousMonth.counter.counter_color.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.previousMonth.counter ? 
                          item.previousMonth.counter.counter_total.toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center border-r">
                        {item.previousMonth.counter ? 
                          (item.previousMonth.counter.pages_printed_bw + item.previousMonth.counter.pages_printed_color).toLocaleString() : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      
                      {/* Difference */}
                      <td className="text-center">
                        {item.currentMonth.counter && item.previousMonth.counter ? 
                          <span className={`font-medium ${
                            (item.currentMonth.counter.counter_bw - item.previousMonth.counter.counter_bw) > 0 ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            +{(item.currentMonth.counter.counter_bw - item.previousMonth.counter.counter_bw).toLocaleString()}
                          </span> : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.currentMonth.counter && item.previousMonth.counter ? 
                          <span className={`font-medium ${
                            (item.currentMonth.counter.counter_color - item.previousMonth.counter.counter_color) > 0 ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            +{(item.currentMonth.counter.counter_color - item.previousMonth.counter.counter_color).toLocaleString()}
                          </span> : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                      <td className="text-center">
                        {item.currentMonth.counter && item.previousMonth.counter ? 
                          <span className={`font-medium ${
                            (item.currentMonth.counter.counter_total - item.previousMonth.counter.counter_total) > 0 ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            +{(item.currentMonth.counter.counter_total - item.previousMonth.counter.counter_total).toLocaleString()}
                          </span> : 
                          <span className="text-gray-400">-</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {comparisonData.length === 0 && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No active printers found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Active printers with counter data will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add/Edit Counter Modal */}
        {showAddForm && (
          <div className="modal-overlay">
            <div className="modal-content w-11/12 max-w-3xl">
              <div className="modal-header">
                <h3 className="text-xl font-bold">
                  {editingCounter ? 'Edit Counter Record' : 'Add Counter Record'}
                </h3>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('counter')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'counter'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={!!editingCounter}
                  >
                    Counter Reading
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'manual'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={!!editingCounter}
                  >
                    Manual Entry
                  </button>
                </nav>
              </div>

              <form onSubmit={handleSubmit} className="modal-body space-y-6">
                {activeTab === 'counter' && (
                  <>
                    {/* Printer Selection for Counter Mode */}
                    <div>
                      <label className="form-label">Printer *</label>
                      <select
                        value={formData.printer_id}
                        onChange={(e) => {
                          const printerId = parseInt(e.target.value)
                          setFormData({...formData, printer_id: printerId})
                          if (printerId > 0 && !editingCounter) {
                            fetchLastCounters(printerId)
                          }
                        }}
                        className="form-select"
                        required
                        disabled={!!editingCounter}
                      >
                        <option value={0}>Select a printer</option>
                        {printers.map((printer) => (
                          <option key={printer.id} value={printer.id}>
                            {printer.brand} {printer.model} - {printer.ip} 
                            {printer.location && ` (${printer.location})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Last Counters Display */}
                    {lastCounters && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">
                          Last Counter Reading ({getMonthName(lastCounters.month)} {lastCounters.year})
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-blue-700">B&W:</span> {lastCounters.counter_bw.toLocaleString()}
                          </div>
                          <div>
                            <span className="text-blue-700">Color:</span> {lastCounters.counter_color.toLocaleString()}
                          </div>
                          <div>
                            <span className="text-blue-700">Total:</span> {lastCounters.counter_total.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Year *</label>
                        <select
                          value={formData.year}
                          onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                          className="form-select"
                          required
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Month *</label>
                        <select
                          value={formData.month}
                          onChange={(e) => setFormData({...formData, month: parseInt(e.target.value)})}
                          className="form-select"
                          required
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>
                              {getMonthName(month)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Current Counters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Current B&W Counter *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.counter_bw}
                          onChange={(e) => setFormData({...formData, counter_bw: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                        {lastCounters && formData.counter_bw > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            Pages printed: {Math.max(0, formData.counter_bw - lastCounters.counter_bw).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="form-label">Current Color Counter *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.counter_color}
                          onChange={(e) => setFormData({...formData, counter_color: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                        {lastCounters && formData.counter_color > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            Pages printed: {Math.max(0, formData.counter_color - lastCounters.counter_color).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="form-label">Current Total Counter *</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.counter_total}
                          onChange={(e) => setFormData({...formData, counter_total: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                        {lastCounters && formData.counter_total > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            Pages printed: {Math.max(0, formData.counter_total - lastCounters.counter_total).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="form-label">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        rows={3}
                        className="form-input"
                        placeholder="Additional notes about this counter reading..."
                      />
                    </div>
                  </>
                )}

                {activeTab === 'manual' && (
                  <>
                    {/* Printer Selection for Manual Mode */}
                    <div>
                      <label className="form-label">Printer *</label>
                      <select
                        value={manualFormData.printer_id}
                        onChange={(e) => setManualFormData({...manualFormData, printer_id: parseInt(e.target.value)})}
                        className="form-select"
                        required
                      >
                        <option value={0}>Select a printer</option>
                        {printers.map((printer) => (
                          <option key={printer.id} value={printer.id}>
                            {printer.brand} {printer.model} - {printer.ip} 
                            {printer.location && ` (${printer.location})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Year *</label>
                        <select
                          value={manualFormData.year}
                          onChange={(e) => setManualFormData({...manualFormData, year: parseInt(e.target.value)})}
                          className="form-select"
                          required
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Month *</label>
                        <select
                          value={manualFormData.month}
                          onChange={(e) => setManualFormData({...manualFormData, month: parseInt(e.target.value)})}
                          className="form-select"
                          required
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>
                              {getMonthName(month)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Manual Page Counts */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">B&W Pages Printed *</label>
                        <input
                          type="number"
                          min="0"
                          value={manualFormData.pages_printed_bw}
                          onChange={(e) => setManualFormData({...manualFormData, pages_printed_bw: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Color Pages Printed *</label>
                        <input
                          type="number"
                          min="0"
                          value={manualFormData.pages_printed_color}
                          onChange={(e) => setManualFormData({...manualFormData, pages_printed_color: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Total Pages Printed *</label>
                        <input
                          type="number"
                          min="0"
                          value={manualFormData.pages_printed_total}
                          onChange={(e) => setManualFormData({...manualFormData, pages_printed_total: parseInt(e.target.value) || 0})}
                          className="form-input"
                          required
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="form-label">Notes</label>
                      <textarea
                        value={manualFormData.notes}
                        onChange={(e) => setManualFormData({...manualFormData, notes: e.target.value})}
                        rows={3}
                        className="form-input"
                        placeholder="Additional notes about these page counts..."
                      />
                    </div>
                  </>
                )}
              </form>

              <div className="modal-footer">
                <div className="flex justify-between items-center w-full">
                  <div>
                    {editingCounter && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this counter record?')) {
                            handleDelete(editingCounter.id)
                          }
                        }}
                        className="btn btn-danger"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="btn btn-primary"
                    >
                      {editingCounter 
                        ? 'Update Counter' 
                        : activeTab === 'counter' 
                          ? 'Add Counter Reading' 
                          : 'Add Manual Entry'
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}