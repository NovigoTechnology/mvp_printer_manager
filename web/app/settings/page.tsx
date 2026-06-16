'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge } from '@/components/ui'
import UsersManagement from '@/components/UsersManagement'
import { useTheme } from '@/contexts/ThemeContext'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

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
  
  // SMTP Configuration
  smtp_enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_use_tls: boolean
  smtp_username: string
  smtp_password: string
  smtp_from_email: string
  smtp_from_name: string
  
  // System - Printers
  max_concurrent_snmp_requests: number
  log_level: string
}

interface MedicalScheduleConfig {
  daily_schedule_hour: number
  daily_schedule_minute: number
  hourly_enabled: boolean
  hourly_interval: number
  cleanup_hour: number
  retention_days: number
  cartridge_detection_threshold: number
}

export default function Settings() {
  const { theme, accentColor, setTheme, setAccentColor } = useTheme()
  
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
    smtp_enabled: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_use_tls: true,
    smtp_username: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'Printer Fleet Manager',
    max_concurrent_snmp_requests: 5,
    log_level: 'INFO'
  })
  
  const [activeTab, setActiveTab] = useState<'general' | 'snmp' | 'exchange' | 'counters' | 'notifications' | 'system' | 'users' | 'appearance'>('general')
  const [activeSystemSubTab, setActiveSystemSubTab] = useState<'printers' | 'medical-printers'>('printers')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)
      
      // Save to localStorage
      localStorage.setItem('app_settings', JSON.stringify(settings))
      
      // Save SMTP configuration to backend if in notifications tab
      if (activeTab === 'notifications') {
        try {
          const token = localStorage.getItem('token')
          if (!token) {
            throw new Error('No authentication token found')
          }

          const smtpConfig = {
            enabled: settings.smtp_enabled,
            host: settings.smtp_host,
            port: settings.smtp_port,
            use_tls: settings.smtp_use_tls,
            username: settings.smtp_username,
            password: settings.smtp_password,
            from_email: settings.smtp_from_email,
            from_name: settings.smtp_from_name
          }

          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const response = await fetch(`${apiUrl}/api/settings/smtp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(smtpConfig)
          })

          if (!response.ok) {
            const error = await response.json()
            console.error('SMTP API error:', error)
            throw new Error(error.detail || 'Error saving SMTP configuration')
          }

          console.log('SMTP configuration saved to backend')
        } catch (smtpError) {
          console.error('Error saving SMTP config to backend:', smtpError)
          setMessage({ type: 'error', text: 'Configuración local guardada pero error en backend SMTP' })
          setTimeout(() => setMessage(null), 5000)
          setSaving(false)
          return
        }
      }
      
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

  const handleTestSmtpConnection = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/settings/smtp/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setMessage({ type: 'success', text: `✅ Conexión SMTP exitosa: ${result.host}:${result.port}` })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: `❌ Error de conexión SMTP: ${error.detail}` })
      }

      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      console.error('Error testing SMTP connection:', error)
      setMessage({ type: 'error', text: 'Error al probar conexión SMTP' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setSaving(false)
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

    // Load SMTP configuration from backend
    const loadSmtpConfig = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          console.log('No authentication token, skipping SMTP config load')
          return
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/settings/smtp`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const smtpConfig = await response.json()
          setSettings(prev => ({
            ...prev,
            smtp_enabled: smtpConfig.enabled,
            smtp_host: smtpConfig.host || '',
            smtp_port: smtpConfig.port || 587,
            smtp_use_tls: smtpConfig.use_tls !== undefined ? smtpConfig.use_tls : true,
            smtp_username: smtpConfig.username || '',
            smtp_password: '', // Don't load password from backend for security
            smtp_from_email: smtpConfig.from_email || '',
            smtp_from_name: smtpConfig.from_name || 'Printer Fleet Manager'
          }))
          console.log('SMTP configuration loaded from backend')
        } else {
          console.log('Could not load SMTP config from backend, using local defaults')
        }
      } catch (error) {
        console.error('Error loading SMTP config from backend:', error)
        // Silent fail - continue with local settings
      }
    }

    loadSmtpConfig()
  }, [])

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Apariencia' },
    { id: 'snmp', label: 'SNMP' },
    { id: 'exchange', label: 'Tasas de Cambio' },
    { id: 'counters', label: 'Contadores' },
    { id: 'notifications', label: 'Notificaciones' },
    { id: 'system', label: 'Sistema' },
    { id: 'users', label: 'Usuarios y Permisos' }
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

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 min-h-[400px]">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tema</h3>
                <p className="text-sm text-gray-600 mb-6">Personaliza la apariencia de la aplicación</p>
                
                <div className="space-y-4">
                  {/* Theme Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Modo de color
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <button
                        onClick={() => setTheme('light')}
                        className={`relative flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                          theme === 'light'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {theme === 'light' && (
                          <div className="absolute top-2 right-2">
                            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <svg className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-sm font-medium">Claro</span>
                      </button>

                      <button
                        onClick={() => setTheme('dark')}
                        className={`relative flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                          theme === 'dark'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {theme === 'dark' && (
                          <div className="absolute top-2 right-2">
                            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <svg className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                        <span className="text-sm font-medium">Oscuro</span>
                      </button>

                      <button
                        onClick={() => setTheme('auto')}
                        className={`relative flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all ${
                          theme === 'auto'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {theme === 'auto' && (
                          <div className="absolute top-2 right-2">
                            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <svg className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-sm font-medium">Automático</span>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {theme === 'auto' 
                        ? 'El tema cambiará automáticamente según la configuración del sistema' 
                        : `Usar tema ${theme === 'light' ? 'claro' : 'oscuro'} siempre`
                      }
                    </p>
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Color de acento
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-12 w-20 cursor-pointer rounded border border-gray-300"
                      />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="#3B82F6"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Selecciona el color principal para botones, enlaces y elementos interactivos
                    </p>
                  </div>

                  {/* Preset Colors */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colores predefinidos
                    </label>
                    <div className="flex gap-3">
                      {[
                        { name: 'Azul', color: '#3B82F6' },
                        { name: 'Índigo', color: '#6366F1' },
                        { name: 'Púrpura', color: '#8B5CF6' },
                        { name: 'Rosa', color: '#EC4899' },
                        { name: 'Rojo', color: '#EF4444' },
                        { name: 'Naranja', color: '#F97316' },
                        { name: 'Verde', color: '#10B981' },
                        { name: 'Teal', color: '#14B8A6' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => setAccentColor(preset.color)}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                            accentColor.toLowerCase() === preset.color.toLowerCase()
                              ? 'border-gray-900 scale-110'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        >
                          {accentColor.toLowerCase() === preset.color.toLowerCase() && (
                            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Vista previa</h4>
                    <div className="space-y-3">
                      <button
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: accentColor }}
                      >
                        Botón de ejemplo
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }}></div>
                        <span className="text-sm" style={{ color: accentColor }}>Texto con color de acento</span>
                      </div>
                    </div>
                  </div>
                </div>
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
            <div className="space-y-8 min-h-[400px]">
              {/* Email Notifications Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Notificaciones por Email</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.email_notifications_enabled}
                      onChange={(e) => setSettings(prev => ({ ...prev, email_notifications_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Habilitar notificaciones por email</label>
                  </div>

                  {settings.email_notifications_enabled && (
                    <>
                      <Input
                        label="Email para Notificaciones"
                        type="email"
                        value={settings.notification_email}
                        onChange={(e) => setSettings(prev => ({ ...prev, notification_email: e.target.value }))}
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
                    </>
                  )}
                </div>
              </div>

              {/* SMTP Configuration Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Configuración SMTP</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={settings.smtp_enabled}
                      onChange={(e) => setSettings(prev => ({ ...prev, smtp_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Usar configuración SMTP personalizada</label>
                  </div>

                  {settings.smtp_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Host SMTP"
                          value={settings.smtp_host}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_host: e.target.value }))}
                          placeholder="smtp.gmail.com"
                          helperText="Servidor SMTP (ej: smtp.gmail.com, smtp.office365.com)"
                        />

                        <Input
                          label="Puerto SMTP"
                          type="number"
                          value={settings.smtp_port.toString()}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                          placeholder="587"
                          helperText="Puerto (587 para TLS, 465 para SSL, 25 para conexión plana)"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.smtp_use_tls}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_use_tls: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label className="text-sm font-medium text-gray-700">Usar TLS/SSL</label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Usuario SMTP"
                          value={settings.smtp_username}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_username: e.target.value }))}
                          placeholder="tu-email@gmail.com"
                          helperText="Nombre de usuario para autenticación"
                        />

                        <Input
                          label="Contraseña SMTP"
                          type="password"
                          value={settings.smtp_password}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_password: e.target.value }))}
                          placeholder="••••••••"
                          helperText="Contraseña de aplicación (no la contraseña de tu cuenta)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Email Remitente"
                          type="email"
                          value={settings.smtp_from_email}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_from_email: e.target.value }))}
                          placeholder="noreply@empresa.com"
                          helperText="Dirección de correo del remitente"
                        />

                        <Input
                          label="Nombre del Remitente"
                          value={settings.smtp_from_name}
                          onChange={(e) => setSettings(prev => ({ ...prev, smtp_from_name: e.target.value }))}
                          placeholder="Printer Fleet Manager"
                          helperText="Nombre que aparecerá en el remitente"
                        />
                      </div>

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        <p className="font-medium">⚠️ Nota importante:</p>
                        <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
                          <li>Para Gmail: usa una <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">contraseña de aplicación</a></li>
                          <li>Para Office 365: usa tu correo empresarial y contraseña</li>
                          <li>Los datos SMTP se guardarán en el servidor de forma encriptada</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleTestSmtpConnection}
                          disabled={saving || !settings.smtp_host || !settings.smtp_username || !settings.smtp_from_email}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition"
                        >
                          {saving ? 'Probando...' : '🧪 Probar Conexión'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <>
              {/* System Sub-tabs */}
              <div className="mb-6 border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveSystemSubTab('printers')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      activeSystemSubTab === 'printers'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Impresoras
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveSystemSubTab('medical-printers')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm ${
                      activeSystemSubTab === 'medical-printers'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Impresoras Médicas
                    </div>
                  </button>
                </nav>
              </div>

              {/* System Sub-tab Content */}
              {activeSystemSubTab === 'printers' && (
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

              {activeSystemSubTab === 'medical-printers' && (
                <MedicalPrinterScheduleSettings />
              )}
            </>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <UsersManagement />
          )}
        </div>

        {/* Actions */}
        {activeTab !== 'users' && (
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
        )}
      </Card>
    </div>
  )
}

// Componente: Configuración de Tareas Programadas para Impresoras Médicas
function MedicalPrinterScheduleSettings() {
  const [dailyScheduleHour, setDailyScheduleHour] = useState(7)
  const [dailyScheduleMinute, setDailyScheduleMinute] = useState(0)
  const [hourlyEnabled, setHourlyEnabled] = useState(true)
  const [hourlyInterval, setHourlyInterval] = useState(1)
  const [cleanupHour, setCleanupHour] = useState(3)
  const [retentionDays, setRetentionDays] = useState(30)
  const [cartridgeDetectionThreshold, setCartridgeDetectionThreshold] = useState(20)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/medical-printers/schedule-config`)
        if (response.ok) {
          const config = await response.json()
          setDailyScheduleHour(config.daily_schedule_hour)
          setDailyScheduleMinute(config.daily_schedule_minute)
          setHourlyEnabled(config.hourly_enabled)
          setHourlyInterval(config.hourly_interval)
          setCleanupHour(config.cleanup_hour)
          setRetentionDays(config.retention_days)
          setCartridgeDetectionThreshold(config.cartridge_detection_threshold)
        }
      } catch (error) {
        console.error('Error loading config:', error)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/medical-printers/schedule-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_schedule_hour: dailyScheduleHour,
          daily_schedule_minute: dailyScheduleMinute,
          hourly_enabled: hourlyEnabled,
          hourly_interval: hourlyInterval,
          cleanup_hour: cleanupHour,
          retention_days: retentionDays,
          cartridge_detection_threshold: cartridgeDetectionThreshold,
        })
      })

      if (response.ok) {
        alert('Configuración guardada exitosamente. Los cambios se aplicarán en el próximo ciclo.')
      } else {
        alert('Error al guardar la configuración')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleTestNow = async () => {
    try {
      const response = await fetch(`${API_BASE}/medical-printers/collect-all-counters`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Recolección manual ejecutada: ${data.collected} exitosas, ${data.failed} fallidas`)
      } else {
        alert('Error al ejecutar recolección manual')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error de conexión')
    }
  }

  return (
    <div className="space-y-8 min-h-[400px]">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Tareas Programadas - Impresoras Médicas
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Configuración de recolección automática de contadores y detección de cambios de cartucho
            </p>
          </div>

      {/* Snapshot Diario */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-base font-medium text-gray-900">Snapshot Diario</h4>
            <p className="text-sm text-gray-600">Recolección principal de contadores una vez al día</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
            <input
              type="number"
              min="0"
              max="23"
              value={dailyScheduleHour}
              onChange={(e) => setDailyScheduleHour(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minuto</label>
            <input
              type="number"
              min="0"
              max="59"
              value={dailyScheduleMinute}
              onChange={(e) => setDailyScheduleMinute(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Próxima ejecución: Todos los días a las {dailyScheduleHour.toString().padStart(2, '0')}:{dailyScheduleMinute.toString().padStart(2, '0')}
        </p>
      </div>

      {/* Snapshot Horario */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-medium text-gray-900">Snapshot Horario (Detección de Cartuchos)</h4>
                <p className="text-sm text-gray-600">Monitoreo continuo para detectar cambios de cartucho</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hourlyEnabled}
                  onChange={(e) => setHourlyEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {hourlyEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo (horas)</label>
            <select
              value={hourlyInterval}
              onChange={(e) => setHourlyInterval(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
            >
              <option value="1">Cada 1 hora</option>
              <option value="2">Cada 2 horas</option>
              <option value="3">Cada 3 horas</option>
              <option value="4">Cada 4 horas</option>
              <option value="6">Cada 6 horas</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">
              Se ejecutará cada {hourlyInterval} hora(s) en punto
            </p>
          </div>
        )}
      </div>

      {/* Detección de Cambio de Cartucho */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-base font-medium text-gray-900">Detección de Cambio de Cartucho</h4>
            <p className="text-sm text-gray-600">Umbral para detectar automáticamente cuando se cambia un cartucho</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Umbral de detección (films)
          </label>
          <input
            type="number"
            min="5"
            max="50"
            value={cartridgeDetectionThreshold}
            onChange={(e) => setCartridgeDetectionThreshold(parseInt(e.target.value))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm px-3 py-2 border"
          />
          <p className="mt-2 text-sm text-gray-500">
            Se detectará cambio de cartucho si los films disponibles aumentan ≥ {cartridgeDetectionThreshold} films
          </p>
        </div>
      </div>

      {/* Limpieza de Datos Antiguos */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-base font-medium text-gray-900">Limpieza de Snapshots Antiguos</h4>
            <p className="text-sm text-gray-600">Optimización automática del almacenamiento de datos históricos</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora de ejecución</label>
            <input
              type="number"
              min="0"
              max="23"
              value={cleanupHour}
              onChange={(e) => setCleanupHour(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retención (días)</label>
            <input
              type="number"
              min="7"
              max="365"
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Diariamente a las {cleanupHour.toString().padStart(2, '0')}:00, se mantendrán snapshots horarios de los últimos {retentionDays} días
        </p>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={handleTestNow}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ejecutar Recolección Ahora
        </button>

        <div className="flex space-x-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
          >
            Restaurar por Defecto
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Información adicional */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">Información importante</h3>
            <div className="mt-2 text-sm text-gray-600">
              <ul className="list-disc pl-5 space-y-1">
                <li>Los cambios en las tareas programadas requieren reiniciar el servicio API</li>
                <li>El snapshot diario guarda registros en <code className="text-xs bg-gray-200 px-1 rounded">medical_printer_counters</code></li>
                <li>El snapshot horario guarda en <code className="text-xs bg-gray-200 px-1 rounded">medical_printer_snapshots</code> y detecta cambios de cartucho automáticamente</li>
                <li>La detección automática crea registros en <code className="text-xs bg-gray-200 px-1 rounded">medical_printer_refills</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}



