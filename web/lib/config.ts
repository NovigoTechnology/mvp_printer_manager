/**
 * Configuración centralizada de la aplicación
 * 
 * Este archivo centraliza todas las variables de entorno y configuraciones
 * para facilitar el mantenimiento y deployment.
 */

/**
 * URL base de la API del backend
 * 
 * En desarrollo: http://localhost:8000
 * En producción: Se debe configurar via NEXT_PUBLIC_API_BASE en .env
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

/**
 * Configuración de timeouts para requests HTTP (en milisegundos)
 */
export const REQUEST_TIMEOUT = 30000

/**
 * Configuración de revalidación de datos
 */
export const REVALIDATE_INTERVAL = 60 // segundos
