'use client'

import { useState, useEffect, useMemo } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Printer {
  id: number
  brand: string
  model: string
  ip: string
  location?: string
  supplier?: string
  asset_tag?: string
  serial_number?: string
}

interface MonthlyCounter {
  id: number
  printer_id: number
  printer: {
    brand: string
    model: string
    ip: string
    location?: string
    asset_tag?: string
    serial_number?: string
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
  created_at: string
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
  recorded_at?: string
}

interface ManualCounterForm {
  printer_id: number
  year: number
  month: number
  pages_printed_bw: number
  pages_printed_color: number
  pages_printed_total: number
  notes?: string
  recorded_at?: string
}

export default function Counters() {
  const [counters, setCounters] = useState<MonthlyCounter[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = todos los meses
  const [selectedPrinter, setSelectedPrinter] = useState(0) // 0 = todas las impresoras
  const [selectedSupplier, setSelectedSupplier] = useState('') // '' = todos los proveedores
  const [selectedDate, setSelectedDate] = useState('') // Filtro por fecha específica
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCounter, setEditingCounter] = useState<MonthlyCounter | null>(null)
  const [viewMode, setViewMode] = useState<'form' | 'table'>('form')
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'counter' | 'manual'>('counter')
  const [collectingCounters, setCollectingCounters] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [lastCollectionResult, setLastCollectionResult] = useState<any>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showExecutionHistory, setShowExecutionHistory] = useState(false)
  const [executionHistory, setExecutionHistory] = useState<any[]>([])
  
  // Estados para la ventana de sincronización
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncOption, setSyncOption] = useState<'all' | 'contract' | 'selected'>('all')
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [selectedPrinters, setSelectedPrinters] = useState<number[]>([])
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
    currentPrinter: string
    status: 'preparing' | 'running' | 'completed' | 'error'
    logs: string[]
  } | null>(null)
  
  // Estados para exportación
  const [showExportModal, setShowExportModal] = useState(false)

  // Estados para ordenamiento
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Función para exportar datos filtrados
  const exportFilteredData = (format: 'excel' | 'pdf') => {
    const filteredData = sortedAndFilteredCounters.map(counter => ({
      'Asset Tag': counter.printer.asset_tag || '',
      'Marca': counter.printer.brand,
      'Modelo': counter.printer.model,
      'IP': counter.printer.ip,
      'Ubicación': counter.printer.location || '',
      'Año': counter.year,
      'Mes': getMonthName(counter.month),
      'Contador B/N': counter.counter_bw,
      'Contador Color': counter.counter_color,
      'Contador Total': counter.counter_total,
      'Páginas B/N': counter.pages_printed_bw,
      'Páginas Color': counter.pages_printed_color,
      'Páginas Total': counter.pages_printed_total,
      'Fecha Registro': new Date(counter.recorded_at).toLocaleDateString('es-ES'),
      'Notas': counter.notes || ''
    }))

    if (format === 'excel') {
      exportToExcel(filteredData)
    } else {
      exportToPDF(filteredData)
    }
    setShowExportModal(false)
  }

  // Función para exportar a Excel
  const exportToExcel = (data: any[]) => {
    try {
      // Crear CSV manualmente para evitar dependencias
      const headers = Object.keys(data[0] || {})
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header]
            // Escapar comillas y envolver en comillas si contiene comas
            const stringValue = String(value || '')
            return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue
          }).join(',')
        )
      ].join('\n')

      // Crear y descargar archivo
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      
      const filters = []
      if (selectedPrinter > 0) {
        const printer = printers.find(p => p.id === selectedPrinter)
        filters.push(printer?.asset_tag || `Printer-${selectedPrinter}`)
      }
      if (selectedSupplier) filters.push(selectedSupplier)
      if (selectedMonth > 0) filters.push(getMonthName(selectedMonth))
      filters.push(selectedYear.toString())
      
      const filename = `contadores_${filters.join('_').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      link.download = filename
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Error exportando a Excel:', error)
      alert('Error al exportar a Excel')
    }
  }

  // Función para exportar a PDF
  const exportToPDF = (data: any[]) => {
    try {
      // Crear contenido HTML para imprimir
      const filters = []
      if (selectedPrinter > 0) {
        const printer = printers.find(p => p.id === selectedPrinter)
        filters.push(`Impresora: ${printer?.brand} ${printer?.model} (${printer?.asset_tag})`)
      }
      if (selectedSupplier) filters.push(`Proveedor: ${selectedSupplier}`)
      if (selectedMonth > 0) filters.push(`Mes: ${getMonthName(selectedMonth)}`)
      filters.push(`Año: ${selectedYear}`)

      const headers = Object.keys(data[0] || {})
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reporte de Contadores</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            .filters { margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .date { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            @media print {
              body { margin: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <h1>Reporte de Contadores</h1>
          <div class="filters">
            <strong>Filtros aplicados:</strong><br>
            ${filters.join('<br>')}
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => 
                `<tr>
                  ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                </tr>`
              ).join('')}
            </tbody>
          </table>
          <div class="date">
            Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}
          </div>
        </body>
        </html>
      `

      // Abrir en nueva ventana para imprimir/guardar como PDF
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
      }
    } catch (error) {
      console.error('Error exportando a PDF:', error)
      alert('Error al exportar a PDF')
    }
  }
  
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
    notes: '',
    recorded_at: ''
  })
  const [manualFormData, setManualFormData] = useState<ManualCounterForm>({
    printer_id: 0,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    pages_printed_bw: 0,
    pages_printed_color: 0,
    pages_printed_total: 0,
    notes: '',
    recorded_at: ''
  })

  useEffect(() => {
    fetchData()
    if (viewMode === 'table') {
      fetchComparisonData()
    }
    fetchExecutionHistory() // Cargar historial al inicializar
  }, [selectedYear, selectedMonth, viewMode])

  const fetchExecutionHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/counter-collection/history`)
      if (response.ok) {
        const historyData = await response.json()
        setExecutionHistory(historyData)
      }
    } catch (error) {
      console.error('Error fetching execution history:', error)
    }
  }

  const fetchData = async () => {
    try {
      console.log('🔄 fetchData iniciado con:', { selectedYear, selectedMonth })
      setLoading(true)
      
      // Fetch counters for selected month/year
      let countersUrl = `${API_BASE}/counters?year=${selectedYear}`
      if (selectedMonth > 0) {
        countersUrl += `&month=${selectedMonth}`
      }
      console.log('📡 Cargando contadores desde:', countersUrl)
      const countersResponse = await fetch(countersUrl)
      const countersData = await countersResponse.json()
      console.log('✅ Contadores cargados:', countersData.length, 'registros')
      setCounters(countersData)
      console.log('📊 State counters actualizado con:', countersData.length, 'elementos')

      // Fetch all printers for the form
      const printersResponse = await fetch(`${API_BASE}/printers`)
      const printersData = await printersResponse.json()
      console.log('✅ Impresoras cargadas:', printersData.length, 'registros')
      setPrinters(printersData)
    } catch (error) {
      console.error('❌ Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const forceRefreshData = async () => {
    try {
      console.log('🔄 Forzando actualización de datos después de sincronización...')
      setLoading(true)
      
      // Limpiar datos actuales para forzar re-render
      setCounters([])
      
      // Pequeño delay para asegurar que el estado se limpie
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Recargar datos con timestamp para evitar cache
      const timestamp = new Date().getTime()
      let countersUrl = `${API_BASE}/counters?year=${selectedYear}&_t=${timestamp}`
      if (selectedMonth > 0) {
        countersUrl += `&month=${selectedMonth}`
      }
      
      console.log(`📡 Cargando contadores desde: ${countersUrl}`)
      const countersResponse = await fetch(countersUrl, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      const countersData = await countersResponse.json()
      console.log(`✅ Contadores cargados: ${countersData.length} registros`)
      setCounters(countersData)

      // También actualizar impresoras por si acaso
      const printersResponse = await fetch(`${API_BASE}/printers?_t=${timestamp}`, {
        cache: 'no-cache'
      })
      const printersData = await printersResponse.json()
      setPrinters(printersData)
      
    } catch (error) {
      console.error('Error en actualización forzada:', error)
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
          notes: formData.notes,
          ...(formData.recorded_at && { recorded_at: formData.recorded_at })
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
          notes: manualFormData.notes,
          ...(manualFormData.recorded_at && { recorded_at: manualFormData.recorded_at })
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
      notes: currentCounter.notes || '',
      recorded_at: currentCounter.recorded_at ? new Date(currentCounter.recorded_at).toISOString().slice(0, 16) : ''
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
      notes: '',
      recorded_at: ''
    })
    setManualFormData({
      printer_id: 0,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      pages_printed_bw: 0,
      pages_printed_color: 0,
      pages_printed_total: 0,
      notes: '',
      recorded_at: ''
    })
  }

  const executeSync = async () => {
    if (collectingCounters) return
    
    setCollectingCounters(true)
    setSyncProgress({
      current: 0,
      total: 0,
      currentPrinter: 'Preparando...',
      status: 'preparing',
      logs: ['Iniciando sincronización...']
    })
    
    try {
      // Construir query parameters basado en la opción seleccionada
      const params = new URLSearchParams()
      if (selectedYear !== new Date().getFullYear()) {
        params.append('year', selectedYear.toString())
      }
      if (selectedMonth !== 0) {
        params.append('month', selectedMonth.toString())
      }
      
      // Agregar filtros según la opción seleccionada
      if (syncOption === 'contract' && selectedContract) {
        params.append('lease_contract', selectedContract)
      } else if (syncOption === 'selected' && selectedPrinters.length > 0) {
        params.append('printer_ids', selectedPrinters.join(','))
      }
      
      setSyncProgress(prev => ({
        ...prev!,
        status: 'running',
        logs: [...prev!.logs, `Enviando solicitud a ${syncOption === 'all' ? 'todas las impresoras' : syncOption === 'contract' ? 'impresoras del contrato ' + selectedContract : selectedPrinters.length + ' impresoras seleccionadas'}...`]
      }))
      
      const url = `${API_BASE}/counter-collection/collect${params.toString() ? '?' + params.toString() : ''}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        
        setSyncProgress(prev => ({
          ...prev!,
          status: 'completed',
          current: result.printers_processed,
          total: result.printers_processed,
          currentPrinter: 'Completado',
          logs: [
            ...prev!.logs, 
            `✅ Sincronización completada`,
            `📊 Impresoras procesadas: ${result.printers_processed}`,
            `✅ Exitosas: ${result.printers_successful}`,
            `❌ Fallidas: ${result.printers_failed}`,
            `📝 Contadores creados: ${result.counters_created}`,
            `🔄 Contadores actualizados: ${result.counters_updated}`
          ]
        }))
        
        // Guardar el resultado para mostrarlo en el modal
        setLastCollectionResult(result)
        
        // Guardar en el historial
        await saveExecutionToHistory(result)
        
        // Esperar un momento antes de actualizar los datos para asegurar que la BD se actualice
        setTimeout(async () => {
          console.log('🔄 Iniciando actualización de datos post-sincronización...')
          // Forzar actualización de datos
          await forceRefreshData()
          if (viewMode === 'table') {
            await fetchComparisonData()
          }
          
          console.log('✅ Actualización completada, mostrando resultados...')
          // Mostrar modal de resultados después de actualizar
          setShowSyncModal(false)
          setShowResultsModal(true)
          setSyncProgress(null)
        }, 3000)  // Aumentar a 3 segundos para asegurar que la BD se actualice
        
      } else {
        const errorData = await response.json()
        setSyncProgress(prev => ({
          ...prev!,
          status: 'error',
          logs: [...prev!.logs, `❌ Error: ${errorData.detail || 'Error desconocido'}`]
        }))
        
        const errorResult = {
          success: false,
          message: errorData.detail || 'Error desconocido',
          printers_processed: 0,
          printers_successful: 0,
          printers_failed: 0,
          counters_created: 0,
          counters_updated: 0,
          errors: [errorData.detail || 'Error desconocido'],
          execution_time: 0,
          results: []
        }
        
        await saveExecutionToHistory(errorResult)
      }
      
    } catch (error) {
      setSyncProgress(prev => ({
        ...prev!,
        status: 'error',
        logs: [...prev!.logs, `❌ Error de conexión: ${error}`]
      }))
      
      const errorResult = {
        success: false,
        message: `Error de conexión: ${error}`,
        printers_processed: 0,
        printers_successful: 0,
        printers_failed: 0,
        counters_created: 0,
        counters_updated: 0,
        errors: [`Error de conexión: ${error}`],
        execution_time: 0,
        results: []
      }
      
      await saveExecutionToHistory(errorResult)
    } finally {
      setCollectingCounters(false)
    }
  }

  const saveExecutionToHistory = async (result: any) => {
    try {
      const historyEntry = {
        success: result.success,
        printers_processed: result.printers_processed,
        printers_successful: result.printers_successful,
        printers_failed: result.printers_failed,
        execution_duration_seconds: result.execution_time,
        error_message: result.errors && result.errors.length > 0 ? result.errors.join('; ') : null,
        details: JSON.stringify({
          message: result.message,
          counters_created: result.counters_created,
          counters_updated: result.counters_updated,
          results: result.results || []
        })
      }

      const response = await fetch(`${API_BASE}/counter-collection/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(historyEntry)
      })
      
      if (!response.ok) {
        console.error('Failed to save execution to history')
      }
    } catch (error) {
      console.error('Error saving to history:', error)
    }
  }

  const loadExecutionHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/counter-collection/history?limit=50`)
      if (response.ok) {
        const data = await response.json()
        setExecutionHistory(data)
      } else {
        console.error('Failed to load execution history')
      }
    } catch (error) {
      console.error('Error loading execution history:', error)
    }
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

  const getUniqueContracts = () => {
    const contracts = printers
      .map(printer => (printer as any).lease_contract)
      .filter(contract => contract && contract.trim() !== '')
      .filter((contract, index, array) => array.indexOf(contract) === index)
      .sort()
    return contracts
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
    
    // Filter by specific date
    if (selectedDate) {
      const counterDate = new Date(counter.recorded_at).toISOString().split('T')[0]
      if (counterDate !== selectedDate) {
        return false
      }
    }
    
    return true
  })

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Función para obtener el valor ordenable de una fila
  const getSortValue = (counter: any, field: string) => {
    const printer = printers.find(p => p.id === counter.printer_id)
    
    switch (field) {
      case 'printer':
        return `${printer?.brand || ''} ${printer?.model || ''}`.toLowerCase() || ''
      case 'location':
        return printer?.location?.toLowerCase() || ''
      case 'month':
        return `${counter.year}-${counter.month.toString().padStart(2, '0')}`
      case 'bw_counter':
        return Number(counter.bw_counter) || 0
      case 'color_counter':
        return Number(counter.color_counter) || 0
      case 'total_counter':
        return (Number(counter.bw_counter) || 0) + (Number(counter.color_counter) || 0)
      case 'bw_pages':
        return counter.pages_printed_bw || 0
      case 'color_pages':
        return counter.pages_printed_color || 0
      case 'total_pages':
        return counter.pages_printed_total || 0
      case 'recorded_at':
        return new Date(counter.recorded_at).getTime()
      default:
        return ''
    }
  }

  // Componente para cabecera ordenable
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const getSortIcon = () => {
      if (sortField !== field) {
        return <span className="text-gray-400 ml-1">↕️</span>
      }
      return sortDirection === 'asc' ? 
        <span className="text-blue-600 ml-1">↑</span> : 
        <span className="text-blue-600 ml-1">↓</span>
    }

    return (
      <th 
        className="cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center justify-between">
          {children}
          {getSortIcon()}
        </div>
      </th>
    )
  }

  // Aplicar ordenamiento a los counters filtrados
  const sortedAndFilteredCounters = useMemo(() => {
    if (!sortField) return filteredCounters
    
    return [...filteredCounters].sort((a, b) => {
      const aValue = getSortValue(a, sortField)
      const bValue = getSortValue(b, sortField)
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === 'asc' ? comparison : -comparison
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue
        return sortDirection === 'asc' ? comparison : -comparison
      }
      
      return 0
    })
  }, [filteredCounters, sortField, sortDirection, printers])

  // Paginación
  const totalItems = sortedAndFilteredCounters.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCounters = sortedAndFilteredCounters.slice(startIndex, endIndex)

  // Reset a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedYear, selectedMonth, selectedPrinter, selectedSupplier, selectedDate])

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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Monthly Counters Management</h1>
            <p className="mt-2 text-gray-600">Track and manage printer usage counters by month</p>
          </div>
          <a
            href="/contador-automatico"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            title="Auto Counters - Recolección automática"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto Counters
          </a>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* View Mode Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">View Mode</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as 'form' | 'table')}
                  className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="form">Form View</option>
                  <option value="table">Comparison Table</option>
                </select>
              </div>

              {/* Divider */}
              {viewMode === 'form' && <div className="h-8 w-px bg-gray-300"></div>}

              {/* Year Selector */}
              {viewMode === 'form' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Month Selector */}
              {viewMode === 'form' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value={0}>Todos</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {getMonthName(month)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Printer Selector */}
              {viewMode === 'form' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Printer</label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(parseInt(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500 max-w-xs"
                  >
                    <option value={0}>All Printers</option>
                    {printers.map(printer => (
                      <option key={printer.id} value={printer.id}>
                        {printer.brand} {printer.model} - {printer.asset_tag}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Supplier Selector */}
              {viewMode === 'form' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
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

              {/* Date Filter */}
              {viewMode === 'form' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Fecha específica</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
                  />
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                      title="Limpiar filtro de fecha"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Action Buttons */}
              {viewMode === 'form' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Counter
                  </button>
                  
                  <button
                    onClick={() => setShowSyncModal(true)}
                    disabled={collectingCounters}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Recolectar contadores"
                  >
                    {collectingCounters ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Recolectando...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recolectar Contadores
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      await loadExecutionHistory()
                      setShowExecutionHistory(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                    title="Ver historial"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Ver Historial
                  </button>
                  
                  <button
                    onClick={forceRefreshData}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Actualizar"
                    disabled={loading}
                  >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Actualizar
                  </button>
                  
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Exportar"
                    disabled={sortedAndFilteredCounters.length === 0}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedPrinter(0)
                      setSelectedSupplier('')
                      setSelectedMonth(0)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                    title="Limpiar filtros"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Limpiar Filtros
                  </button>
                </div>
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
                    <SortableHeader field="printer">Printer</SortableHeader>
                    <SortableHeader field="location">Location</SortableHeader>
                    <SortableHeader field="month">Month</SortableHeader>
                    <SortableHeader field="bw_counter">B&W Counter</SortableHeader>
                    <SortableHeader field="color_counter">Color Counter</SortableHeader>
                    <SortableHeader field="total_counter">Total Counter</SortableHeader>
                    <SortableHeader field="bw_pages">B&W Pages</SortableHeader>
                    <SortableHeader field="color_pages">Color Pages</SortableHeader>
                    <SortableHeader field="total_pages">Total Pages</SortableHeader>
                    <SortableHeader field="recorded_at">Fecha de Registro</SortableHeader>
                    <th>Actions</th>
                  </tr>
                </thead>
              <tbody>
                {paginatedCounters.map((counter) => (
                  <tr key={counter.id}>
                    <td>
                      <div>
                        <div className="font-medium text-gray-900">
                          {counter.printer.brand} {counter.printer.model}
                        </div>
                        <div className="text-sm text-gray-600">
                          Asset: {counter.printer.asset_tag || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          S/N: {counter.printer.serial_number || 'N/A'}
                        </div>
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
                      <div 
                        className="cursor-help" 
                        title={`Registrado: ${new Date(counter.recorded_at).toLocaleString('es-ES')}\nCreado: ${new Date(counter.created_at).toLocaleString('es-ES')}`}
                      >
                        <div className="font-medium">
                          {new Date(counter.recorded_at).toLocaleDateString('es-ES')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(counter.recorded_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          })}
                        </div>
                        {counter.notes && (
                          <div className="text-xs text-blue-500 mt-1" title={counter.notes}>
                            📝 {counter.notes.length > 20 ? counter.notes.substring(0, 20) + '...' : counter.notes}
                          </div>
                        )}
                      </div>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="border-t bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
                      <span className="font-medium">{Math.min(endIndex, totalItems)}</span> de{' '}
                      <span className="font-medium">{totalItems}</span> registros
                    </div>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-3 focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value={10}>10 por página</option>
                      <option value={20}>20 por página</option>
                      <option value={50}>50 por página</option>
                      <option value={100}>100 por página</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Primera página"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Página anterior"
                    >
                      ‹
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-sm rounded-md border ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 bg-white hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Página siguiente"
                    >
                      ›
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Última página"
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary totals */}
            {sortedAndFilteredCounters.length > 0 && (
              <div className="border-t bg-gray-50 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total B&W Pages</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {sortedAndFilteredCounters.reduce((sum, counter) => sum + counter.pages_printed_bw, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total Color Pages</div>
                    <div className="text-2xl font-bold text-green-600">
                      {sortedAndFilteredCounters.reduce((sum, counter) => sum + counter.pages_printed_color, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-500">Total Pages</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {sortedAndFilteredCounters.reduce((sum, counter) => sum + counter.pages_printed_total, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  Summary for {sortedAndFilteredCounters.length} printer{sortedAndFilteredCounters.length !== 1 ? 's' : ''} in {selectedMonth === 0 ? `all months of ${selectedYear}` : `${getMonthName(selectedMonth)} ${selectedYear}`}
                </div>
              </div>
            )}

            {sortedAndFilteredCounters.length === 0 && counters.length > 0 && (
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
                          <div className="text-sm text-gray-600">
                            Asset: {item.printer.asset_tag || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            S/N: {item.printer.serial_number || 'N/A'}
                          </div>
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
                            {printer.brand} {printer.model} - {printer.asset_tag} - S/N: {printer.serial_number || 'N/A'}
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

                    {/* Recorded Date */}
                    <div>
                      <label className="form-label">Fecha de Registro (opcional)</label>
                      <input
                        type="datetime-local"
                        value={formData.recorded_at}
                        onChange={(e) => setFormData({...formData, recorded_at: e.target.value})}
                        className="form-input"
                        placeholder="Si no se especifica, se usará la fecha actual"
                      />
                      <small className="text-gray-500 text-sm">
                        Si no se especifica una fecha, se registrará con la fecha y hora actual. 
                        Útil para cargar registros históricos.
                      </small>
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
                            {printer.brand} {printer.model} - {printer.asset_tag} - S/N: {printer.serial_number || 'N/A'}
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

                    {/* Recorded Date */}
                    <div>
                      <label className="form-label">Fecha de Registro (opcional)</label>
                      <input
                        type="datetime-local"
                        value={manualFormData.recorded_at}
                        onChange={(e) => setManualFormData({...manualFormData, recorded_at: e.target.value})}
                        className="form-input"
                        placeholder="Si no se especifica, se usará la fecha actual"
                      />
                      <small className="text-gray-500 text-sm">
                        Si no se especifica una fecha, se registrará con la fecha y hora actual. 
                        Útil para cargar registros históricos.
                      </small>
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

        {/* Sync Configuration Modal */}
        {showSyncModal && (
          <div className="modal-overlay">
            <div className="modal-content w-11/12 max-w-2xl">
              <div className="modal-header">
                <h3 className="text-xl font-bold">Configuración de Sincronización</h3>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ¿Qué impresoras desea sincronizar?
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="syncOption"
                          value="all"
                          checked={syncOption === 'all'}
                          onChange={(e) => setSyncOption(e.target.value as 'all' | 'contract' | 'selected')}
                          className="mr-2"
                        />
                        Todas las impresoras activas
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="syncOption"
                          value="contract"
                          checked={syncOption === 'contract'}
                          onChange={(e) => setSyncOption(e.target.value as 'all' | 'contract' | 'selected')}
                          className="mr-2"
                        />
                        Impresoras asociadas a un contrato específico
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="syncOption"
                          value="selected"
                          checked={syncOption === 'selected'}
                          onChange={(e) => setSyncOption(e.target.value as 'all' | 'contract' | 'selected')}
                          className="mr-2"
                        />
                        Impresoras seleccionadas manualmente
                      </label>
                    </div>
                  </div>

                  {syncOption === 'contract' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Seleccionar Contrato:
                      </label>
                      <select
                        value={selectedContract}
                        onChange={(e) => setSelectedContract(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        <option value="">Seleccione un contrato</option>
                        {getUniqueContracts().map(contract => (
                          <option key={contract} value={contract}>
                            {contract}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {syncOption === 'selected' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Seleccionar Impresoras:
                      </label>
                      <div className="max-h-40 overflow-y-auto border border-gray-300 rounded p-3 space-y-2">
                        {printers.filter(p => (p as any).status === 'active').map(printer => (
                          <label key={printer.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedPrinters.includes(printer.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPrinters([...selectedPrinters, printer.id])
                                } else {
                                  setSelectedPrinters(selectedPrinters.filter(id => id !== printer.id))
                                }
                              }}
                              className="mr-2"
                            />
                            {printer.brand} {printer.model} - {printer.ip} ({printer.location})
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {syncProgress && (
                    <div className="border border-gray-300 rounded p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Progreso de Sincronización</span>
                        <span className={`px-2 py-1 rounded text-sm ${
                          syncProgress.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                          syncProgress.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
                          syncProgress.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {syncProgress.status === 'preparing' ? 'Preparando' :
                           syncProgress.status === 'running' ? 'Ejecutando' :
                           syncProgress.status === 'completed' ? 'Completado' :
                           'Error'}
                        </span>
                      </div>
                      
                      {syncProgress.total > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progreso: {syncProgress.current}/{syncProgress.total}</span>
                            <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{width: `${(syncProgress.current / syncProgress.total) * 100}%`}}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Estado actual:</strong> {syncProgress.currentPrinter}
                      </div>
                      
                      <div className="max-h-32 overflow-y-auto">
                        <div className="text-xs space-y-1">
                          {syncProgress.logs.map((log, index) => (
                            <div key={index} className="text-gray-700">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="btn btn-secondary mr-2"
                  disabled={collectingCounters}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (syncOption === 'contract' && !selectedContract) {
                      alert('Por favor seleccione un contrato')
                      return
                    }
                    if (syncOption === 'selected' && selectedPrinters.length === 0) {
                      alert('Por favor seleccione al menos una impresora')
                      return
                    }
                    await executeSync()
                  }}
                  className="btn btn-primary"
                  disabled={collectingCounters || (syncOption === 'contract' && !selectedContract) || (syncOption === 'selected' && selectedPrinters.length === 0)}
                >
                  {collectingCounters ? 'Sincronizando...' : 'Iniciar Sincronización'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {showResultsModal && lastCollectionResult && (
          <div className="modal-overlay">
            <div className="modal-content w-11/12 max-w-4xl">
              <div className="modal-header">
                <h3 className="text-xl font-bold">Resultados de Sincronización</h3>
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {lastCollectionResult.printers_processed}
                    </div>
                    <div className="text-sm text-blue-600">Procesadas</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {lastCollectionResult.printers_successful}
                    </div>
                    <div className="text-sm text-green-600">Exitosas</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {lastCollectionResult.printers_failed}
                    </div>
                    <div className="text-sm text-red-600">Fallidas</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {(lastCollectionResult.counters_created || 0) + (lastCollectionResult.counters_updated || 0)}
                    </div>
                    <div className="text-sm text-purple-600">Contadores</div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Mensaje:</h4>
                  <p className={`p-3 rounded ${lastCollectionResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {lastCollectionResult.message}
                  </p>
                </div>

                {lastCollectionResult.execution_time && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Tiempo de Ejecución:</h4>
                    <p className="text-gray-600">{lastCollectionResult.execution_time.toFixed(2)} segundos</p>
                  </div>
                )}

                {lastCollectionResult.errors && lastCollectionResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Errores:</h4>
                    <div className="bg-red-50 p-3 rounded max-h-32 overflow-y-auto">
                      {lastCollectionResult.errors.map((error: string, index: number) => (
                        <div key={index} className="text-red-800 text-sm mb-1">
                          • {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastCollectionResult.results && lastCollectionResult.results.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Detalles por Impresora:</h4>
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-2 py-1 text-left">Impresora</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">IP</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Estado</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">BW</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Color</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Total</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lastCollectionResult.results.map((result: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-1">{result.printer_name}</td>
                              <td className="border border-gray-300 px-2 py-1">{result.printer_ip}</td>
                              <td className="border border-gray-300 px-2 py-1">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.success ? 'Éxito' : 'Error'}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {result.counter_bw !== null ? result.counter_bw : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {result.counter_color !== null ? result.counter_color : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {result.counter_total !== null ? result.counter_total : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {result.action_taken || (result.success ? 'Actualizado' : 'Error')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Execution History Modal */}
        {showExecutionHistory && (
          <div className="modal-overlay">
            <div className="modal-content w-11/12 max-w-5xl">
              <div className="modal-header">
                <h3 className="text-xl font-bold">Historial de Ejecuciones</h3>
                <button
                  onClick={() => setShowExecutionHistory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {executionHistory.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No hay registros de ejecuciones aún
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Fecha</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Exitosos</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Fallidos</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Total</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Tiempo</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executionHistory.map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              {record.execution_time ? new Date(record.execution_time).toLocaleString('es-ES') : 'N/A'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-green-600 font-semibold">
                              {record.printers_successful || 0}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">
                              {record.printers_failed || 0}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {record.printers_processed || 0}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {record.execution_duration_seconds 
                                ? `${record.execution_duration_seconds.toFixed(2)}s` 
                                : 'N/A'
                              }
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <span className={`px-2 py-1 rounded text-sm ${
                                record.success 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {record.success ? 'Completado' : 'Fallido'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setShowExecutionHistory(false)}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999
            }}
            onClick={() => setShowExportModal(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                border: '5px solid red',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'black' }}>
                📥 Exportar Contadores
              </h3>
              
              <div style={{ marginBottom: '1.5rem', color: 'black' }}>
                <p style={{ marginBottom: '1rem' }}>
                  Se exportarán <strong>{sortedAndFilteredCounters.length}</strong> registros con los filtros aplicados
                </p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <p style={{ marginBottom: '1rem', color: 'black' }}>Seleccione el formato de exportación:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <button
                    onClick={() => exportFilteredData('excel')}
                    style={{
                      backgroundColor: '#22c55e',
                      color: 'white',
                      padding: '1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📊</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Excel (CSV)</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Archivo de datos</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => exportFilteredData('pdf')}
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      padding: '1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>PDF</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Reporte imprimible</div>
                    </div>
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}