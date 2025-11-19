'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge } from '@/components/ui'

const API_BASE = 'http://localhost:8000'

interface AppSettings {
  // General
  company_name: string
  timezone: string
  date_format: string
  
  // SNMP
  snmp_timeout: number
  snmp_retries: number
  default_snmp_community: string
  
  // Exchange Rates
  auto_update_exchange_rates: boolean
  exchange_rate_update_frequency: number // hours
  default_currency: string
  
  // Counters
  counter_collection_enabled: boolean
  counter_collection_schedule: string
  
  // Notifications
  email_notifications_enabled: boolean
  notification_email: string
  low_toner_threshold: number
  
  // System
  max_concurrent_snmp_requests: number
  log_level: string
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    company_name: 'Printer Fleet Manager',
    timezone: 'America/Argentina/Buenos_Aires',
    date_format: 'DD/MM/YYYY',
    snmp_timeout: 5,
    snmp_retries: 2,
    default_snmp_community: 'public',
    auto_update_exchange_rates: true,
    exchange_rate_update_frequency: 24,
    default_currency: 'ARS',
    counter_collection_enabled: true,
    counter_collection_schedule: '0 0 * * *',
    email_notifications_enabled: false,
    notification_email: '',
    low_toner_threshold: 20,
    max_concurrent_snmp_requests: 5,
    log_level: 'INFO'
  })
  
  const [activeTab, setActiveTab] = useState<'general' | 'snmp' | 'exchange' | 'counters' | 'notifications' | 'system'>('general')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)
      
      localStorage.setItem('app_settings', JSON.stringify(settings))
      
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('¿Está seguro de restaurar la configuración por defecto?')) {
      localStorage.removeItem('app_settings')
      window.location.reload()
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('app_settings')
    if (saved) {
      try {
        setSettings(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading settings:', error)
      }
    }
  }, [])

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'snmp', label: 'SNMP' },
    { id: 'exchange', label: 'Tasas de Cambio' },
    { id: 'counters', label: 'Contadores' },
    { id: 'notifications', label: 'Notificaciones' },
    { id: 'system', label: 'Sistema' }
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="mt-2 text-sm text-gray-600">Administra los parámetros de la aplicación</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg border p-4 ${
          message.type === 'success' 
            ? 'border-green-200 bg-green-50 text-green-800' 
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}

      <Card>
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6 min-h-[400px]">
              <Input
                label="Nombre de la Empresa"
                value={settings.company_name}
                onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-6">
                <Select
                  label="Zona Horaria"
                  value={settings.timezone}
                  onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  options={[
                    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
                    { value: 'America/New_York', label: 'New York (GMT-5)' },
                    { value: 'Europe/London', label: 'London (GMT+0)' },
                    { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
                  ]}
                />

                <Select
                  label="Formato de Fecha"
                  value={settings.date_format}
                  onChange={(e) => setSettings(prev => ({ ...prev, date_format: e.target.value }))}
                  options={[
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* SNMP Tab */}
          {activeTab === 'snmp' && (
            <div className="space-y-6 min-h-[400px]">
              <div className="grid grid-cols-2 gap-6">
                <Input
                  label="Timeout (segundos)"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.snmp_timeout.toString()}
                  onChange={(e) => setSettings(prev => ({ ...prev, snmp_timeout: parseInt(e.target.value) || 5 }))}
                  helperText="Tiempo máximo de espera para respuestas SNMP"
                />

                <Input
                  label="Reintentos"
                  type="number"
                  min="0"
                  max="5"
                  value={settings.snmp_retries.toString()}
                  onChange={(e) => setSettings(prev => ({ ...prev, snmp_retries: parseInt(e.target.value) || 2 }))}
                  helperText="Número de reintentos en caso de fallo"
                />
              </div>

              <Input
                label="Community String por Defecto"
                value={settings.default_snmp_community}
                onChange={(e) => setSettings(prev => ({ ...prev, default_snmp_community: e.target.value }))}
                helperText="Community string para nuevas impresoras"
              />
            </div>
          )}

          {/* Exchange Rates Tab */}
          {activeTab === 'exchange' && (
            <div className="space-y-6 min-h-[400px]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.auto_update_exchange_rates}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_update_exchange_rates: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">Actualización Automática de Tasas</label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Input
                  label="Frecuencia de Actualización (horas)"
                  type="number"
                  min="1"
                  max="168"
                  value={settings.exchange_rate_update_frequency.toString()}
                  onChange={(e) => setSettings(prev => ({ ...prev, exchange_rate_update_frequency: parseInt(e.target.value) || 24 }))}
                  disabled={!settings.auto_update_exchange_rates}
                />

                <Select
                  label="Moneda por Defecto"
                  value={settings.default_currency}
                  onChange={(e) => setSettings(prev => ({ ...prev, default_currency: e.target.value }))}
                  options={[
                    { value: 'ARS', label: 'Pesos Argentinos (ARS)' },
                    { value: 'USD', label: 'Dólares (USD)' },
                    { value: 'EUR', label: 'Euros (EUR)' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Counters Tab */}
          {activeTab === 'counters' && (
            <div className="space-y-6 min-h-[400px]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.counter_collection_enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, counter_collection_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">Recolección Automática de Contadores</label>
              </div>

              <Input
                label="Programación (Cron)"
                value={settings.counter_collection_schedule}
                onChange={(e) => setSettings(prev => ({ ...prev, counter_collection_schedule: e.target.value }))}
                disabled={!settings.counter_collection_enabled}
                placeholder="0 0 * * *"
                helperText='Formato: minuto hora día mes día-semana (ej: "0 0 * * *" = diario a medianoche)'
              />
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 min-h-[400px]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.email_notifications_enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, email_notifications_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-700">Notificaciones por Email</label>
              </div>

              <Input
                label="Email de Notificaciones"
                type="email"
                value={settings.notification_email}
                onChange={(e) => setSettings(prev => ({ ...prev, notification_email: e.target.value }))}
                disabled={!settings.email_notifications_enabled}
                placeholder="admin@empresa.com"
              />

              <Input
                label="Umbral de Tóner Bajo (%)"
                type="number"
                min="0"
                max="100"
                value={settings.low_toner_threshold.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, low_toner_threshold: parseInt(e.target.value) || 20 }))}
                helperText="Porcentaje mínimo de tóner antes de notificar"
              />
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6 min-h-[400px]">
              <Input
                label="Máximo de Peticiones SNMP Concurrentes"
                type="number"
                min="1"
                max="20"
                value={settings.max_concurrent_snmp_requests.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, max_concurrent_snmp_requests: parseInt(e.target.value) || 5 }))}
                helperText="Número máximo de consultas SNMP simultáneas"
              />

              <Select
                label="Nivel de Log"
                value={settings.log_level}
                onChange={(e) => setSettings(prev => ({ ...prev, log_level: e.target.value }))}
                options={[
                  { value: 'DEBUG', label: 'DEBUG' },
                  { value: 'INFO', label: 'INFO' },
                  { value: 'WARNING', label: 'WARNING' },
                  { value: 'ERROR', label: 'ERROR' },
                ]}
                helperText="Nivel de detalle en los logs del sistema"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button
            variant="secondary"
            onClick={handleReset}
          >
            Restaurar por Defecto
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
          >
            Guardar Cambios
          </Button>
        </div>
      </Card>
    </div>
  )
}

