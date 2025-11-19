// Exportar componente principal
export { PrinterIcon, usePrinterEmoji, getBrandColor, getSupportedBrands } from './PrinterIcon';

// Exportar iconos individuales para uso específico
export {
  HPIcon,
  BrotherIcon,
  OKIIcon,
  LexmarkIcon,
  CanonIcon,
  EpsonIcon,
  RicohIcon,
  GenericPrinterIcon
} from './PrinterBrandIcons';

// Tipos
export interface PrinterIconProps {
  brand: string;
  className?: string;
  size?: number;
}