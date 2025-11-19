'use client'

import { useState, useEffect } from 'react'
import { Card, Badge, Button } from '@/components/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

interface Incident {
  id: number
  printer_id: number
  title: string
  description: string | null
  status: string
  priority: string
  created_at: string
  updated_at: string | null
  resolved_at: string | null
  printer?: {
    id: number
    brand: string
    model: string
    location: string | null
  }
  toner_requests?: Array<{
    id: number
    requested_by: string
    justification: string
    status: string
    created_at: string
  }>
}

type ViewType = 'cards' | 'table' | 'kanban'

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [viewType, setViewType] = useState<ViewType>('cards')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchIncidents()
  }, [filter])

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

  const updateIncidentStatus = async (incidentId: number, newStatus: string) => {
    try {
      const response = await fetch(`${API_BASE}/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (response.ok) {
        fetchIncidents()
      } else {
        alert('Failed to update incident')
      }
    } catch (error) {
      console.error('Error updating incident:', error)
      alert('Error updating incident')
    }
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
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'open':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pendiente'
      case 'open':
        return 'Abierto'
      case 'in_progress':
        return 'En Progreso'
      case 'resolved':
        return 'Resuelto'
      default:
        return status
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'Crítica'
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      case 'low':
        return 'Baja'
      default:
        return priority
    }
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{incident.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{incident.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {incident.printer ? `${incident.printer.brand} ${incident.printer.model}` : `ID: ${incident.printer_id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(incident.status)}`}>
                      {getStatusLabel(incident.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(incident.priority)}`}>
                      {getPriorityLabel(incident.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(incident.created_at)}</td>
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
      { key: 'pending', title: 'Pendientes', color: 'bg-gray-50 border-gray-300' },
      { key: 'open', title: 'Abiertos', color: 'bg-red-50 border-red-300' },
      { key: 'in_progress', title: 'En Progreso', color: 'bg-blue-50 border-blue-300' },
      { key: 'resolved', title: 'Resueltos', color: 'bg-green-50 border-green-300' }
    ]

    return (
      <div className="flex space-x-6 overflow-x-auto pb-6">
        {statusColumns.map((column) => {
          const columnIncidents = incidents.filter(incident => incident.status === column.key)
          return (
            <div key={column.key} className={`flex-shrink-0 w-80 ${column.color} rounded-lg border p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">{columnIncidents.length}</span>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {columnIncidents.map((incident) => (
                  <div key={incident.id} className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">Incidente #{incident.id}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(incident.priority)}`}>
                        {getPriorityLabel(incident.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2 line-clamp-2">{incident.title}</p>
                    {incident.printer && (
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Impresora:</span> {incident.printer.brand} {incident.printer.model}
                        {incident.printer.location && ` - ${incident.printer.location}`}
                      </div>
                    )}
                    {incident.toner_requests && incident.toner_requests.length > 0 && (
                      <div className="text-xs text-blue-600 mb-2">
                        <span className="font-medium">Solicitante:</span> {incident.toner_requests[0].requested_by}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">{formatDate(incident.created_at)}</div>
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
    </div>
  )
}
