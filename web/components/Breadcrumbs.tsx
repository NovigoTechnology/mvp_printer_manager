'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Breadcrumbs() {
  const pathname = usePathname()
  
  // Mapeo de rutas a nombres legibles
  const routeNames: Record<string, string> = {
    '': 'Dashboard',
    'inventory': 'Inventario',
    'printers': 'Impresoras',
    'incidents': 'Incidentes',
    'medical-printers': 'Impresoras Médicas',
    'supply-requests': 'Solicitudes',
    'reports': 'Reportes',
    'billing': 'Facturación',
    'contracts': 'Contratos',
    'companies': 'Empresas'
  }

  // Dividir el pathname en segmentos
  const segments = pathname.split('/').filter(Boolean)
  
  // Construir breadcrumbs
  const breadcrumbs = [
    { name: 'Inicio', href: '/' },
    ...segments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join('/')}`
      const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
      return { name, href }
    })
  ]

  return (
    <nav className="flex items-center space-x-2 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <svg className="h-4 w-4 text-gray-400 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.name}</span>
          ) : (
            <Link 
              href={crumb.href}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
