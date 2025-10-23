export interface LeaseContract {
  id: number;
  contract_number: string;
  contract_name: string;
  supplier: string;
  contract_type: 'cost_per_copy' | 'fixed_cost_per_quantity' | 'monthly_fixed' | 'annual_fixed';
  cost_bw_per_copy: number;
  cost_color_per_copy: number;
  fixed_monthly_cost: number;
  fixed_annual_cost: number;
  included_copies_bw: number;
  included_copies_color: number;
  total_printers: number;
  printers_bw_only: number;
  printers_color: number;
  multifunction_devices: number;
  start_date: string;
  end_date: string;
  renewal_date?: string;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  auto_renewal: boolean;
  renewal_notice_days: number;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  department?: string;
  cost_center?: string;
  budget_code?: string;
  terms_and_conditions?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  contract_printers: ContractPrinter[];
}

export interface ContractPrinter {
  id: number;
  printer_id: number;
  device_type: 'printer_bw' | 'printer_color' | 'multifunction';
  monthly_included_copies_bw: number;
  monthly_included_copies_color: number;
  overage_cost_bw: number;
  overage_cost_color: number;
  installation_date?: string;
  removal_date?: string;
  is_active: boolean;
  printer: {
    id: number;
    brand: string;
    model: string;
    asset_tag: string;
    location?: string;
    is_color: boolean;
  };
}

export interface ContractStats {
  total_contracts: number;
  status_distribution: Array<{
    status: string;
    count: number;
  }>;
  type_distribution: Array<{
    type: string;
    count: number;
  }>;
  contracts_expiring_soon: number;
  total_equipment: number;
}