'use client'

import { useState, useEffect } from 'react'
import { Card, Badge, Button } from '@/components/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Printer {
  id: number
  brand: string
  model: string
  location: string | null
  serial_number?: string
}

interface Technician {
  id: number
  name: string
  email: string | null
  specialty: string | null
  active: boolean
}

interface SystemUser {
  id: number
  name: string
  email: string | null
  department: string | null
  active: boolean
}

interface Incident {
  id: number
  printer_id: number
  title: string
  description: string | null
  status: string
  priority: string
  incident_type: string
  notes: string | null
  assigned_to: string | null
  assigned_to_id: number | null
  assigned_to_name: string | null
  reported_by: string | null
  reported_by_id: number | null
  reported_by_name: string | null
  created_at: string
  updated_at: string | null
  resolved_at: string | null
  printer?: Printer
  toner_requests?: Array<{
    id: number
    requested_by: string
    justification: string
    status: string
    created_at: string
  }>
}

type ViewType = 'cards' | 'table' | 'kanban'

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [viewType, setViewType] = useState<ViewType>('table')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)

  useEffect(() => {
    fetchIncidents()
    fetchTechnicians()
    fetchSystemUsers()
  }, [filter])

  const fetchTechnicians = async () => {
    try {
      const response = await fetch(`${API_BASE}/technicians/`)
      const data = await response.json()
      setTechnicians(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching technicians:', error)
      setTechnicians([])
    }
  }

  const fetchSystemUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users/`)
      const data = await response.json()
      setSystemUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching system users:', error)
      setSystemUsers([])
    }
  }

  const fetchIncidents = async () => {
    try {
      let url = `${API_BASE}/incidents/`
      if (filter !== 'all') {
        url += `?status=${filter}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      setIncidents(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching incidents:', error)
      setLoading(false)
    }
  }

  const openEditModal = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowEditModal(true)
  }

  const openResolveModal = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowResolveModal(true)
  }

  const openStatusModal = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowStatusModal(true)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-300 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      open: 'Abierto',
      in_progress: 'En Progreso',
      resolved: 'Resuelto',
      cancelled: 'Cancelado'
    }
    return labels[status.toLowerCase()] || status
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      critical: 'Crítica',
      high: 'Alta',
      medium: 'Media',
      low: 'Baja'
    }
    return labels[priority] || priority
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function renderTableView() {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impresora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generado por</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignado a</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{incident.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs">
                      <div className="font-medium">{incident.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {incident.printer ? `${incident.printer.brand} ${incident.printer.model}` : `ID: ${incident.printer_id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openStatusModal(incident)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(incident.status)} hover:opacity-80 transition-opacity`}
                    >
                      {getStatusLabel(incident.status)}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(incident.priority)}`}>
                      {getPriorityLabel(incident.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {incident.reported_by_name || <span className="text-gray-400">No asignado</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {incident.assigned_to_name || <span className="text-gray-400">No asignado</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(incident.created_at)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(incident)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {incident.status !== 'resolved' && (
                        <button
                          onClick={() => openResolveModal(incident)}
                          className="text-green-600 hover:text-green-900"
                          title="Resolver"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderKanbanView() {
    const statusColumns = [
      { key: 'open', title: 'Abiertos', color: 'bg-red-50' },
      { key: 'in_progress', title: 'En Progreso', color: 'bg-blue-50' },
      { key: 'resolved', title: 'Resueltos', color: 'bg-green-50' }
    ]

    return (
      <div className="flex space-x-6 overflow-x-auto pb-6">
        {statusColumns.map((column) => {
          const columnIncidents = incidents.filter(incident => incident.status === column.key)
          return (
            <div key={column.key} className={`flex-shrink-0 w-96 ${column.color} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">{columnIncidents.length}</span>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {columnIncidents.map((incident) => (
                  <div key={incident.id} className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">#{incident.id}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(incident.priority)}`}>
                        {getPriorityLabel(incident.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2 font-medium">{incident.title}</p>
                    {incident.printer && (
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Impresora:</span> {incident.printer.brand} {incident.printer.model}
                      </div>
                    )}
                    {incident.assigned_to_name && (
                      <div className="text-xs text-blue-600 mb-2">
                        <span className="font-medium">Asignado:</span> {incident.assigned_to_name}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mb-3">{formatDate(incident.created_at)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(incident)}
                        className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Editar
                      </button>
                      {incident.status !== 'resolved' && (
                        <button
                          onClick={() => openResolveModal(incident)}
                          className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Resolver
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {columnIncidents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Sin incidentes</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Cargando incidentes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Incidentes</h1>
          <p className="mt-2 text-sm text-gray-600">Seguimiento y resolución de incidentes de impresoras</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">{incidents.length} Total</Badge>
          <Button
            variant="primary"
            onClick={() => window.location.href = '/supply-requests'}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Crear Incidente
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewType('cards')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'cards' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tarjetas
            </button>
            <button
              onClick={() => setViewType('table')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewType('kanban')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewType === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Kanban
            </button>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              showFilters ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Filtrar por estado"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="open">Abiertos</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="resolved">Resueltos</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        {incidents.length > 0 ? (
          <div>
            {viewType === 'table' && renderTableView()}
            {viewType === 'kanban' && renderKanbanView()}
            {viewType === 'cards' && (
              <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Incidente #{incident.id}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(incident.priority)}`}>
                          {getPriorityLabel(incident.priority)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-700">{incident.title}</p>
                    </div>

                    <div className="px-6 py-4">
                      <div className="mb-4">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Impresora:</span>
                          {incident.printer ? (
                            <span className="ml-1">
                              {incident.printer.brand} {incident.printer.model}
                              {incident.printer.location && <span className="text-gray-500"> - {incident.printer.location}</span>}
                            </span>
                          ) : (
                            <span className="ml-1">ID: {incident.printer_id}</span>
                          )}
                        </div>
                      </div>

                      {incident.description && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 border-l-4 border-blue-400">
                            {incident.description}
                          </p>
                        </div>
                      )}

                      {incident.toner_requests && incident.toner_requests.length > 0 && (
                        <div className="mb-4">
                          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-md">
                            <div className="text-sm font-medium text-yellow-800">Solicitud Asociada</div>
                            <p className="text-sm text-yellow-700 mt-1">
                              <span className="font-medium">Solicitante:</span> {incident.toner_requests[0].requested_by}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(incident.status)}`}>
                          {getStatusLabel(incident.status)}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(incident.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-300 text-6xl flex items-center justify-center">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Sin incidentes</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' 
                ? 'No hay incidentes registrados en el sistema' 
                : `No hay incidentes con estado "${getStatusLabel(filter)}"`
              }
            </p>
          </div>
        )}
      </Card>

      {/* Modals */}
      {showEditModal && selectedIncident && (
        <EditModal
          incident={selectedIncident}
          technicians={technicians}
          systemUsers={systemUsers}
          onClose={() => {
            setShowEditModal(false)
            setSelectedIncident(null)
          }}
          onSuccess={() => {
            fetchIncidents()
            setShowEditModal(false)
            setSelectedIncident(null)
          }}
        />
      )}

      {showResolveModal && selectedIncident && (
        <ResolveModal
          incident={selectedIncident}
          technicians={technicians}
          onClose={() => {
            setShowResolveModal(false)
            setSelectedIncident(null)
          }}
          onSuccess={() => {
            fetchIncidents()
            setShowResolveModal(false)
            setSelectedIncident(null)
          }}
        />
      )}

      {showStatusModal && selectedIncident && (
        <StatusModal
          incident={selectedIncident}
          technicians={technicians}
          onClose={() => {
            setShowStatusModal(false)
            setSelectedIncident(null)
          }}
          onSuccess={() => {
            fetchIncidents()
            setShowStatusModal(false)
            setSelectedIncident(null)
          }}
        />
      )}
    </div>
  )
}

// Edit Modal Component
function EditModal({ incident, technicians, systemUsers, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    title: incident.title,
    description: incident.description || '',
    priority: incident.priority,
    assigned_to_id: incident.assigned_to_id || '',
    reported_by_id: incident.reported_by_id || ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/incidents/${incident.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assigned_to_id: formData.assigned_to_id ? parseInt(formData.assigned_to_id) : null,
          reported_by_id: formData.reported_by_id ? parseInt(formData.reported_by_id) : null
        })
      })

      if (response.ok) {
        onSuccess()
      } else {
        alert('Error al actualizar el incidente')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el incidente')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Editar Incidente #{incident.id}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                title="Título del incidente"
                placeholder="Título del incidente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Descripción del incidente"
                placeholder="Descripción detallada del incidente"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad *</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  title="Prioridad del incidente"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
                <select
                  value={formData.assigned_to_id}
                  onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sin asignar</option>
                  {Array.isArray(technicians) && technicians.map((tech: any) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} {tech.specialty ? `(${tech.specialty})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reportado por</label>
              <select
                value={formData.reported_by_id}
                onChange={(e) => setFormData({ ...formData, reported_by_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Anónimo</option>
                {Array.isArray(systemUsers) && systemUsers.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.department ? `- ${user.department}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Resolve Modal Component
function ResolveModal({ incident, technicians, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    resolution: '',
    resolved_by_id: '',
    resolution_notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/incidents/${incident.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          resolved_by_id: parseInt(formData.resolved_by_id)
        })
      })

      if (response.ok) {
        onSuccess()
      } else {
        alert('Error al resolver el incidente')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al resolver el incidente')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Resolver Incidente #{incident.id}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <p className="text-sm text-blue-700">
              <strong>Incidente:</strong> {incident.title}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolución *</label>
              <textarea
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe cómo se resolvió el incidente..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resuelto por *</label>
              <select
                value={formData.resolved_by_id}
                onChange={(e) => setFormData({ ...formData, resolved_by_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                title="Técnico que resolvió el incidente"
              >
                <option value="">Seleccionar técnico...</option>
                {Array.isArray(technicians) && technicians.map((tech: any) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} {tech.specialty ? `(${tech.specialty})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <textarea
                value={formData.resolution_notes}
                onChange={(e) => setFormData({ ...formData, resolution_notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observaciones, piezas reemplazadas, etc..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Resolviendo...' : 'Marcar como Resuelto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Status Modal Component
function StatusModal({ incident, technicians, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    status: incident.status,
    notes: '',
    assigned_to_id: incident.assigned_to_id || ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/incidents/${incident.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assigned_to_id: formData.assigned_to_id ? parseInt(formData.assigned_to_id) : null
        })
      })

      if (response.ok) {
        onSuccess()
      } else {
        alert('Error al cambiar el estado')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al cambiar el estado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Cambiar Estado</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Estado *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                title="Estado del incidente"
              >
                <option value="open">Abierto</option>
                <option value="in_progress">En Progreso</option>
                <option value="resolved">Resuelto</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
              <select
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Asignar técnico"
              >
                <option value="">Sin asignar</option>
                {Array.isArray(technicians) && technicians.map((tech: any) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} {tech.specialty ? `(${tech.specialty})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas del cambio</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Razón del cambio de estado..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Actualizando...' : 'Cambiar Estado'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
