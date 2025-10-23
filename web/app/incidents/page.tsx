'use client'

import { useState, useEffect } from 'react'

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
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchIncidents()
  }, [filter])

  const fetchIncidents = async () => {
    try {
      let url = `${API_BASE}/incidents`
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
        fetchIncidents() // Refresh the list
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
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading incidents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incidents</h1>
            <p className="mt-2 text-gray-600">Track and manage printer incidents</p>
          </div>
          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
            Report Incident
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex space-x-2">
          {['all', 'open', 'in_progress', 'resolved'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {/* Incidents List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-medium text-gray-900 truncate">
                          {incident.title}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(incident.priority)}`}>
                            {incident.priority}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
                            {incident.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {incident.printer ? (
                              <span>
                                {incident.printer.brand} {incident.printer.model}
                                {incident.printer.location && ` - ${incident.printer.location}`}
                              </span>
                            ) : (
                              <span>Printer ID: {incident.printer_id}</span>
                            )}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>
                            Created: {new Date(incident.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {incident.description && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">{incident.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  {incident.status !== 'resolved' && (
                    <div className="mt-4 flex space-x-2">
                      {incident.status === 'open' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'in_progress')}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Start Progress
                        </button>
                      )}
                      <button
                        onClick={() => updateIncidentStatus(incident.id, 'resolved')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {incidents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No incidents found</div>
            <p className="text-gray-500 mt-2">
              {filter === 'all' ? 'No incidents reported yet' : `No ${filter.replace('_', ' ')} incidents`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}