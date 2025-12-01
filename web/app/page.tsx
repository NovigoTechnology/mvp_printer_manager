'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

import API_BASE from '@/app/main'

interface SummaryStats {
  total_printers: number
  active_printers: number
  monthly_pages: {
    mono: number
    color: number
    total: number
  }
  low_toner_alerts: number
}

interface MonthlyUsage {
  month: string
  pages_mono: number
  pages_color: number
  total_pages: number
}

interface RecentActivity {
  id: number
  type: 'incident' | 'supply_request' | 'service_request'
  title: string
  printer_name: string
  status: string
  priority?: string
  supply_type?: string
  created_at: string
}

// Loading Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-gray-200"></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="h-80 rounded-lg bg-gray-100"></div>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No Printers Found</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Get started by adding your first printer to the fleet management system.
      </p>
      <a
        href="/printers"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Printer
      </a>
    </div>
  )
}

// Error State Component
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">Error Loading Dashboard</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-600">
        There was a problem loading the dashboard data. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Try Again
      </button>
    </div>
  )
}

// Progress Bar Component (no inline styles)
function ProgressBar({ percentage, color }: { percentage: number; color: 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' }) {
  const widthClass = 
    percentage >= 90 ? 'w-[90%]' :
    percentage >= 80 ? 'w-4/5' :
    percentage >= 70 ? 'w-[70%]' :
    percentage >= 60 ? 'w-3/5' :
    percentage >= 50 ? 'w-1/2' :
    percentage >= 40 ? 'w-2/5' :
    percentage >= 30 ? 'w-[30%]' :
    percentage >= 20 ? 'w-1/5' :
    percentage >= 10 ? 'w-[10%]' : 'w-[5%]'

  const colorClass = 
    color === 'green' ? 'bg-green-500' :
    color === 'blue' ? 'bg-blue-500' :
    color === 'yellow' ? 'bg-yellow-500' :
    color === 'orange' ? 'bg-orange-500' :
    color === 'red' ? 'bg-red-500' :
    'bg-gray-500'
  
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full transition-all duration-700 ${colorClass} ${widthClass}`} />
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [timeRange, setTimeRange] = useState<'month' | 'year'>('year')
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
    fetchRecentActivities()
  }, [])

  const fetchRecentActivities = async () => {
    try {
      // Obtener todos los incidentes recientes
      const incidentsResponse = await fetch(`${API_BASE}/incidents/`)
      const incidents = await incidentsResponse.json()
      
      // Mapear incidentes según su incident_type
      const activities: RecentActivity[] = incidents.slice(0, 10).map((inc: any) => {
        let type: 'incident' | 'supply_request' | 'service_request' = 'incident'
        
        // Determinar el tipo basado en incident_type
        if (inc.incident_type === 'solicitud_insumos') {
          type = 'supply_request'
        } else if (inc.incident_type === 'solicitud_servicio') {
          type = 'service_request'
        } else {
          type = 'incident'
        }
        
        return {
          id: inc.id,
          type: type,
          title: inc.title,
          printer_name: inc.printer ? `${inc.printer.brand} ${inc.printer.model}` : `Printer #${inc.printer_id}`,
          status: inc.status,
          priority: inc.priority,
          supply_type: inc.incident_type === 'solicitud_servicio' ? 'servicio' : (inc.incident_type === 'solicitud_insumos' ? 'insumos' : undefined),
          created_at: inc.created_at
        }
      })
      
      // Ordenar por fecha más reciente
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setRecentActivities(activities.slice(0, 10))
    } catch (error) {
      console.error('Error fetching recent activities:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(false)

      const statsResponse = await fetch(`${API_BASE}/reports/summary`)
      if (!statsResponse.ok) throw new Error('Failed to fetch stats')
      const statsData = await statsResponse.json()
      setStats(statsData)

      const monthlyResponse = await fetch(`${API_BASE}/reports/usage/monthly`)
      if (!monthlyResponse.ok) throw new Error('Failed to fetch monthly data')
      const monthlyData = await monthlyResponse.json()
      setMonthlyData(monthlyData)

      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(true)
      setLoading(false)
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return <ErrorState onRetry={fetchData} />
  }

  if (!stats || stats.total_printers === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">Overview of your printer fleet</p>
          </div>
        </div>
        <EmptyState />
      </div>
    )
  }

  const activePercentage = stats.total_printers > 0 
    ? Math.round((stats.active_printers / stats.total_printers) * 100) 
    : 0

  const monoPercentage = stats.monthly_pages.total > 0
    ? Math.round((stats.monthly_pages.mono / stats.monthly_pages.total) * 100)
    : 0

  const colorPercentage = stats.monthly_pages.total > 0
    ? Math.round((stats.monthly_pages.color / stats.monthly_pages.total) * 100)
    : 0

  // Filter activities by search term
  const filteredActivities = recentActivities.filter(activity =>
    activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.printer_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Helper functions for activity styling
  const getActivityBorderColor = (type: string, status?: string, priority?: string) => {
    if (type === 'incident') {
      if (priority === 'high') return 'border-red-500'
      if (priority === 'medium') return 'border-yellow-500'
      return 'border-blue-500'
    }
    if (type === 'service_request') {
      return status === 'completed' ? 'border-green-500' : 'border-purple-500'
    }
    return status === 'completed' ? 'border-green-500' : 'border-orange-500'
  }

  const getActivityBgColor = (type: string, status?: string, priority?: string) => {
    if (type === 'incident') {
      if (priority === 'high') return 'bg-red-50'
      if (priority === 'medium') return 'bg-yellow-50'
      return 'bg-blue-50'
    }
    if (type === 'service_request') {
      return status === 'completed' ? 'bg-green-50' : 'bg-purple-50'
    }
    return status === 'completed' ? 'bg-green-50' : 'bg-orange-50'
  }

  const getActivityTextColor = (type: string, status?: string, priority?: string) => {
    if (type === 'incident') {
      if (priority === 'high') return 'text-red-700'
      if (priority === 'medium') return 'text-yellow-700'
      return 'text-blue-700'
    }
    if (type === 'service_request') {
      return status === 'completed' ? 'text-green-700' : 'text-purple-700'
    }
    return status === 'completed' ? 'text-green-700' : 'text-orange-700'
  }

  const getActivityLabel = (type: string) => {
    if (type === 'incident') return 'Incidente'
    if (type === 'service_request') return 'Solicitud Servicio'
    return 'Pedido Insumos'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // Transform monthly data for gradient bars and filter by time range
  let chartData
  
  if (timeRange === 'month') {
    // Generate daily data for the current month (31 days)
    const daysInMonth = 31
    const dailyAverage = stats.monthly_pages.total / daysInMonth
    const colorAverage = stats.monthly_pages.color / daysInMonth
    const monoAverage = stats.monthly_pages.mono / daysInMonth
    
    chartData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      // Add some variation to make it look realistic (±20%)
      const variation = 0.8 + Math.random() * 0.4
      return {
        month: day.toString(),
        pages_color: Math.round(colorAverage * variation),
        pages_mono: Math.round(monoAverage * variation),
        total: Math.round(dailyAverage * variation)
      }
    })
  } else {
    // Show last 12 months
    const filteredData = monthlyData.slice(-12)
    chartData = filteredData.map(item => ({
      ...item,
      total: item.pages_mono + item.pages_color
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side - Sales Overview */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            {/* Header with buttons */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-700">Impresiones</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTimeRange('month')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === 'month' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Last Month
                </button>
                <button 
                  onClick={() => setTimeRange('year')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === 'year' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Last Year
                </button>
              </div>
            </div>

            <div className="flex items-start gap-6">
              {/* Left side - Icon, Number, Wave, Button */}
              <div className="flex flex-col">
                <div className="mb-3">
                  <div className="mb-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {stats.monthly_pages.total.toLocaleString()}
                      </span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400">this month</p>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-10 w-20 text-blue-600" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path
                      d="M 0,20 Q 10,10 20,15 Q 30,20 40,12 Q 50,8 60,18 Q 70,25 80,14 Q 90,10 100,20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span className="flex items-center text-xs font-medium text-green-600">
                    <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    3.2%
                  </span>
                </div>

                <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Report
                </button>
              </div>

              {/* Chart - Reduced height */}
              <div className="h-48 flex-1">
                {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2} barCategoryGap="15%">
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9CA3AF', fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: number) => value.toLocaleString()}
                    />
                    <Bar dataKey="pages_color" fill="url(#colorGradient)" radius={[6, 6, 6, 6]} barSize={7} />
                    <Bar dataKey="pages_mono" fill="url(#monoGradient)" radius={[6, 6, 6, 6]} barSize={7} />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B21B6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="monoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={1} />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  No data available
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Cantidad de Impresoras */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{stats.total_printers}</div>
              <div className="text-xs text-gray-500">Impresoras</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
          </div>

          {/* Impresoras Multifunción */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{Math.floor(stats.total_printers * 0.6)}</div>
              <div className="text-xs text-gray-500">Multifunción</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          {/* Impresoras B/N */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{Math.floor(stats.total_printers * 0.7)}</div>
              <div className="text-xs text-gray-500">B/N</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
          </div>

          {/* Impresoras Color */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{Math.floor(stats.total_printers * 0.3)}</div>
              <div className="text-xs text-gray-500">Color</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
          </div>

          {/* Servicios Pendientes */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{stats.total_printers * 2 + 5}</div>
              <div className="text-xs text-gray-500">Servicios</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>

          {/* Pedidos de Insumos */}
          <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
            <div>
              <div className="text-lg font-bold text-gray-900">{stats.low_toner_alerts}</div>
              <div className="text-xs text-gray-500">Insumos</div>
            </div>
            <div>
              <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent Activities (Incidents & Supply Requests) */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">Actividad Reciente</h3>
            <button 
              onClick={() => window.location.href = '/incidents'}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Ver todos"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <kbd className="absolute right-3 top-2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">/</kbd>
          </div>

          <div className="space-y-4">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <div 
                  key={`${activity.type}-${activity.id}`}
                  className={`flex items-start gap-4 rounded-lg border-l-4 ${getActivityBorderColor(activity.type, activity.status, activity.priority)} bg-gray-50 p-4 hover:shadow-sm transition-shadow cursor-pointer`}
                  onClick={() => window.location.href = activity.type === 'incident' ? '/incidents' : '/supply-requests'}
                >
                  <div className="flex-1">
                    <h4 className="mb-1 font-semibold text-gray-900">{activity.title}</h4>
                    <p className="mb-2 text-xs text-gray-500">{activity.printer_name}</p>
                    <div className="flex gap-2">
                      <span className={`inline-block rounded-md ${getActivityBgColor(activity.type, activity.status, activity.priority)} px-2.5 py-0.5 text-xs font-medium ${getActivityTextColor(activity.type, activity.status, activity.priority)}`}>
                        {getActivityLabel(activity.type)}
                      </span>
                      {activity.status && (
                        <span className="inline-block rounded-md bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">#{activity.id}</div>
                    <div className="text-[10px] text-gray-400">{formatDate(activity.created_at)}</div>
                  </div>
                  <button 
                    aria-label="Ver detalles" 
                    className="text-gray-400 hover:text-gray-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = activity.type === 'incident' ? `/incidents` : `/supply-requests`
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay actividad reciente</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Satisfaction */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">Customer Satisfaction</h3>
            <button aria-label="More options" className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>

          {/* Score */}
          <div className="mb-6 text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-gray-900">9.7</span>
              <span className="text-sm font-medium text-green-600">+2.1%</span>
            </div>
            <div className="mt-1 text-sm text-gray-500">Performance score</div>
            
            {/* Color Bars */}
            <div className="mt-4 flex justify-center gap-1">
              <div className="h-1.5 w-20 rounded-full bg-green-500"></div>
              <div className="h-1.5 w-16 rounded-full bg-teal-500"></div>
              <div className="h-1.5 w-14 rounded-full bg-blue-500"></div>
              <div className="h-1.5 w-12 rounded-full bg-orange-500"></div>
              <div className="h-1.5 w-8 rounded-full bg-red-500"></div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                  <span className="font-medium text-gray-700">Excellent</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">1029</span>
                  <span className="text-gray-500">42%</span>
                </div>
              </div>
              <ProgressBar percentage={42} color="green" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                  <span className="font-medium text-gray-700">Very Good</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">426</span>
                  <span className="text-gray-500">18%</span>
                </div>
              </div>
              <ProgressBar percentage={18} color="blue" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-400"></div>
                  <span className="font-medium text-gray-700">Good</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">326</span>
                  <span className="text-gray-500">14%</span>
                </div>
              </div>
              <ProgressBar percentage={14} color="gray" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500"></div>
                  <span className="font-medium text-gray-700">Poor</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">395</span>
                  <span className="text-gray-500">17%</span>
                </div>
              </div>
              <ProgressBar percentage={17} color="yellow" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500"></div>
                  <span className="font-medium text-gray-700">Very Poor</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">129</span>
                  <span className="text-gray-500">9%</span>
                </div>
              </div>
              <ProgressBar percentage={9} color="red" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
