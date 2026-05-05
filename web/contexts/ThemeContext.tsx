'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

interface ThemeContextType {
  theme: Theme
  accentColor: string
  setTheme: (theme: Theme) => void
  setAccentColor: (color: string) => void
  isDarkMode: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [accentColor, setAccentColor] = useState<string>('#3B82F6')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Cargar tema guardado
    const savedTheme = localStorage.getItem('app_theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    }

    // Cargar color de acento guardado
    const savedAccentColor = localStorage.getItem('app_accent_color')
    if (savedAccentColor) {
      setAccentColor(savedAccentColor)
    }
  }, [])

  useEffect(() => {
    // Determinar si debemos usar modo oscuro
    let shouldBeDark = false

    if (theme === 'dark') {
      shouldBeDark = true
    } else if (theme === 'auto') {
      // Detectar preferencia del sistema
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    setIsDarkMode(shouldBeDark)

    // Aplicar clase al documento
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Aplicar color de acento como variable CSS
    document.documentElement.style.setProperty('--accent-color', accentColor)
  }, [theme, accentColor])

  useEffect(() => {
    // Escuchar cambios en la preferencia del sistema si está en modo auto
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches)
        if (e.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('app_theme', newTheme)
  }

  const handleSetAccentColor = (color: string) => {
    setAccentColor(color)
    localStorage.setItem('app_accent_color', color)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentColor,
        setTheme: handleSetTheme,
        setAccentColor: handleSetAccentColor,
        isDarkMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
