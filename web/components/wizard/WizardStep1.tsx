import { Card } from '@/components/ui/Card'
import { LeaseContract } from '@/types/contract'

interface BillingPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  cut_off_date: string
  status: string
  description?: string
}

interface Step1Props {
  periods: BillingPeriod[]
  contracts: LeaseContract[]
  selectedPeriod: BillingPeriod | null
  selectedContract: LeaseContract | null
  clientFilter: string
  onPeriodSelect: (period: BillingPeriod) => void
  onContractSelect: (contract: LeaseContract) => void
  onClientFilterChange: (filter: string) => void
}

export const WizardStep1: React.FC<Step1Props> = ({
  periods,
  contracts,
  selectedPeriod,
  selectedContract,
  clientFilter,
  onPeriodSelect,
  onContractSelect,
  onClientFilterChange
}) => {
  const getFilteredContracts = () => {
    return contracts.filter(contract => {
      const matchesClient = !clientFilter || 
        contract.contract_name.toLowerCase().includes(clientFilter.toLowerCase()) ||
        contract.supplier.toLowerCase().includes(clientFilter.toLowerCase())
      
      return matchesClient
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">📅 Seleccionar Período de Facturación</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {periods.map(period => (
            <div
              key={period.id}
              onClick={() => onPeriodSelect(period)}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedPeriod?.id === period.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <h5 className="font-medium text-gray-900">{period.name}</h5>
              <p className="text-sm text-gray-600">
                {period.start_date} - {period.end_date}
              </p>
              <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mt-2">
                Cerrado
              </span>
            </div>
          ))}
        </div>
      </Card>

      {selectedPeriod && (
        <Card className="p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">🏢 Seleccionar Contrato</h4>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filtrar por cliente o proveedor..."
              value={clientFilter}
              onChange={(e) => onClientFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              title="Filtrar contratos"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getFilteredContracts().map(contract => (
              <div
                key={contract.id}
                onClick={() => onContractSelect(contract)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedContract?.id === contract.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-gray-900">{contract.contract_name}</h5>
                    <p className="text-sm text-gray-600">Contrato: {contract.contract_number}</p>
                    <p className="text-xs text-gray-500">Proveedor: {contract.supplier}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      contract.status === 'active' ? 'bg-green-100 text-green-800' :
                      contract.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {contract.status === 'active' ? 'Activo' : 
                       contract.status === 'suspended' ? 'Suspendido' : 
                       contract.status === 'expired' ? 'Expirado' : 'Cancelado'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {contract.contract_type === 'cost_per_copy' ? 'Por copia' :
                       contract.contract_type === 'monthly_fixed' ? 'Cuota fija mensual' :
                       contract.contract_type === 'annual_fixed' ? 'Cuota fija anual' : 'Costo fijo por cantidad'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}