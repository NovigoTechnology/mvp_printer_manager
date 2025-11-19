'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Printer {
  id: number
  ip_address: string
  location?: string
  model?: string
  brand?: string
}

interface Contract {
  id: number
  contract_number: string
  client_name: string
  contract_type: string
  status: string
  printers?: Printer[]
}

interface BillingPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  cut_off_date: string
  status: string
  description?: string
  created_at: string
}

interface CounterReading {
  id: number
  printer_id: number
  billing_period_id: number
  reading_date: string
  counter_bw_current: number
  counter_color_current: number
  counter_total_current: number
  prints_bw_period: number
  prints_color_period: number
  prints_total_period: number
  reading_method: string
  notes?: string
}

interface Invoice {
  id: number
  invoice_number: string
  contract_id: number
  billing_period_id: number
  invoice_date: string
  due_date?: string
  period_start: string
  period_end: string
  subtotal: number
  tax_amount: number
  total_amount: number
  status: string
  currency: string
}

interface DashboardMetrics {
  totalInvoices: number
  totalRevenue: number
  pendingInvoices: number
  overdueInvoices: number
  periodsCount: number
  activeContracts: number
  readingsThisMonth: number
  revenueByPeriod: Array<{
    period: string
    revenue: number
  }>
}

export default function Billing() {
  const [activeTab, setActiveTab] = useState('periods')
  const [periods, setPeriods] = useState<BillingPeriod[]>([])
  const [readings, setReadings] = useState<CounterReading[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false)
  const [showEditPeriodModal, setShowEditPeriodModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<BillingPeriod | null>(null)
  const [showNewReadingModal, setShowNewReadingModal] = useState(false)
  const [showBulkReadingModal, setShowBulkReadingModal] = useState(false)
  const [showSnmpBulkModal, setShowSnmpBulkModal] = useState(false)
  const [snmpLoading, setSnmpLoading] = useState(false)
  const [snmpResults, setSnmpResults] = useState<any>(null)

  const [newPeriod, setNewPeriod] = useState({
    name: '',
    start_date: '',
    end_date: '',
    cut_off_date: '',
    description: ''
  })

  const [newReading, setNewReading] = useState({
    printer_id: '',
    billing_period_id: '',
    reading_date: '',
    counter_bw_current: 0,
    counter_color_current: 0,
    counter_total_current: 0,
    reading_method: 'manual',
    notes: ''
  })

  const [bulkReading, setBulkReading] = useState({
    contract_id: '',
    billing_period_id: '',
    reading_date: '',
    reading_method: 'manual',
    notes: '',
    printerReadings: [] as Array<{
      printer_id: number
      counter_bw_current: number
      counter_color_current: number
      counter_total_current: number
    }>
  })

  const [snmpReading, setSnmpReading] = useState({
    period_id: '',
    contract_id: ''
  })

  useEffect(() => {
    fetchData()
    if (showNewReadingModal || showBulkReadingModal) {
      fetchContracts()
    }
    if (activeTab === 'dashboard') {
      fetchDashboardMetrics()
    }
  }, [activeTab, showNewReadingModal, showBulkReadingModal])

  const fetchDashboardMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/dashboard-metrics`)
      if (response.ok) {
        const data = await response.json()
        setDashboardMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts/`)
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
        const printers = await response.json()
        const selectedContractData = contracts.find(c => c.id === contractId)
        if (selectedContractData) {
          const updatedContract = { ...selectedContractData, printers }
          setSelectedContract(updatedContract)
          // Initialize printer readings
          setBulkReading(prev => ({
            ...prev,
            printerReadings: printers.map((printer: Printer) => ({
              printer_id: printer.id,
              counter_bw_current: 0,
              counter_color_current: 0,
              counter_total_current: 0
            }))
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching contract printers:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'periods') {
        const response = await fetch(`${API_BASE}/api/billing/periods`)
        if (response.ok) {
          const data = await response.json()
          setPeriods(data)
        }
      } else if (activeTab === 'readings') {
        const response = await fetch(`${API_BASE}/api/billing/readings`)
        if (response.ok) {
          const data = await response.json()
          setReadings(data)
        }
      } else if (activeTab === 'invoices') {
        const response = await fetch(`${API_BASE}/api/billing/invoices`)
        if (response.ok) {
          const data = await response.json()
          setInvoices(data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/billing/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPeriod)
      })

      if (response.ok) {
        setShowNewPeriodModal(false)
        setNewPeriod({ name: '', start_date: '', end_date: '', cut_off_date: '', description: '' })
        fetchData()
        alert('Período creado exitosamente')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error creating period:', error)
      alert('Error al crear el período')
    }
  }

  const openEditPeriodModal = (period: BillingPeriod) => {
    setEditingPeriod(period)
    setShowEditPeriodModal(true)
  }

  const updatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPeriod) return

    try {
      const response = await fetch(`${API_BASE}/api/billing/periods/${editingPeriod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPeriod.name,
          start_date: editingPeriod.start_date,
          end_date: editingPeriod.end_date,
          cut_off_date: editingPeriod.cut_off_date,
          description: editingPeriod.description
        })
      })

      if (response.ok) {
        setShowEditPeriodModal(false)
        setEditingPeriod(null)
        fetchData()
        alert('Período actualizado exitosamente')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error updating period:', error)
      alert('Error al actualizar el período')
    }
  }

  const createBulkReadings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContract || bulkReading.printerReadings.length === 0) {
      alert('Debe seleccionar un contrato y tener impresoras asociadas')
      return
    }

    try {
      const promises = bulkReading.printerReadings.map(printerReading => 
        fetch(`${API_BASE}/api/billing/readings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer_id: printerReading.printer_id,
            billing_period_id: parseInt(bulkReading.billing_period_id),
            reading_date: bulkReading.reading_date,
            counter_bw_current: printerReading.counter_bw_current,
            counter_color_current: printerReading.counter_color_current,
            counter_total_current: printerReading.counter_total_current,
            reading_method: bulkReading.reading_method,
            notes: bulkReading.notes
          })
        })
      )

      const results = await Promise.all(promises)
      const failedCount = results.filter(r => !r.ok).length
      
      if (failedCount === 0) {
        setShowBulkReadingModal(false)
        resetBulkReading()
        fetchData()
        alert(`${bulkReading.printerReadings.length} lecturas registradas exitosamente`)
      } else {
        alert(`${results.length - failedCount} lecturas exitosas, ${failedCount} fallaron`)
      }
    } catch (error) {
      console.error('Error creating bulk readings:', error)
      alert('Error al registrar las lecturas')
    }
  }

  const resetBulkReading = () => {
    setBulkReading({
      contract_id: '',
      billing_period_id: '',
      reading_date: '',
      reading_method: 'manual',
      notes: '',
      printerReadings: []
    })
    setSelectedContract(null)
  }

  const createReading = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/api/billing/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newReading,
          printer_id: parseInt(newReading.printer_id),
          billing_period_id: parseInt(newReading.billing_period_id)
        })
      })

      if (response.ok) {
        setShowNewReadingModal(false)
        setNewReading({
          printer_id: '',
          billing_period_id: '',
          reading_date: '',
          counter_bw_current: 0,
          counter_color_current: 0,
          counter_total_current: 0,
          reading_method: 'manual',
          notes: ''
        })
        fetchData()
        alert('Lectura registrada exitosamente')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error creating reading:', error)
      alert('Error al registrar la lectura')
    }
  }

  const handleSnmpReadings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSnmpLoading(true)
    
    try {
      const contractId = snmpReading.contract_id
      const periodId = snmpReading.period_id
      
      const response = await fetch(`${API_BASE}/api/billing/snmp-readings/${contractId}?period_id=${periodId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        setShowSnmpBulkModal(false)
        setSnmpReading({ period_id: '', contract_id: '' })
        fetchData()
        
        alert(`Lecturas SNMP completadas:
        - Exitosas: ${result.successful_readings}/${result.total_printers} impresoras
        ${result.errors.length > 0 ? `
        - Errores encontrados:
        ${result.errors.slice(0, 3).join('\n')}
        ${result.errors.length > 3 ? `\n... y ${result.errors.length - 3} errores más` : ''}` : ''}`)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error getting SNMP readings:', error)
      alert('Error al obtener lecturas SNMP')
    } finally {
      setSnmpLoading(false)
    }
  }

  const downloadInvoicePDF = async (invoiceId: number, invoiceNumber: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/invoices/${invoiceId}/pdf`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `factura_${invoiceNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Error al descargar el PDF')
    }
  }

  const downloadPeriodReport = async (periodId: number, periodName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/periods/${periodId}/report-pdf`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_${periodName.replace(/\s+/g, '_')}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error downloading report:', error)
      alert('Error al descargar el reporte')
    }
  }

  // Export functions
  const exportInvoicesToExcel = async (periodId?: number, statusFilter?: string) => {
    try {
      let url = `${API_BASE}/api/billing/export/invoices-excel`
      const params = new URLSearchParams()
      
      if (periodId) params.append('period_id', periodId.toString())
      if (statusFilter) params.append('status_filter', statusFilter)
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url)
      
      if (response.ok) {
        const blob = await response.blob()
        const urlBlob = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = urlBlob
        a.download = response.headers.get('content-disposition')?.split('filename=')[1] || 'facturas.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(urlBlob)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Error al exportar a Excel')
    }
  }

  const exportInvoicesToCSV = async (periodId?: number, statusFilter?: string) => {
    try {
      let url = `${API_BASE}/api/billing/export/invoices-csv`
      const params = new URLSearchParams()
      
      if (periodId) params.append('period_id', periodId.toString())
      if (statusFilter) params.append('status_filter', statusFilter)
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url)
      
      if (response.ok) {
        const blob = await response.blob()
        const urlBlob = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = urlBlob
        a.download = response.headers.get('content-disposition')?.split('filename=')[1] || 'facturas.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(urlBlob)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error exporting to CSV:', error)
      alert('Error al exportar a CSV')
    }
  }

  const exportReadingsToExcel = async (periodId?: number, contractId?: number) => {
    try {
      let url = `${API_BASE}/api/billing/export/readings-excel`
      const params = new URLSearchParams()
      
      if (periodId) params.append('period_id', periodId.toString())
      if (contractId) params.append('contract_id', contractId.toString())
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url)
      
      if (response.ok) {
        const blob = await response.blob()
        const urlBlob = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = urlBlob
        a.download = response.headers.get('content-disposition')?.split('filename=')[1] || 'lecturas.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(urlBlob)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error exporting readings to Excel:', error)
      alert('Error al exportar lecturas a Excel')
    }
  }

  const exportFinancialSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/export/financial-summary`)
      
      if (response.ok) {
        const blob = await response.blob()
        const urlBlob = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = urlBlob
        a.download = response.headers.get('content-disposition')?.split('filename=')[1] || 'resumen_financiero.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(urlBlob)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error exporting financial summary:', error)
      alert('Error al exportar resumen financiero')
    }
  }

  const closePeriod = async (periodId: number) => {
    if (!confirm('¿Está seguro de cerrar este período? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/billing/periods/${periodId}/close`, {
        method: 'PUT'
      })

      if (response.ok) {
        fetchData()
        alert('Período cerrado exitosamente')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error closing period:', error)
      alert('Error al cerrar el período')
    }
  }

  const generateInvoices = async (periodId: number) => {
    if (!confirm('¿Está seguro de generar todas las facturas para este período?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/billing/generate-invoices/${periodId}`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        alert(result.message)
        fetchData()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error generating invoices:', error)
      alert('Error al generar facturas')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-yellow-100 text-yellow-800'
      case 'billed': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      case 'paid': return 'bg-green-100 text-green-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  // Funciones para lecturas SNMP automáticas
  const performSnmpBulkReading = async (periodId: number, contractId?: number) => {
    setSnmpLoading(true)
    setSnmpResults(null)

    try {
      const url = contractId 
        ? `${API_BASE}/api/billing/readings/snmp-bulk/${periodId}?contract_id=${contractId}`
        : `${API_BASE}/api/billing/readings/snmp-bulk/${periodId}`

      const response = await fetch(url, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        setSnmpResults(result)
        
        if (result.results.successful_readings > 0) {
          // Recargar datos si hubo lecturas exitosas
          fetchData()
        }
      } else {
        const errorData = await response.json()
        setSnmpResults({
          message: `Error: ${errorData.detail}`,
          results: { success: [], errors: [{ error: errorData.detail }], total_printers: 0, successful_readings: 0 }
        })
      }
    } catch (error) {
      console.error('Error performing SNMP bulk reading:', error)
      setSnmpResults({
        message: 'Error de conexión',
        results: { success: [], errors: [{ error: 'Error de conexión con el servidor' }], total_printers: 0, successful_readings: 0 }
      })
    } finally {
      setSnmpLoading(false)
    }
  }

  const performSnmpSingleReading = async (printerId: number, periodId: number) => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/billing/readings/snmp-single/${printerId}/${periodId}`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Lectura SNMP exitosa:\nContador B/N: ${result.reading.counter_bw_current}\nContador Color: ${result.reading.counter_color_current}\nEstado: ${result.snmp_data.status}`)
        fetchData()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.detail}`)
      }
    } catch (error) {
      console.error('Error performing SNMP single reading:', error)
      alert('Error al realizar lectura SNMP')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">💰 Módulo de Facturación</h1>
            <p className="text-purple-100 mt-2">Gestión de períodos de corte, lecturas de contadores y facturación por contratos</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Sistema de Facturación</div>
            <div className="text-2xl font-bold">📊</div>
          </div>
        </div>
      </div>

      {/* Wizard Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center">
              🧙‍♂️ Wizard de Facturación
              <span className="ml-2 px-2 py-1 text-xs bg-white bg-opacity-20 rounded-full">NUEVO</span>
            </h2>
            <p className="text-blue-100 mt-1">Proceso guiado paso a paso para generar facturas de manera fácil y rápida</p>
          </div>
          <div>
            <Link 
              href="/billing/wizard"
              className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              <span className="mr-2">🚀</span>
              Iniciar Wizard
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('periods')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'periods'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📅 Períodos de Facturación
            </button>
            <button
              onClick={() => setActiveTab('readings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'readings'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Lecturas de Contadores
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invoices'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🧾 Facturas
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📈 Dashboard
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Períodos de Facturación */}
          {activeTab === 'periods' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Períodos de Facturación</h2>
                <button
                  onClick={() => setShowNewPeriodModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  ➕ Nuevo Período
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Cargando períodos...</div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {periods.map((period) => (
                    <div key={period.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{period.name}</h3>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p><span className="font-medium">Período:</span> {formatDate(period.start_date)} - {formatDate(period.end_date)}</p>
                            <p><span className="font-medium">Fecha de corte:</span> {formatDate(period.cut_off_date)}</p>
                            {period.description && <p><span className="font-medium">Descripción:</span> {period.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(period.status)}`}>
                            {period.status === 'open' ? 'Abierto' : period.status === 'closed' ? 'Cerrado' : 'Facturado'}
                          </span>
                          {period.status === 'open' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => openEditPeriodModal(period)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => closePeriod(period.id)}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                🔒 Cerrar Período
                              </button>
                            </div>
                          )}
                          {period.status === 'closed' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => generateInvoices(period.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                📄 Generar Facturas
                              </button>
                              <button
                                onClick={() => downloadPeriodReport(period.id, period.name)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                📊 Reporte PDF
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lecturas de Contadores */}
          {activeTab === 'readings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Lecturas de Contadores</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportReadingsToExcel()}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    📊 Exportar Excel
                  </button>
                  <button
                    onClick={() => setShowSnmpBulkModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    🔄 Lectura SNMP Automática
                  </button>
                  <button
                    onClick={() => setShowBulkReadingModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    📋 Lectura por Contrato
                  </button>
                  <button
                    onClick={() => setShowNewReadingModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    ➕ Lectura Individual
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Cargando lecturas...</div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impresora</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contadores Actuales</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impresiones del Período</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {readings.map((reading) => (
                        <tr key={reading.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            Impresora #{reading.printer_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(reading.reading_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>B/N: {reading.counter_bw_current.toLocaleString()}</div>
                            <div>Color: {reading.counter_color_current.toLocaleString()}</div>
                            <div>Total: {reading.counter_total_current.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="font-medium">B/N: {reading.prints_bw_period.toLocaleString()}</div>
                            <div className="font-medium">Color: {reading.prints_color_period.toLocaleString()}</div>
                            <div className="font-medium">Total: {reading.prints_total_period.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              reading.reading_method === 'manual' ? 'bg-blue-100 text-blue-800' : 
                              reading.reading_method === 'snmp' ? 'bg-green-100 text-green-800' : 
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {reading.reading_method}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard de Facturación</h2>
                <div className="flex space-x-3">
                  <select
                    title="Seleccionar período para generar reporte"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    onChange={(e) => {
                      if (e.target.value) {
                        const period = periods.find(p => p.id === parseInt(e.target.value))
                        if (period) {
                          downloadPeriodReport(period.id, period.name)
                        }
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">📊 Descargar Reporte...</option>
                    {periods.filter(p => p.status === 'closed').map(period => (
                      <option key={period.id} value={period.id}>
                        {period.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchDashboardMetrics}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    🔄 Actualizar
                  </button>
                  <button
                    onClick={exportFinancialSummary}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    📊 Exportar Resumen
                  </button>
                </div>
              </div>

              {loading || !dashboardMetrics ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Cargando métricas...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Métricas Principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                              <span className="text-white text-sm">💰</span>
                            </div>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                Ingresos Totales
                              </dt>
                              <dd className="text-lg font-medium text-gray-900">
                                {formatCurrency(dashboardMetrics.totalRevenue)}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                              <span className="text-white text-sm">🧾</span>
                            </div>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                Total Facturas
                              </dt>
                              <dd className="text-lg font-medium text-gray-900">
                                {dashboardMetrics.totalInvoices}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                              <span className="text-white text-sm">⏳</span>
                            </div>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                Facturas Pendientes
                              </dt>
                              <dd className="text-lg font-medium text-gray-900">
                                {dashboardMetrics.pendingInvoices}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                              <span className="text-white text-sm">🚨</span>
                            </div>
                          </div>
                          <div className="ml-5 w-0 flex-1">
                            <dl>
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                Facturas Vencidas
                              </dt>
                              <dd className="text-lg font-medium text-gray-900">
                                {dashboardMetrics.overdueInvoices}
                              </dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas Adicionales */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de Actividad</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Períodos Activos:</span>
                          <span className="text-sm font-medium text-gray-900">{dashboardMetrics.periodsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Contratos Activos:</span>
                          <span className="text-sm font-medium text-gray-900">{dashboardMetrics.activeContracts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Lecturas este Mes:</span>
                          <span className="text-sm font-medium text-gray-900">{dashboardMetrics.readingsThisMonth}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg p-6 lg:col-span-2">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Ingresos por Período</h3>
                      <div className="space-y-2">
                        {dashboardMetrics.revenueByPeriod.map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{item.period}</span>
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(item.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="bg-white overflow-hidden shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setActiveTab('periods')}
                        className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <span className="mr-2">📅</span>
                        Crear Período
                      </button>
                      <button
                        onClick={() => setActiveTab('readings')}
                        className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <span className="mr-2">📊</span>
                        Registrar Lecturas
                      </button>
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <span className="mr-2">🧾</span>
                        Ver Facturas
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Facturas */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Facturas</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportInvoicesToExcel()}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    📊 Excel
                  </button>
                  <button
                    onClick={() => exportInvoicesToCSV()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    📄 CSV
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Cargando facturas...</div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrato</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Contrato #{invoice.contract_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.invoice_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.total_amount, invoice.currency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                              {invoice.status === 'draft' ? 'Borrador' : 
                               invoice.status === 'sent' ? 'Enviada' :
                               invoice.status === 'paid' ? 'Pagada' :
                               invoice.status === 'overdue' ? 'Vencida' : invoice.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900 mr-3">
                              👁️ Ver
                            </button>
                            <button 
                              onClick={() => downloadInvoicePDF(invoice.id, invoice.invoice_number)}
                              className="text-green-600 hover:text-green-900"
                            >
                              📄 PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para Nuevo Período */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nuevo Período de Facturación</h3>
              <form onSubmit={createPeriod} className="space-y-4">
                <div>
                  <label htmlFor="period-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    id="period-name"
                    type="text"
                    required
                    value={newPeriod.name}
                    onChange={(e) => setNewPeriod({...newPeriod, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ej: Noviembre 2025"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="period-start" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                    <input
                      id="period-start"
                      type="date"
                      required
                      value={newPeriod.start_date}
                      onChange={(e) => setNewPeriod({...newPeriod, start_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="period-end" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Fin</label>
                    <input
                      id="period-end"
                      type="date"
                      required
                      value={newPeriod.end_date}
                      onChange={(e) => setNewPeriod({...newPeriod, end_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="period-cutoff" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Corte</label>
                    <input
                      id="period-cutoff"
                      type="date"
                      required
                      value={newPeriod.cut_off_date}
                      onChange={(e) => setNewPeriod({...newPeriod, cut_off_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="period-description" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                  <textarea
                    id="period-description"
                    value={newPeriod.description}
                    onChange={(e) => setNewPeriod({...newPeriod, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Descripción del período..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewPeriodModal(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Crear Período
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Editar Período */}
      {showEditPeriodModal && editingPeriod && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Período de Facturación</h3>
              <form onSubmit={updatePeriod} className="space-y-4">
                <div>
                  <label htmlFor="edit-period-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    id="edit-period-name"
                    type="text"
                    required
                    value={editingPeriod.name}
                    onChange={(e) => setEditingPeriod({...editingPeriod, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Noviembre 2025"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="edit-period-start" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                    <input
                      id="edit-period-start"
                      type="date"
                      required
                      value={editingPeriod.start_date}
                      onChange={(e) => setEditingPeriod({...editingPeriod, start_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-period-end" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Fin</label>
                    <input
                      id="edit-period-end"
                      type="date"
                      required
                      value={editingPeriod.end_date}
                      onChange={(e) => setEditingPeriod({...editingPeriod, end_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-period-cutoff" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Corte</label>
                    <input
                      id="edit-period-cutoff"
                      type="date"
                      required
                      value={editingPeriod.cut_off_date}
                      onChange={(e) => setEditingPeriod({...editingPeriod, cut_off_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-period-description" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
                  <textarea
                    id="edit-period-description"
                    value={editingPeriod.description || ''}
                    onChange={(e) => setEditingPeriod({...editingPeriod, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Descripción del período..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPeriodModal(false)
                      setEditingPeriod(null)
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Actualizar Período
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Nueva Lectura */}
      {showNewReadingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nueva Lectura de Contadores</h3>
              <form onSubmit={createReading} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reading-printer" className="block text-sm font-medium text-gray-700 mb-1">Impresora</label>
                    <select
                      id="reading-printer"
                      required
                      value={newReading.printer_id}
                      onChange={(e) => setNewReading({...newReading, printer_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar impresora...</option>
                      {contracts.flatMap(contract => 
                        contract.printers?.map((printer: Printer) => (
                          <option key={printer.id} value={printer.id}>
                            {printer.ip_address} {printer.location ? `- ${printer.location}` : ''} ({contract.contract_number} - {contract.client_name})
                          </option>
                        )) || []
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reading-period" className="block text-sm font-medium text-gray-700 mb-1">Período de Facturación</label>
                    <select
                      id="reading-period"
                      required
                      value={newReading.billing_period_id}
                      onChange={(e) => setNewReading({...newReading, billing_period_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar período...</option>
                      {periods.filter(p => p.status === 'open').map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name} ({formatDate(period.start_date)} - {formatDate(period.end_date)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="reading-date" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Lectura</label>
                  <input
                    id="reading-date"
                    type="date"
                    required
                    value={newReading.reading_date}
                    onChange={(e) => setNewReading({...newReading, reading_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="counter-bw" className="block text-sm font-medium text-gray-700 mb-1">Contador B/N</label>
                    <input
                      id="counter-bw"
                      type="number"
                      required
                      value={newReading.counter_bw_current}
                      onChange={(e) => setNewReading({...newReading, counter_bw_current: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="counter-color" className="block text-sm font-medium text-gray-700 mb-1">Contador Color</label>
                    <input
                      id="counter-color"
                      type="number"
                      required
                      value={newReading.counter_color_current}
                      onChange={(e) => setNewReading({...newReading, counter_color_current: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="counter-total" className="block text-sm font-medium text-gray-700 mb-1">Contador Total</label>
                    <input
                      id="counter-total"
                      type="number"
                      required
                      value={newReading.counter_total_current}
                      onChange={(e) => setNewReading({...newReading, counter_total_current: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reading-method" className="block text-sm font-medium text-gray-700 mb-1">Método de Lectura</label>
                  <select
                    id="reading-method"
                    value={newReading.reading_method}
                    onChange={(e) => setNewReading({...newReading, reading_method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="snmp">SNMP</option>
                    <option value="automatic">Automático</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reading-notes" className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                  <textarea
                    id="reading-notes"
                    value={newReading.notes}
                    onChange={(e) => setNewReading({...newReading, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Observaciones..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewReadingModal(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Registrar Lectura
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Lectura por Contrato */}
      {showBulkReadingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Lectura de Contadores por Contrato</h3>
              <form onSubmit={createBulkReadings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bulk-contract" className="block text-sm font-medium text-gray-700 mb-1">Contrato</label>
                    <select
                      id="bulk-contract"
                      required
                      value={bulkReading.contract_id}
                      onChange={(e) => {
                        const contractId = parseInt(e.target.value)
                        setBulkReading({...bulkReading, contract_id: e.target.value})
                        if (contractId) {
                          fetchContractPrinters(contractId)
                        } else {
                          setSelectedContract(null)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar contrato...</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.contract_number} - {contract.client_name} ({contract.contract_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bulk-period" className="block text-sm font-medium text-gray-700 mb-1">Período de Facturación</label>
                    <select
                      id="bulk-period"
                      required
                      value={bulkReading.billing_period_id}
                      onChange={(e) => setBulkReading({...bulkReading, billing_period_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Seleccionar período...</option>
                      {periods.filter(p => p.status === 'open').map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name} ({formatDate(period.start_date)} - {formatDate(period.end_date)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bulk-date" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Lectura</label>
                    <input
                      id="bulk-date"
                      type="date"
                      required
                      value={bulkReading.reading_date}
                      onChange={(e) => setBulkReading({...bulkReading, reading_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="bulk-method" className="block text-sm font-medium text-gray-700 mb-1">Método de Lectura</label>
                    <select
                      id="bulk-method"
                      value={bulkReading.reading_method}
                      onChange={(e) => setBulkReading({...bulkReading, reading_method: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="manual">Manual</option>
                      <option value="snmp">SNMP</option>
                      <option value="automatic">Automático</option>
                    </select>
                  </div>
                </div>

                {selectedContract?.printers && selectedContract.printers.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">
                      Impresoras del Contrato ({selectedContract.printers?.length ?? 0})
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {selectedContract.printers.map((printer, index) => {
                        const reading = bulkReading.printerReadings.find(r => r.printer_id === printer.id)
                        return (
                          <div key={printer.id} className="bg-white rounded-md p-3 mb-3 border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium text-gray-900">
                                {printer.ip_address} {printer.location ? `- ${printer.location}` : ''}
                              </h5>
                              <span className="text-sm text-gray-500">
                                {printer.brand} {printer.model}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Contador B/N</label>
                                <input
                                  type="number"
                                  value={reading?.counter_bw_current || 0}
                                  onChange={(e) => {
                                    const newReadings = [...bulkReading.printerReadings]
                                    const readingIndex = newReadings.findIndex(r => r.printer_id === printer.id)
                                    if (readingIndex >= 0) {
                                      newReadings[readingIndex].counter_bw_current = parseInt(e.target.value) || 0
                                    } else {
                                      newReadings.push({
                                        printer_id: printer.id,
                                        counter_bw_current: parseInt(e.target.value) || 0,
                                        counter_color_current: 0,
                                        counter_total_current: 0
                                      })
                                    }
                                    setBulkReading({...bulkReading, printerReadings: newReadings})
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Contador Color</label>
                                <input
                                  type="number"
                                  value={reading?.counter_color_current || 0}
                                  onChange={(e) => {
                                    const newReadings = [...bulkReading.printerReadings]
                                    const readingIndex = newReadings.findIndex(r => r.printer_id === printer.id)
                                    if (readingIndex >= 0) {
                                      newReadings[readingIndex].counter_color_current = parseInt(e.target.value) || 0
                                    } else {
                                      newReadings.push({
                                        printer_id: printer.id,
                                        counter_bw_current: 0,
                                        counter_color_current: parseInt(e.target.value) || 0,
                                        counter_total_current: 0
                                      })
                                    }
                                    setBulkReading({...bulkReading, printerReadings: newReadings})
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Contador Total</label>
                                <input
                                  type="number"
                                  value={reading?.counter_total_current || 0}
                                  onChange={(e) => {
                                    const newReadings = [...bulkReading.printerReadings]
                                    const readingIndex = newReadings.findIndex(r => r.printer_id === printer.id)
                                    if (readingIndex >= 0) {
                                      newReadings[readingIndex].counter_total_current = parseInt(e.target.value) || 0
                                    } else {
                                      newReadings.push({
                                        printer_id: printer.id,
                                        counter_bw_current: 0,
                                        counter_color_current: 0,
                                        counter_total_current: parseInt(e.target.value) || 0
                                      })
                                    }
                                    setBulkReading({...bulkReading, printerReadings: newReadings})
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="bulk-notes" className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                  <textarea
                    id="bulk-notes"
                    value={bulkReading.notes}
                    onChange={(e) => setBulkReading({...bulkReading, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Observaciones generales..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkReadingModal(false)
                      resetBulkReading()
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedContract || bulkReading.printerReadings.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Registrar Todas las Lecturas
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Lectura SNMP Automática */}
      {showSnmpBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Lectura SNMP Automática</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Realiza lecturas automáticas de contadores usando SNMP para todas las impresoras activas o las de un contrato específico.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Período de Facturación</label>
                      <select
                        title="Seleccionar período de facturación"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={snmpReading.period_id}
                        onChange={(e) => setSnmpReading({...snmpReading, period_id: e.target.value})}
                      >
                        <option value="">Seleccionar período</option>
                        {periods.filter(p => p.status === 'open').map((period) => (
                          <option key={period.id} value={period.id}>{period.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contrato (Opcional)</label>
                      <select
                        title="Seleccionar contrato específico"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={snmpReading.contract_id}
                        onChange={(e) => setSnmpReading({...snmpReading, contract_id: e.target.value})}
                      >
                        <option value="">Todas las impresoras activas</option>
                        {contracts.map((contract) => (
                          <option key={contract.id} value={contract.id}>
                            {contract.contract_number} - {contract.client_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex space-x-3">
                    <button
                      onClick={() => {
                        if (snmpReading.period_id) {
                          performSnmpBulkReading(
                            parseInt(snmpReading.period_id), 
                            snmpReading.contract_id ? parseInt(snmpReading.contract_id) : undefined
                          )
                        } else {
                          alert('Por favor seleccione un período')
                        }
                      }}
                      disabled={!snmpReading.period_id || snmpLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      {snmpLoading ? '🔄 Procesando...' : '🚀 Iniciar Lectura SNMP'}
                    </button>
                  </div>
                </div>

                {/* Resultados de la lectura SNMP */}
                {snmpResults && (
                  <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-3">Resultados de Lectura SNMP</h4>
                    
                    <div className="mb-3">
                      <p className="text-sm text-gray-700">{snmpResults.message}</p>
                      <p className="text-sm text-gray-600">
                        Lecturas exitosas: {snmpResults.results.successful_readings}/{snmpResults.results.total_printers}
                      </p>
                    </div>

                    {/* Lecturas exitosas */}
                    {snmpResults.results.success.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-green-800 mb-2">✅ Lecturas Exitosas ({snmpResults.results.success.length})</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {snmpResults.results.success.map((result: any, index: number) => (
                            <div key={index} className="text-xs text-green-700 bg-green-50 p-2 rounded mb-1">
                              IP: {result.ip_address} | B/N: {result.counter_bw} | Color: {result.counter_color} | Estado: {result.status}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Errores */}
                    {snmpResults.results.errors.length > 0 && (
                      <div>
                        <h5 className="font-medium text-red-800 mb-2">❌ Errores ({snmpResults.results.errors.length})</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {snmpResults.results.errors.map((error: any, index: number) => (
                            <div key={index} className="text-xs text-red-700 bg-red-50 p-2 rounded mb-1">
                              IP: {error.ip_address || 'N/A'} | Error: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSnmpBulkModal(false)
                    setSnmpResults(null)
                    setSnmpReading({ period_id: '', contract_id: '' })
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}