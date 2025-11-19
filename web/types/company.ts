export interface Company {
  id: number;
  name: string;
  legal_name?: string;
  tax_id: string;
  business_type?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_person?: string;
  contact_position?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  annual_revenue?: number;
  employee_count?: number;
  status?: 'active' | 'inactive' | 'prospect';
  priority?: 'low' | 'medium' | 'high' | 'vip';
  credit_rating?: string;
  payment_terms?: string;
  notes?: string;
  internal_notes?: string;
  tags?: string;
  created_at: string;
  updated_at?: string;
}

export interface CompanyCreate {
  name: string;
  legal_name?: string;
  tax_id: string;
  business_type?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_person?: string;
  contact_position?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  annual_revenue?: number;
  employee_count?: number;
  status?: 'active' | 'inactive' | 'prospect';
  priority?: 'low' | 'medium' | 'high' | 'vip';
  credit_rating?: string;
  payment_terms?: string;
  notes?: string;
  internal_notes?: string;
  tags?: string;
}

export interface ContractCompanyCreate {
  company_id: number;
  role?: 'client' | 'partner' | 'supplier' | 'guarantor';
  participation_percentage?: number;
  is_primary?: boolean;
  start_date?: string;
  end_date?: string;
  notes?: string;
}