import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'gray'
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
  }

  const dotColors = {
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    default: 'bg-blue-600',
    gray: 'bg-gray-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotColors[variant]}`}></span>
      )}
      {children}
    </span>
  )
}

interface OutlineBadgeProps {
  children: React.ReactNode
  className?: string
}

export function OutlineBadge({ children, className = '' }: OutlineBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-700 ${className}`}
    >
      {children}
    </span>
  )
}
