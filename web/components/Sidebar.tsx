'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  isCollapsed: boolean
}

export default function Sidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpand = (item: string) => {
    setExpandedItems(prev =>
      prev.includes(item)
        ? prev.filter(i => i !== item)
        : [...prev, item]
    )
  }

  const isActive = (path: string) => pathname === path

  return (
    <aside className={`fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white transition-all duration-300 ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      <div className="flex h-full flex-col overflow-y-auto p-4">
        {/* Logo */}
        <div className={`mb-8 flex items-center gap-2 px-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          {!isCollapsed && <span className="text-lg font-bold text-gray-900">PrinterFleet</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {/* DASHBOARDS Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Dashboards
              </p>
            )}
            
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Overview"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {!isCollapsed && <span>Overview</span>}
            </Link>

            <Link
              href="/inventory"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/inventory')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Inventory"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {!isCollapsed && <span>Inventory</span>}
            </Link>
          </div>

          {/* MANAGEMENT Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Management
              </p>
            )}

            <Link
              href="/counters"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/counters')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Counters"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {!isCollapsed && <span>Counters</span>}
            </Link>

            <Link
              href="/medical-printers"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/medical-printers')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Medical Printers"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              {!isCollapsed && <span>Medical Printers</span>}
            </Link>

            <Link
              href="/incidents"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/incidents')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Incidents"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {!isCollapsed && <span>Incidents</span>}
            </Link>

            <Link
              href="/contracts"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/contracts')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Contracts"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isCollapsed && <span>Contracts</span>}
            </Link>
          </div>

          {/* FINANCIAL Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Financial
              </p>
            )}

            <Link
              href="/billing"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/billing')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Billing"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {!isCollapsed && <span>Billing</span>}
            </Link>

            <Link
              href="/exchange-rates"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/exchange-rates')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Exchange Rates"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {!isCollapsed && <span>Exchange Rates</span>}
            </Link>
          </div>

          {/* SYSTEM Section */}
          <div className="mb-4">
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                System
              </p>
            )}

            <Link
              href="/stock"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/stock')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Stock"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {!isCollapsed && <span>Stock</span>}
            </Link>

            <Link
              href="/settings"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/settings')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title="Settings"
            >
              <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!isCollapsed && <span>Settings</span>}
            </Link>
          </div>
        </nav>
      </div>
    </aside>
  )
}
