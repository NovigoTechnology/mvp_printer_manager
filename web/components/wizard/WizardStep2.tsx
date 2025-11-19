import { Card } from '@/components/ui/Card'
import { LeaseContract } from '@/types/contract'

interface Printer {
  id: number
  ip_address: string
  location?: string
  model?: string
  brand?: string
  initial_counter_bw?: number
  initial_counter_color?: number
  initial_counter_total?: number
}

interface Step2Props {
  selectedContract: LeaseContract | null
  printers: Printer[]
  loading: boolean
}

export const WizardStep2: React.FC<Step2Props> = ({
  selectedContract,
  printers,
  loading
}) => {
  if (!selectedContract) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Primero debe seleccionar un contrato en el paso anterior</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">📋 Condiciones del Contrato</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium text-gray-900 mb-3">Información General</h5>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Nombre:</span> {selectedContract.contract_name}</p>
              <p><span className="font-medium">Contrato:</span> {selectedContract.contract_number}</p>
              <p><span className="font-medium">Proveedor:</span> {selectedContract.supplier}</p>
              <p><span className="font-medium">Tipo:</span> {
                selectedContract.contract_type === 'cost_per_copy' ? 'Por copia' :
                selectedContract.contract_type === 'monthly_fixed' ? 'Cuota fija mensual' :
                selectedContract.contract_type === 'annual_fixed' ? 'Cuota fija anual' : 'Costo fijo por cantidad'
              }</p>
              <p><span className="font-medium">Estado:</span> {selectedContract.status}</p>
            </div>
          </div>
          <div>
            <h5 className="font-medium text-gray-900 mb-3">Condiciones Financieras</h5>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Costo B/N por copia:</span> ${selectedContract.cost_bw_per_copy}</p>
              <p><span className="font-medium">Costo Color por copia:</span> ${selectedContract.cost_color_per_copy}</p>
              <p><span className="font-medium">Cuota fija mensual:</span> ${selectedContract.fixed_monthly_cost}</p>
              <p><span className="font-medium">Cuota fija anual:</span> ${selectedContract.fixed_annual_cost}</p>
              <p><span className="font-medium">Copias B/N incluidas:</span> {selectedContract.included_copies_bw}</p>
              <p><span className="font-medium">Copias Color incluidas:</span> {selectedContract.included_copies_color}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">🖨️ Equipos Asociados</h4>
        {loading ? (
          <div className="text-center py-4">
            <div className="text-gray-500">Cargando equipos...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printers.map(printer => (
              <div key={printer.id} className="p-4 border border-gray-200 rounded-lg">
                <h6 className="font-medium text-gray-900">{printer.brand} {printer.model}</h6>
                <p className="text-sm text-gray-600">IP: {printer.ip_address}</p>
                <p className="text-sm text-gray-600">Ubicación: {printer.location}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}