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

const BrandShowcase: React.FC = () => {
  const brands = [
    { name: 'HP', component: HPIcon, description: 'Círculo azul con "hp"' },
    { name: 'Brother', component: BrotherIcon, description: 'Texto "brother" en azul' },
    { name: 'Samsung', component: SamsungIcon, description: 'Óvalo azul con "SAMSUNG"' },
    { name: 'Canon', component: CanonIcon, description: 'Texto "Canon" en rojo' },
    { name: 'Panasonic', component: PanasonicIcon, description: 'Logo con subtítulo' },
    { name: 'Sharp', component: SharpIcon, description: 'Texto "SHARP" en rojo' },
    { name: 'Lexmark', component: LexmarkIcon, description: 'Triángulo verde + "Lexmark"' },
    { name: 'Xerox', component: XeroxIcon, description: 'Texto "xerox" con símbolo' },
    { name: 'Toshiba', component: ToshibaIcon, description: 'Texto "TOSHIBA" en rojo' },
    { name: 'Printronix', component: PrintronixIcon, description: 'Texto "PRINTRONIX" en azul' },
    { name: 'Kyocera', component: KyoceraIcon, description: 'Logo con "KYOCERA mita"' },
    { name: 'Troy', component: TroyIcon, description: 'Logo "TROY" con líneas' },
    { name: 'Ricoh', component: RicohIcon, description: 'Logo "RICOH IBM"' },
    { name: 'OKI', component: OKIIcon, description: 'Logo "OKI PRINTING SOLUTIONS"' },
    { name: 'Epson', component: EpsonIcon, description: 'Texto "EPSON" en azul' },
    { name: 'Generic', component: GenericPrinterIcon, description: 'Icono genérico' },
  ];

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Logos de Marcas de Impresoras Disponibles
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {brands.map((brand) => (
          <div key={brand.name} className="flex flex-col items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
            <div className="mb-3">
              <brand.component size={48} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{brand.name}</h3>
            <p className="text-sm text-gray-600 text-center">{brand.description}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Uso del Componente:</h3>
        <code className="text-sm bg-gray-100 p-2 rounded block">
          {`<PrinterIcon brand="hp" size={32} className="text-blue-500" />`}
        </code>
      </div>
    </div>
  );
};

export default BrandShowcase;