import React from 'react';
import {
  PrinterIcon,
  HPIcon,
  BrotherIcon,
  OKIIcon,
  LexmarkIcon,
  CanonIcon,
  EpsonIcon,
  RicohIcon,
  GenericPrinterIcon,
  getBrandColor,
  getSupportedBrands
} from './index';

interface IconShowcaseProps {
  className?: string;
}

/**
 * Componente de demostración que muestra todos los iconos de marcas disponibles
 */
export const IconShowcase: React.FC<IconShowcaseProps> = ({ className = "" }) => {
  const brands = getSupportedBrands();

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        Iconos de Marcas de Impresoras
      </h3>
      
      {/* Iconos usando el componente PrinterIcon */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">
          Iconos Automáticos (PrinterIcon)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {brands.map((brand) => (
            <div
              key={brand}
              className="flex flex-col items-center p-3 border rounded-lg hover:shadow-md transition-shadow"
              style={{ borderColor: getBrandColor(brand) }}
            >
              <PrinterIcon brand={brand} size={32} className="mb-2" />
              <span className="text-sm font-medium text-gray-700">{brand}</span>
              <span 
                className="text-xs px-2 py-1 rounded-full text-white mt-1"
                style={{ backgroundColor: getBrandColor(brand) }}
              >
                {getBrandColor(brand)}
              </span>
            </div>
          ))}
          
          {/* Icono genérico */}
          <div className="flex flex-col items-center p-3 border rounded-lg hover:shadow-md transition-shadow border-gray-300">
            <PrinterIcon brand="Unknown" size={32} className="mb-2" />
            <span className="text-sm font-medium text-gray-700">Genérico</span>
            <span className="text-xs px-2 py-1 rounded-full text-white mt-1 bg-gray-500">
              #6B7280
            </span>
          </div>
        </div>
      </div>

      {/* Iconos individuales */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-700 mb-3">
          Iconos Individuales
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="flex flex-col items-center p-3 border border-blue-200 rounded-lg">
            <HPIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">HP</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-orange-200 rounded-lg">
            <BrotherIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Brother</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-red-200 rounded-lg">
            <OKIIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">OKI</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-red-300 rounded-lg">
            <LexmarkIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Lexmark</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-red-400 rounded-lg">
            <CanonIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Canon</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-blue-300 rounded-lg">
            <EpsonIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Epson</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-red-300 rounded-lg">
            <RicohIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Ricoh</span>
          </div>
          
          <div className="flex flex-col items-center p-3 border border-gray-300 rounded-lg">
            <GenericPrinterIcon size={32} className="mb-2" />
            <span className="text-sm font-medium">Genérico</span>
          </div>
        </div>
      </div>

      {/* Diferentes tamaños */}
      <div>
        <h4 className="text-lg font-semibold text-gray-700 mb-3">
          Tamaños Disponibles
        </h4>
        <div className="flex items-center space-x-6">
          <div className="flex flex-col items-center">
            <PrinterIcon brand="HP" size={16} className="mb-1" />
            <span className="text-xs text-gray-600">16px</span>
          </div>
          
          <div className="flex flex-col items-center">
            <PrinterIcon brand="Brother" size={24} className="mb-1" />
            <span className="text-xs text-gray-600">24px</span>
          </div>
          
          <div className="flex flex-col items-center">
            <PrinterIcon brand="OKI" size={32} className="mb-1" />
            <span className="text-xs text-gray-600">32px</span>
          </div>
          
          <div className="flex flex-col items-center">
            <PrinterIcon brand="Lexmark" size={48} className="mb-1" />
            <span className="text-xs text-gray-600">48px</span>
          </div>
          
          <div className="flex flex-col items-center">
            <PrinterIcon brand="Canon" size={64} className="mb-1" />
            <span className="text-xs text-gray-600">64px</span>
          </div>
        </div>
      </div>

      {/* Información de uso */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-lg font-semibold text-blue-900 mb-2">
          Cómo usar
        </h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><code className="bg-blue-100 px-2 py-1 rounded">{'<PrinterIcon brand="HP" size={24} />'}</code></p>
          <p><code className="bg-blue-100 px-2 py-1 rounded">{'<HPIcon size={32} className="text-blue-600" />'}</code></p>
          <p>• Marcas soportadas: {brands.join(', ')}</p>
          <p>• Marcas no reconocidas mostrarán el icono genérico</p>
          <p>• Tamaños recomendados: 16px, 24px, 32px, 48px</p>
        </div>
      </div>
    </div>
  );
};

export default IconShowcase;