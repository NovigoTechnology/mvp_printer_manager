import React from 'react';
import {
  HPIcon,
  BrotherIcon,
  SamsungIcon,
  CanonIcon,
  PanasonicIcon,
  SharpIcon,
  LexmarkIcon,
  XeroxIcon,
  ToshibaIcon,
  PrintronixIcon,
  KyoceraIcon,
  TroyIcon,
  RicohIcon,
  OKIIcon,
  EpsonIcon,
  GenericPrinterIcon
} from './PrinterBrandIcons';

interface PrinterIconProps {
  brand: string;
  className?: string;
  size?: number;
}

/**
 * Componente que renderiza el icono apropiado según la marca de la impresora
 * @param brand - Marca de la impresora
 * @param className - Clases CSS adicionales
 * @param size - Tamaño del icono en píxeles
 */
export const PrinterIcon: React.FC<PrinterIconProps> = ({ 
  brand, 
  className = "", 
  size = 24 
}) => {
  // Normalizar la marca para comparación
  const normalizedBrand = brand.toLowerCase().trim();

  // Mapear marcas a sus iconos correspondientes
  const getIconForBrand = () => {
    switch (normalizedBrand) {
      case 'hp':
      case 'hewlett-packard':
      case 'hewlett packard':
        return <HPIcon className={className} size={size} />;
      
      case 'brother':
        return <BrotherIcon className={className} size={size} />;
      
      case 'samsung':
        return <SamsungIcon className={className} size={size} />;
      
      case 'canon':
        return <CanonIcon className={className} size={size} />;
      
      case 'panasonic':
        return <PanasonicIcon className={className} size={size} />;
      
      case 'sharp':
        return <SharpIcon className={className} size={size} />;
      
      case 'lexmark':
        return <LexmarkIcon className={className} size={size} />;
      
      case 'xerox':
        return <XeroxIcon className={className} size={size} />;
      
      case 'toshiba':
        return <ToshibaIcon className={className} size={size} />;
      
      case 'printronix':
        return <PrintronixIcon className={className} size={size} />;
      
      case 'kyocera':
      case 'kyocera mita':
        return <KyoceraIcon className={className} size={size} />;
      
      case 'troy':
        return <TroyIcon className={className} size={size} />;
      
      case 'ricoh':
        return <RicohIcon className={className} size={size} />;
      
      case 'oki':
      case 'oki data':
        return <OKIIcon className={className} size={size} />;
      
      case 'epson':
      case 'seiko epson':
        return <EpsonIcon className={className} size={size} />;
      
      default:
        return <GenericPrinterIcon className={className} size={size} />;
    }
  };

  return getIconForBrand();
};

/**
 * Hook para obtener emoji/texto alternativo basado en la marca
 * @param brand - Marca de la impresora
 * @returns Emoji o texto representativo
 */
export const usePrinterEmoji = (brand: string): string => {
  const normalizedBrand = brand.toLowerCase().trim();
  
  const emojiMap: { [key: string]: string } = {
    'hp': '🖨️',
    'brother': '👥',
    'oki': '⚡',
    'lexmark': '📊',
    'canon': '📷',
    'epson': '🎨',
    'ricoh': '🔧',
  };

  return emojiMap[normalizedBrand] || '🖨️';
};

/**
 * Función utilitaria para obtener el color de marca
 * @param brand - Marca de la impresora
 * @returns Color hexadecimal de la marca
 */
export const getBrandColor = (brand: string): string => {
  const normalizedBrand = brand.toLowerCase().trim();
  
  const colorMap: { [key: string]: string } = {
    'hp': '#0096D6',
    'brother': '#FF6B35',
    'oki': '#E31E24',
    'lexmark': '#C41E3A',
    'canon': '#BF0000',
    'epson': '#003DA5',
    'ricoh': '#E60012',
  };

  return colorMap[normalizedBrand] || '#6B7280';
};

/**
 * Función para obtener todas las marcas soportadas
 * @returns Array de marcas soportadas
 */
export const getSupportedBrands = (): string[] => {
  return [
    'HP', 'Brother', 'Samsung', 'Canon', 'Panasonic', 'Sharp', 
    'Lexmark', 'Xerox', 'Toshiba', 'Printronix', 'Kyocera', 
    'Troy', 'Ricoh', 'OKI', 'Epson'
  ];
};

export default PrinterIcon;