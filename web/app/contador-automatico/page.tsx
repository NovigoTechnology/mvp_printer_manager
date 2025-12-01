'use client'

import { useState, useEffect } from 'react'
import { API_BASE } from '@/lib/config'

interface CounterSchedule {
  id?: number
  name: string
  schedule_type: 'interval' | 'daily' | 'weekly' | 'monthly'
  interval_minutes?: number
  time_of_day?: string
  day_of_week?: number
  day_of_month?: number
  target_type: 'single' | 'selection' | 'all'
  printer_ids?: number[]
  is_active: boolean
  created_at?: string
  updated_at?: string
  last_run?: string
  next_run?: string
  run_count?: number
  error_count?: number
  last_error?: string
}

interface Printer {
  id: number
  brand: string
  model: string
  ip: string
  hostname?: string
  location?: string
  department?: string
  status: string
}

interface Stats {
  total_schedules: number
  active_schedules: number
  total_executions_today: number
  successful_executions_today: number
  failed_executions_today: number
  success_rate_today: number
  last_execution?: string
  next_execution?: string
}

interface ExecutionHistoryEntry {
  id: number
  execution_time: string
  success: boolean
  error_message?: string
  printers_processed: number
  printers_successful: number
  printers_failed: number
  total_reports_created: number
  execution_duration_seconds?: number
  retry_count: number
  details?: string
}

interface ExecutionHistory {
  schedule_id: number
  schedule_name: string
  total_executions: number
  recent_executions: ExecutionHistoryEntry[]
  success_rate: number
  average_duration?: number
}

export default function ContadorAutomatico() {
  const [schedules, setSchedules] = useState<CounterSchedule[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<CounterSchedule | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [formData, setFormData] = useState<Partial<CounterSchedule>>({
    name: '',
    schedule_type: 'daily',
    time_of_day: '08:00',
    target_type: 'all',
    is_active: true
  })

  const daysOfWeekOptions = [
    { value: 0, label: 'Lunes' },
    { value: 1, label: 'Martes' },
    { value: 2, label: 'Miércoles' },
    { value: 3, label: 'Jueves' },
    { value: 4, label: 'Viernes' },
    { value: 5, label: 'Sábado' },
    { value: 6, label: 'Domingo' }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Load schedules, printers in parallel
      const [schedulesRes, printersRes] = await Promise.all([
        fetch(`${API_BASE}/auto-counters/`),
        fetch(`${API_BASE}/printers/`)
      ])

      const schedulesData = await schedulesRes.json()
      const printersData = await printersRes.json()

      setSchedules(schedulesData)
      setPrinters(printersData)
      
      // Mock stats for now - replace with actual API call when implemented
      setStats({
        total_schedules: schedulesData.length,
        active_schedules: schedulesData.filter((s: CounterSchedule) => s.is_active).length,
        total_executions_today: 15,
        successful_executions_today: 14,
        failed_executions_today: 1,
        success_rate_today: 93.3,
        last_execution: '2025-10-26T10:30:00Z',
        next_execution: '2025-10-26T14:00:00Z'
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExecutionHistory = async (scheduleId: number) => {
    try {
      setLoadingHistory(true)
      const response = await fetch(`${API_BASE}/auto-counters/${scheduleId}/history`)
      
      if (response.ok) {
        const historyData = await response.json()
        setExecutionHistory(historyData)
        setShowHistoryModal(true)
      } else {
        alert('Error al cargar el historial de ejecuciones')
      }
    } catch (error) {
      console.error('Error fetching execution history:', error)
      alert('Error al cargar el historial')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingSchedule 
        ? `${API_BASE}/auto-counters/${editingSchedule.id}`
        : `${API_BASE}/auto-counters/`
      
      const method = editingSchedule ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchData()
        setShowAddForm(false)
        setEditingSchedule(null)
        resetForm()
        alert('Programación guardada exitosamente')
      } else {
        const errorData = await response.json()
        alert(`Error al guardar: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error saving schedule:', error)
      alert('Error al guardar la programación')
    }
  }

  const handleToggleSchedule = async (schedule: CounterSchedule) => {
    try {
      const response = await fetch(`${API_BASE}/auto-counters/${schedule.id}/toggle`, {
        method: 'POST',
      })

      if (response.ok) {
        await fetchData()
        alert(`Programación ${schedule.is_active ? 'desactivada' : 'activada'} exitosamente`)
      } else {
        alert('Error al cambiar el estado de la programación')
      }
    } catch (error) {
      console.error('Error toggling schedule:', error)
      alert('Error al cambiar el estado')
    }
  }

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta programación?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/auto-counters/${scheduleId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchData()
        alert('Programación eliminada exitosamente')
      } else {
        alert('Error al eliminar la programación')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Error al eliminar')
    }
  }

  const handleRunNow = async (scheduleId: number) => {
    try {
      const response = await fetch(`${API_BASE}/auto-counters/${scheduleId}/run`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          alert(`Lectura ejecutada exitosamente: ${result.message}`)
        } else {
          alert(`Ejecución completada con errores: ${result.message}`)
        }
        await fetchData()
      } else {
        const errorData = await response.json()
        alert(`Error en ejecución: ${errorData.detail || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error executing schedule:', error)
      alert('Error al ejecutar programación')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      schedule_type: 'daily',
      time_of_day: '08:00',
      target_type: 'all',
      is_active: true
    })
  }

  const startEdit = (schedule: CounterSchedule) => {
    setEditingSchedule(schedule)
    setFormData({ 
      name: schedule.name,
      schedule_type: schedule.schedule_type,
      interval_minutes: schedule.interval_minutes,
      time_of_day: schedule.time_of_day,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      target_type: schedule.target_type,
      printer_ids: schedule.printer_ids,
      is_active: schedule.is_active
    })
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingSchedule(null)
    resetForm()
  }

  const getScheduleDescription = (schedule: CounterSchedule) => {
    switch (schedule.schedule_type) {
      case 'interval':
        return `Cada ${schedule.interval_minutes} minutos`
      case 'daily':
        return `Diario a las ${schedule.time_of_day}`
      case 'weekly':
        const dayName = daysOfWeekOptions.find(d => d.value === schedule.day_of_week)?.label || 'Desconocido'
        return `Semanal - ${dayName} a las ${schedule.time_of_day}`
      case 'monthly':
        return `Mensual - Día ${schedule.day_of_month} a las ${schedule.time_of_day}`
      default:
        return 'Configuración desconocida'
    }
  }

  const getTargetDescription = (schedule: CounterSchedule) => {
    switch (schedule.target_type) {
      case 'all':
        return 'Todas las impresoras'
      case 'single':
        const printer = printers.find(p => p.id === schedule.printer_ids?.[0])
        return printer ? `${printer.brand} ${printer.model}` : 'Impresora no encontrada'
      case 'selection':
        return `${schedule.printer_ids?.length || 0} impresoras seleccionadas`
      default:
        return 'Sin objetivo'
    }
  }

  const getStatusColor = (enabled: boolean) => {
    return enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Cargando programaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Contadores Automáticos</h1>
          <p className="mt-2 text-gray-600">
            Configuración de toma automática de contadores de impresoras via SNMP
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Programaciones</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.total_schedules}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Activas</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.active_schedules}
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
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Ejecuciones Hoy</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.total_executions_today}
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
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Tasa de Éxito</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.success_rate_today.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nueva Programación
          </button>
        </div>

        {/* Schedules Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Programaciones de Contadores Automáticos
            </h3>
            
            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay programaciones</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza creando una nueva programación de contador automático.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Nueva Programación
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Programación
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Objetivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estadísticas
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{schedule.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getScheduleDescription(schedule)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getTargetDescription(schedule)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.is_active)}`}>
                            {schedule.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div>Ejecuciones: {schedule.run_count || 0}</div>
                            {schedule.error_count ? (
                              <div className="text-red-600">Errores: {schedule.error_count}</div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleRunNow(schedule.id!)}
                              className="p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-all duration-200"
                              title="Ejecutar ahora"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => startEdit(schedule)}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200"
                              title="Editar programación"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleToggleSchedule(schedule)}
                              className={`p-2 rounded-lg transition-all duration-200 ${
                                schedule.is_active 
                                  ? 'text-red-600 hover:text-red-900 hover:bg-red-50' 
                                  : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                              }`}
                              title={schedule.is_active ? 'Desactivar' : 'Activar'}
                            >
                              {schedule.is_active ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5-7h2m-1 0V5a2 2 0 012-2h0a2 2 0 012 2v1" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => fetchExecutionHistory(schedule.id!)}
                              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-200"
                              title="Ver historial de ejecuciones"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id!)}
                              className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-200"
                              title="Eliminar programación"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Schedule Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {editingSchedule ? 'Editar Programación' : 'Nueva Programación de Contador Automático'}
                  </h3>
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSaveSchedule} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nombre */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de la Programación *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Contadores diarios oficina"
                        required
                      />
                    </div>

                    {/* Tipo de programación */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Programación
                      </label>
                      <select
                        value={formData.schedule_type || 'daily'}
                        onChange={(e) => setFormData({...formData, schedule_type: e.target.value as any})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="interval">Por Intervalos</option>
                        <option value="daily">Diario</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensual</option>
                      </select>
                    </div>

                    {/* Configuración específica según tipo */}
                    {formData.schedule_type === 'interval' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Intervalo (minutos)
                        </label>
                        <input
                          type="number"
                          min="5"
                          value={formData.interval_minutes || 60}
                          onChange={(e) => setFormData({...formData, interval_minutes: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="60"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Mínimo: 5 minutos. Para ejecutar cada hora use 60 minutos.
                        </p>
                      </div>
                    )}

                    {formData.schedule_type !== 'interval' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hora de Ejecución
                        </label>
                        <input
                          type="time"
                          value={formData.time_of_day || '08:00'}
                          onChange={(e) => setFormData({...formData, time_of_day: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {formData.schedule_type === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Día de la Semana
                        </label>
                        <select
                          value={formData.day_of_week || 0}
                          onChange={(e) => setFormData({...formData, day_of_week: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {daysOfWeekOptions.map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.schedule_type === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Día del Mes
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.day_of_month || 1}
                          onChange={(e) => setFormData({...formData, day_of_month: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="1"
                        />
                      </div>
                    )}

                    {/* Tipo de objetivo */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Objetivo
                      </label>
                      <select
                        value={formData.target_type || 'all'}
                        onChange={(e) => setFormData({...formData, target_type: e.target.value as any})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">Todas las impresoras</option>
                        <option value="single">Una impresora específica</option>
                        <option value="selection">Selección múltiple</option>
                      </select>
                    </div>

                    {/* Selección de impresoras */}
                    {(formData.target_type === 'single' || formData.target_type === 'selection') && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Seleccionar Impresoras
                        </label>
                        <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                          {printers.map((printer) => (
                            <label key={printer.id} className="flex items-center space-x-2 py-1">
                              <input
                                type={formData.target_type === 'single' ? 'radio' : 'checkbox'}
                                name="printers"
                                value={printer.id}
                                checked={formData.printer_ids?.includes(printer.id) || false}
                                onChange={(e) => {
                                  if (formData.target_type === 'single') {
                                    setFormData({...formData, printer_ids: [printer.id]})
                                  } else {
                                    const currentIds = formData.printer_ids || []
                                    if (e.target.checked) {
                                      setFormData({...formData, printer_ids: [...currentIds, printer.id]})
                                    } else {
                                      setFormData({...formData, printer_ids: currentIds.filter(id => id !== printer.id)})
                                    }
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">
                                {printer.brand} {printer.model} ({printer.ip})
                                {printer.location && ` - ${printer.location}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estado */}
                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_active || false}
                          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Activar programación inmediatamente</span>
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {editingSchedule ? 'Actualizar' : 'Crear'} Programación
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && executionHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Historial de Ejecuciones</h2>
                    <p className="text-sm text-gray-600 mt-1">{executionHistory.schedule_name}</p>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Statistics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-800">Total de Ejecuciones</h3>
                    <p className="text-2xl font-bold text-blue-900">{executionHistory.total_executions}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-800">Tasa de Éxito</h3>
                    <p className="text-2xl font-bold text-green-900">{executionHistory.success_rate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-purple-800">Duración Promedio</h3>
                    <p className="text-2xl font-bold text-purple-900">
                      {executionHistory.average_duration ? `${executionHistory.average_duration.toFixed(1)}s` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-800">Ejecuciones Recientes</h3>
                    <p className="text-2xl font-bold text-yellow-900">{executionHistory.recent_executions.length}</p>
                  </div>
                </div>

                {/* Execution History Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha y Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Impresoras
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duración
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reportes
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {executionHistory.recent_executions.map((execution) => (
                        <tr key={execution.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(execution.execution_time).toLocaleString('es-ES', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              execution.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {execution.success ? 'Exitoso' : 'Error'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="text-green-600">{execution.printers_successful}</span>
                            {execution.printers_failed > 0 && (
                              <span className="text-red-600"> / {execution.printers_failed} errores</span>
                            )}
                            <span className="text-gray-500"> de {execution.printers_processed}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {execution.execution_duration_seconds ? `${execution.execution_duration_seconds.toFixed(1)}s` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {execution.total_reports_created}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {execution.error_message || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {executionHistory.recent_executions.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Sin historial de ejecuciones</h3>
                    <p className="mt-1 text-sm text-gray-500">Esta programación aún no se ha ejecutado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}