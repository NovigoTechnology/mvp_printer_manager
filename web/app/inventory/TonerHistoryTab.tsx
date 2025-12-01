'use client'

import { useState, useEffect } from 'react'

import API_BASE from '@/app/main'

interface TonerRequest {
  id: number
  printer_id: number
  request_date: string
  status: string
  priority: string
  toner_black_requested: boolean
  toner_black_quantity: number
  toner_black_code?: string
  toner_cyan_requested: boolean
  toner_cyan_quantity: number
  toner_cyan_code?: string
  toner_magenta_requested: boolean
  toner_magenta_quantity: number
  toner_magenta_code?: string
  toner_yellow_requested: boolean
  toner_yellow_quantity: number
  toner_yellow_code?: string
  other_supplies_requested?: string
  justification?: string
  requested_by: string
  approved_by?: string
  approved_date?: string
  ordered_date?: string
  delivered_date?: string
  cancelled_date?: string
  rejection_reason?: string
  notes?: string
}

export const TonerHistoryTab = ({ printerId }: { printerId: number }) => {
  const [tonerHistory, setTonerHistory] = useState<TonerRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTonerHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/printers/${printerId}/toner-history`)
        if (response.ok) {
          const history = await response.json()
          setTonerHistory(history)
        }
      } catch (error) {
        console.error('Error fetching toner history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTonerHistory()
  }, [printerId])

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'ordered': 'bg-blue-100 text-blue-800',
      'delivered': 'bg-purple-100 text-purple-800',
      'cancelled': 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      'low': 'bg-green-100 text-green-800',
      'normal': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    }
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatTonerRequested = (request: TonerRequest) => {
    const toners: string[] = []
    if (request.toner_black_requested) {
      const qty = request.toner_black_quantity || 1
      toners.push(`Negro x${qty} (${request.toner_black_code || 'N/A'})`)
    }
    if (request.toner_cyan_requested) {
      const qty = request.toner_cyan_quantity || 1
      toners.push(`Cian x${qty} (${request.toner_cyan_code || 'N/A'})`)
    }
    if (request.toner_magenta_requested) {
      const qty = request.toner_magenta_quantity || 1
      toners.push(`Magenta x${qty} (${request.toner_magenta_code || 'N/A'})`)
    }
    if (request.toner_yellow_requested) {
      const qty = request.toner_yellow_quantity || 1
      toners.push(`Amarillo x${qty} (${request.toner_yellow_code || 'N/A'})`)
    }
    
    return toners.length > 0 ? toners.join(', ') : 'Ninguno'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-500">Cargando historial de solicitudes...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-semibold text-gray-900">Historial de Solicitudes de Servicio/Insumos</h4>
        <a
          href="/supply-requests"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          Nuevo Pedido de Servicio/Insumos
        </a>
      </div>

      {tonerHistory.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">Sin solicitudes registradas</div>
          <p className="text-gray-500">No hay solicitudes registradas para este equipo</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {tonerHistory.map((request) => (
            <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 mb-1">
                    Solicitud #{request.id} - {new Date(request.request_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Solicitado por:</strong> {request.requested_by}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <strong>Tóners solicitados:</strong> {formatTonerRequested(request)}
                </div>

                {request.other_supplies_requested && (
                  <div>
                    <strong>Otros insumos:</strong> {request.other_supplies_requested}
                  </div>
                )}

                {request.justification && (
                  <div>
                    <strong>Justificación:</strong> {request.justification}
                  </div>
                )}

                {request.notes && (
                  <div>
                    <strong>Notas:</strong> {request.notes}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  {request.approved_date && (
                    <div><strong>Aprobado:</strong> {new Date(request.approved_date).toLocaleString()}</div>
                  )}
                  {request.ordered_date && (
                    <div><strong>Ordenado:</strong> {new Date(request.ordered_date).toLocaleString()}</div>
                  )}
                  {request.delivered_date && (
                    <div><strong>Entregado:</strong> {new Date(request.delivered_date).toLocaleString()}</div>
                  )}
                  {request.cancelled_date && (
                    <div><strong>Cancelado:</strong> {new Date(request.cancelled_date).toLocaleString()}</div>
                  )}
                </div>

                {request.approved_by && (
                  <div className="text-xs text-gray-500">
                    <strong>Aprobado por:</strong> {request.approved_by}
                  </div>
                )}

                {request.rejection_reason && (
                  <div className="text-xs text-red-600">
                    <strong>Razón de rechazo:</strong> {request.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
