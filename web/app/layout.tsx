'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { AuthProvider } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  
  // Don't show sidebar/header on login page
  const isLoginPage = pathname === '/login'

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <title>Printer Fleet Manager</title>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E🖨️%3C/text%3E%3C/svg%3E" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            {isLoginPage ? (
              children
            ) : (
              <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
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
              </ProtectedRoute>
            )}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}