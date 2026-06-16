'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Breadcrumbs from './Breadcrumbs'
import { useAuth } from './AuthProvider'

import { API_BASE } from '@/lib/config'

interface AlertSummary {
  id: number
  printer_id: number
  printer_brand?: string
  printer_model?: string
  printer_ip?: string
  status: string
  total_errors: number
  first_seen_at: string
  last_seen_at: string
  last_error_message?: string
  last_task_name?: string
}

interface AlertEvent {
  id: number
  occurred_at: string
  task_name: string
  error_message: string
  run_context?: string
}

interface AlertStats {
  open_alerts: number
  total_errors_open_alerts: number
}

interface AutoRuntimeJob {
  schedule_id: number
  schedule_name?: string
  started_at: string
  printers_total: number
  printers_processed: number
  printers_successful: number
  printers_failed: number
  current_printer?: string | null
}

interface AutoRuntimeStatus {
  is_busy: boolean
  running_jobs: AutoRuntimeJob[]
  recent_jobs: AutoRuntimeJob[]
}

interface HeaderProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function Header({ isCollapsed, onToggleCollapse }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [alertSummaries, setAlertSummaries] = useState<AlertSummary[]>([])
  const [alertEvents, setAlertEvents] = useState<Record<number, AlertEvent[]>>({})
  const [resolveNotes, setResolveNotes] = useState<Record<number, string>>({})
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null)
  const [alertStats, setAlertStats] = useState<AlertStats>({ open_alerts: 0, total_errors_open_alerts: 0 })
  const [autoRuntimeStatus, setAutoRuntimeStatus] = useState<AutoRuntimeStatus>({
    is_busy: false,
    running_jobs: [],
    recent_jobs: []
  })
  const [loadingAlerts, setLoadingAlerts] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { user, logout } = useAuth()

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    if (showUserMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu, showNotifications])

  useEffect(() => {
    fetchAlertStats()
    fetchAutoRuntimeStatus()
    const interval = setInterval(fetchAlertStats, 60000)
    const runtimeInterval = setInterval(fetchAutoRuntimeStatus, 10000)
    return () => {
      clearInterval(interval)
      clearInterval(runtimeInterval)
    }
  }, [])

  useEffect(() => {
    if (showNotifications) {
      fetchAlertSummaries()
    }
  }, [showNotifications])

  const fetchAlertStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/alerts/medical-counter-errors/stats`)
      if (!response.ok) return
      const data = await response.json()
      setAlertStats(data)
    } catch (error) {
      console.error('Error fetching alert stats:', error)
    }
  }

  const fetchAutoRuntimeStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/auto-counters/runtime-status`)
      if (!response.ok) return
      const data = await response.json()
      setAutoRuntimeStatus(data)
    } catch (error) {
      console.error('Error fetching auto runtime status:', error)
    }
  }

  const fetchAlertSummaries = async () => {
    try {
      setLoadingAlerts(true)
      const response = await fetch(`${API_BASE}/alerts/medical-counter-errors?status=open&limit=20`)
      if (!response.ok) return
      const data = await response.json()
      setAlertSummaries(data)
      await Promise.all([fetchAlertStats(), fetchAutoRuntimeStatus()])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoadingAlerts(false)
    }
  }

  const fetchAlertEvents = async (alertId: number) => {
    if (alertEvents[alertId]) {
      setSelectedAlertId(selectedAlertId === alertId ? null : alertId)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/alerts/medical-counter-errors/${alertId}/events?limit=20`)
      if (!response.ok) return
      const data = await response.json()
      setAlertEvents(prev => ({ ...prev, [alertId]: data }))
      setSelectedAlertId(selectedAlertId === alertId ? null : alertId)
    } catch (error) {
      console.error('Error fetching alert events:', error)
    }
  }

  const resolveAlert = async (alertId: number) => {
    try {
      const resolvedNote = (resolveNotes[alertId] || '').trim()
      const response = await fetch(`${API_BASE}/alerts/medical-counter-errors/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolved_by: user?.username || 'ui-user',
          resolved_notes: resolvedNote || null
        })
      })

      if (!response.ok) return

      setAlertSummaries(prev => prev.filter(alert => alert.id !== alertId))
      setSelectedAlertId(null)
      setResolveNotes(prev => {
        const updated = { ...prev }
        delete updated[alertId]
        return updated
      })
      await fetchAlertStats()
    } catch (error) {
      console.error('Error resolving alert:', error)
    }
  }

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleLogout = () => {
    logout()
  }

  const getUserInitials = () => {
    if (!user) return 'AD'
    if (user.full_name) {
      const names = user.full_name.split(' ')
      return names.map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    }
    return user.username?.substring(0, 2).toUpperCase() || 'AD'
  }

  return (
    <header 
      className="fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 transition-all duration-300"
      style={{ left: isCollapsed ? '80px' : '256px' }}
    >
      {/* Toggle Button + Breadcrumbs */}
      <div className="flex flex-1 items-center gap-4">
        <button
          onClick={onToggleCollapse}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          title={isCollapsed ? 'Expandir' : 'Contraer'}
        >
          <svg
            className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <Breadcrumbs />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-gray-400 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {alertStats.open_alerts > 0 && (
              <>
                <span className="absolute right-1 top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <span className="absolute -right-2 -top-1 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold text-white">
                  {alertStats.open_alerts > 99 ? '99+' : alertStats.open_alerts}
                </span>
              </>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-[26rem] rounded-xl border border-gray-200 bg-white shadow-lg z-50">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Alertas de contadores médicos</h3>
                  <button
                    onClick={fetchAlertSummaries}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Actualizar
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {alertStats.open_alerts} impresoras con alertas abiertas, {alertStats.total_errors_open_alerts} errores acumulados.
                </p>
              </div>

              <div className="max-h-[28rem] overflow-y-auto">
                <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 ${autoRuntimeStatus.is_busy ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <p className={`text-xs font-semibold ${autoRuntimeStatus.is_busy ? 'text-amber-900' : 'text-emerald-900'}`}>
                    {autoRuntimeStatus.is_busy ? 'Toma automatica en ejecucion' : 'Sin tareas automaticas activas'}
                  </p>
                  <p className={`mt-1 text-[11px] ${autoRuntimeStatus.is_busy ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {autoRuntimeStatus.is_busy
                      ? `${autoRuntimeStatus.running_jobs.length} job(s) activos`
                      : 'El sistema de toma automatica esta estable'}
                  </p>
                  {autoRuntimeStatus.is_busy && (
                    <div className="mt-2 space-y-1">
                      {autoRuntimeStatus.running_jobs.slice(0, 2).map(job => (
                        <div key={`${job.schedule_id}-${job.started_at}`} className="text-[11px] text-amber-800">
                          {(job.schedule_name || `Schedule ${job.schedule_id}`)}: {job.printers_processed}/{job.printers_total}
                          {job.current_printer ? ` - ${job.current_printer}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {loadingAlerts ? (
                  <div className="p-4 text-sm text-gray-500">Cargando alertas...</div>
                ) : alertSummaries.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No hay alertas abiertas.</div>
                ) : (
                  alertSummaries.map(alert => (
                    <div key={alert.id} className="border-b border-gray-100 px-4 py-3">
                      <button
                        onClick={() => fetchAlertEvents(alert.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {alert.printer_brand || 'Impresora'} {alert.printer_model || ''}
                            </p>
                            <p className="text-xs text-gray-500">{alert.printer_ip || 'Sin IP'}</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            {alert.total_errors} errores
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">{alert.last_error_message || 'Sin detalle'}</p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          Último: {formatDateTime(alert.last_seen_at)} · Tarea: {alert.last_task_name || 'N/A'}
                        </p>
                      </button>

                      {selectedAlertId === alert.id && (
                        <div className="mt-2 rounded-lg bg-gray-50 p-2">
                          <div className="mb-2">
                            <label className="mb-1 block text-[11px] font-medium text-gray-600">
                              Comentario técnico de resolución
                            </label>
                            <textarea
                              value={resolveNotes[alert.id] || ''}
                              onChange={(e) => setResolveNotes(prev => ({ ...prev, [alert.id]: e.target.value }))}
                              rows={2}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Ej: reinicio de servicio, credenciales corregidas, conectividad restablecida"
                            />
                          </div>
                          <div className="mb-2 flex justify-end">
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              Marcar resuelta
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {(alertEvents[alert.id] || []).map(event => (
                              <div key={event.id} className="rounded border border-gray-200 bg-white p-2">
                                <p className="text-[11px] text-gray-400">{formatDateTime(event.occurred_at)} · {event.task_name}</p>
                                <p className="text-xs text-gray-700">{event.error_message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="rounded-lg p-2 text-gray-400 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Language/Flag */}
        <button className="rounded-lg p-2 text-gray-400 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
          <span className="text-xl">🇦🇷</span>
        </button>

        {/* User Avatar & Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {getUserInitials()}
              </div>
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              {/* User Info Header */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white">
                      {getUserInitials()}
                    </div>
                    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user?.full_name || user?.username || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.role === 'admin' ? 'Administrador' : 
                       user?.role === 'manager' ? 'Gerente' :
                       user?.role === 'technician' ? 'Técnico' : 'Visor'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <button 
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/settings')
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Perfil</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configuración de perfil</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/incidents')
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Mensajes</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tus incidentes y tareas</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowUserMenu(false)
                    router.push('/settings')
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Configuración</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ajustes de la aplicación</p>
                  </div>
                </button>
              </div>

              {/* Logout Button */}
              <div className="border-t border-gray-200 dark:border-gray-600 p-2">
                <button 
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
