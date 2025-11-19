'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-gray-50">
          {/* Sidebar */}
          <Sidebar isCollapsed={sidebarCollapsed} />
          
          {/* Header */}
          <Header 
            isCollapsed={sidebarCollapsed} 
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
          />

          {/* Main content */}
          <main 
            className="mt-16 p-6 transition-all duration-300"
            style={{ marginLeft: sidebarCollapsed ? '80px' : '256px' }}
          >
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}