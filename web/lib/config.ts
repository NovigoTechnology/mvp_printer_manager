/**
 * Configuración centralizada de la aplicación
 * 
 * Este archivo centraliza todas las variables de entorno y configuraciones
 * para facilitar el mantenimiento y deployment.
 */

/**
 * URL base de la API del backend
 * 
 * En desarrollo local: http://localhost:8000
 * En red/producción: usa el mismo host desde donde se abrió el frontend y puerto 8000
 */
const getDefaultApiBase = () => {
	if (typeof window === 'undefined') {
		return 'http://localhost:8000'
	}

	return `${window.location.protocol}//${window.location.hostname}:8000`
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || getDefaultApiBase()

/**
 * Configuración de timeouts para requests HTTP (en milisegundos)
 */
export const REQUEST_TIMEOUT = 30000

/**
 * Configuración de revalidación de datos
 */
export const REVALIDATE_INTERVAL = 60 // segundos
