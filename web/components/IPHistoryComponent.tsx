'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, AlertCircle } from 'lucide-react'

interface IPChangeRecord {
  id: number
  old_ip: string | null
  new_ip: string
  changed_at: string
  changed_by: string
  reason: string
  notes: string | null
}

interface IPHistoryData {
  printer_id: number
  asset_tag: string
  brand: string
  model: string
  current_ip: string
  history: IPChangeRecord[]
}

interface IPHistoryComponentProps {
  printerId: number
  onClose?: () => void
}

export default function IPHistoryComponent({ printerId, onClose }: IPHistoryComponentProps) {
  const [historyData, setHistoryData] = useState<IPHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIPHistory()
  }, [printerId])

  const fetchIPHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`http://localhost:8000/printers/${printerId}/ip-history`)
      
      if (!response.ok) {
        throw new Error('Error al obtener historial de IPs')
      }
      
      const data = await response.json()
      setHistoryData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReasonLabel = (reason: string) => {
    const reasons: { [key: string]: string } = {
      'discovery_auto': 'Detección automática',
      'discovery_auto_mac': 'Detección por MAC',
      'sector_change': 'Cambio de sector',
      'network_reconfiguration': 'Reconfiguración de red',
      'manual_update': 'Actualización manual',
      'polling_discovery': 'Detectado en polling',
      'maintenance': 'Mantenimiento'
    }
    return reasons[reason] || reason
  }

  const getReasonColor = (reason: string) => {
    if (reason.includes('auto')) return 'bg-blue-100 text-blue-800'
    if (reason.includes('manual')) return 'bg-green-100 text-green-800'
    if (reason.includes('sector')) return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando historial...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    )
  }

  if (!historyData) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Historial de Cambios de IP
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {historyData.brand} {historyData.model} - {historyData.asset_tag}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* IP Actual */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-900">IP Actual:</span>
            <span className="ml-2 text-lg font-bold text-blue-600">{historyData.current_ip}</span>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="p-4">
        {historyData.history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay cambios de IP registrados</p>
            <p className="text-sm mt-1">Esta impresora siempre ha tenido la misma IP</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Total de cambios: <span className="font-semibold">{historyData.history.length}</span>
            </p>
            
            {historyData.history.map((record, index) => (
              <div
                key={record.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Cambio de IP */}
                    <div className="flex items-center mb-2">
                      <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {record.old_ip || 'N/A'}
                      </span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {record.new_ip}
                      </span>
                    </div>
                    
                    {/* Razón */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getReasonColor(record.reason)}`}>
                        {getReasonLabel(record.reason)}
                      </span>
                      <span className="text-xs text-gray-500">
                        por {record.changed_by}
                      </span>
                    </div>
                    
                    {/* Notas */}
                    {record.notes && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                        💬 {record.notes}
                      </p>
                    )}
                  </div>
                  
                  {/* Fecha */}
                  <div className="ml-4 text-right">
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(record.changed_at)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      #{historyData.history.length - index}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
