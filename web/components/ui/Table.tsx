import React from 'react'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">{children}</table>
      </div>
    </div>
  )
}

interface TableHeaderProps {
  children: React.ReactNode
}

export function TableHeader({ children }: TableHeaderProps) {
  return <thead className="bg-gray-50 dark:bg-gray-900/50">{children}</thead>
}

interface TableBodyProps {
  children: React.ReactNode
}

export function TableBody({ children }: TableBodyProps) {
  return <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">{children}</tbody>
}

interface TableRowProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function TableRow({ children, onClick, className = '' }: TableRowProps) {
  return (
    <tr
      className={`transition-colors ${
        onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/60' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

interface TableHeadProps {
  children: React.ReactNode
  className?: string
}

export function TableHead({ children, className = '' }: TableHeadProps) {
  return (
    <th
      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300 ${className}`}
    >
      {children}
    </th>
  )
}

interface TableCellProps {
  children: React.ReactNode
  className?: string
}

export function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  )
}
