/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
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
  },
  // Configuración de webpack para hot-reload en Docker
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // Verifica cambios cada segundo
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

module.exports = nextConfig