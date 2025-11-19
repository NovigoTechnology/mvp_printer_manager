import React from 'react';

interface PrinterIconProps {
  className?: string;
  size?: number;
}

// HP Icon - Logo oficial de Wikimedia Commons
export const HPIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/hp-logo-official.svg"
    alt="HP Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// Brother Icon - Logo oficial con mejor visibilidad
export const BrotherIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <div className={`${className} flex items-center justify-center bg-white rounded p-1 border border-gray-200`}>
    <img
      src="/logos/brother-logo-official.svg"
      alt="Brother Logo"
      width={Math.round(size * 0.9)}
      height={Math.round(size * 0.9)}
      className="object-contain"
    />
  </div>
);

// Samsung Icon - Óvalo azul con "SAMSUNG" en blanco
export const SamsungIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="12" cy="12" rx="11" ry="6" fill="#1428A0" />
    <text x="12" y="14" textAnchor="middle" fill="white" fontSize="4" fontFamily="Arial, sans-serif" fontWeight="bold">
      SAMSUNG
    </text>
  </svg>
);

// Canon Icon - Logo oficial 
export const CanonIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/canon-logo-official.svg"
    alt="Canon Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// Panasonic Icon - "Panasonic" en azul con subtítulo
export const PanasonicIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="12" y="11" textAnchor="middle" fill="#0073E6" fontSize="4.5" fontFamily="Arial, sans-serif" fontWeight="bold">
      Panasonic
    </text>
    <text x="12" y="16" textAnchor="middle" fill="#0073E6" fontSize="2.5" fontFamily="Arial, sans-serif">
      Document Imaging Company
    </text>
  </svg>
);

// Sharp Icon - "SHARP" en rojo
export const SharpIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="12" y="14" textAnchor="middle" fill="#E31E24" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="bold">
      SHARP
    </text>
  </svg>
);

// Lexmark Icon - Logo oficial final
export const LexmarkIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/lexmark-logo-final.svg"
    alt="Lexmark Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// Xerox Icon - "xerox" en rojo con círculo
export const XeroxIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="10" y="14" textAnchor="middle" fill="#E31E24" fontSize="6" fontFamily="Arial, sans-serif" fontWeight="normal">
      xerox
    </text>
    <circle cx="19" cy="12" r="3" fill="none" stroke="#E31E24" strokeWidth="2" />
    <path d="M17 10 L21 14 M21 10 L17 14" stroke="#E31E24" strokeWidth="1.5" />
  </svg>
);

// Toshiba Icon - "TOSHIBA" en rojo
export const ToshibaIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="12" y="14" textAnchor="middle" fill="#E31E24" fontSize="5" fontFamily="Arial, sans-serif" fontWeight="bold">
      TOSHIBA
    </text>
  </svg>
);

// Printronix Icon - "PRINTRONIX" en azul
export const PrintronixIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <text x="12" y="14" textAnchor="middle" fill="#0073E6" fontSize="4" fontFamily="Arial, sans-serif" fontWeight="bold">
      PRINTRONIX
    </text>
  </svg>
);

// Kyocera Icon - Logo rojo y negro con "Kyocera mita"
export const KyoceraIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="8" width="4" height="4" fill="#E31E24" />
    <rect x="3" y="9" width="2" height="2" fill="white" />
    <text x="8" y="11" textAnchor="start" fill="#000000" fontSize="4" fontFamily="Arial, sans-serif" fontWeight="bold">
      KYOCERA
    </text>
    <text x="8" y="15" textAnchor="start" fill="#E31E24" fontSize="3" fontFamily="Arial, sans-serif" fontStyle="italic">
      mita
    </text>
  </svg>
);

// Troy Icon - "TROY" en azul con líneas
export const TroyIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2 10 L6 10 L6 14 L2 14" fill="#0073E6" />
    <path d="M2 12 L8 12" stroke="#0073E6" strokeWidth="2" />
    <text x="15" y="14" textAnchor="middle" fill="#0073E6" fontSize="5" fontFamily="Arial, sans-serif" fontWeight="bold">
      TROY
    </text>
  </svg>
);

// Ricoh Icon - Logo oficial de Wikimedia Commons
export const RicohIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/ricoh-logo-official.svg"
    alt="Ricoh Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// OKI Icon - Logo oficial de Wikimedia Commons
export const OKIIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/oki-logo-official.svg"
    alt="OKI Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// Epson Icon - Logo oficial de Wikimedia Commons
export const EpsonIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <img
    src="/logos/epson-logo-official.svg"
    alt="Epson Logo"
    width={size}
    height={size}
    className={`${className} object-contain`}
  />
);

// Generic Printer Icon
export const GenericPrinterIcon: React.FC<PrinterIconProps> = ({ className = "", size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="9" width="18" height="8" rx="1.5" fill="none" stroke="#6B7280" strokeWidth="1.5" />
    <rect x="5" y="11" width="14" height="4" rx="0.5" fill="none" stroke="#6B7280" strokeWidth="0.8" />
    <line x1="7" y1="13" x2="13" y2="13" stroke="#6B7280" strokeWidth="0.5" />
    <line x1="7" y1="14" x2="11" y2="14" stroke="#6B7280" strokeWidth="0.5" />
    <circle cx="16.5" cy="13" r="1" fill="none" stroke="#6B7280" strokeWidth="1" />
    <circle cx="16.5" cy="13" r="0.3" fill="#6B7280" />
    <path d="M7 6 L17 6 L18 9 L6 9 Z" fill="none" stroke="#6B7280" strokeWidth="1.2" />
  </svg>
);