/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000',
  },
  // Configuración para producción
  output: 'standalone',
  // Mejorar manejo de warnings de desarrollo
  experimental: {
    // Reducir warnings de React DevTools
    esmExternals: 'loose',
  },
  // Configuración de servidor de desarrollo
  devIndicators: {
    buildActivity: false, // Reduce algunos warnings innecesarios
  }
}

module.exports = nextConfig