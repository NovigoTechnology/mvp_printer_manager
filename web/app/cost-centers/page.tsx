'use client'

import { useEffect, useMemo, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

type LookupItem = { id: number; code?: string; name: string }
type CompanyItem = { id: number; name: string; legal_name?: string; tax_id?: string }

type OrganizationalUnit = {
  id: number
  company_id: number
  branch_id: number | null
  department_id: number | null
  area_id: number | null
  scope_level: 'company' | 'branch' | 'department' | 'area'
  is_active: boolean
  company_name: string
  branch_name: string | null
  branch_code?: string
  department_name: string | null
  department_code?: string
  area_name: string | null
  area_code?: string
}

type CostCenter = {
  id: number
  organizational_unit_id: number
  code: string
  name?: string
  description?: string
  status: string
  parent_cost_center_id?: number | null
  parent_cost_center_code?: string | null
  scope_level?: 'company' | 'branch' | 'department' | 'area'
  organizational_unit: OrganizationalUnit
}

export default function CostCentersPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [branches, setBranches] = useState<LookupItem[]>([])
  const [departments, setDepartments] = useState<LookupItem[]>([])
  const [areas, setAreas] = useState<LookupItem[]>([])
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table')
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<number, boolean>>({})

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'company' | 'structure' | 'details'>('company')

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: '', legal_name: '', tax_id: '' })
  const [branchForm, setBranchForm] = useState({ code: '', name: '' })
  const [departmentForm, setDepartmentForm] = useState({ code: '', name: '' })
  const [areaForm, setAreaForm] = useState({ code: '', name: '' })
  const [orgUnitForm, setOrgUnitForm] = useState({
    company_id: 0,
    branch_id: 0,
    department_id: 0,
    area_id: 0,
    scope_level: 'area' as 'company' | 'branch' | 'department' | 'area',
  })
  const [ccForm, setCcForm] = useState({ organizational_unit_id: 0, name: '', description: '' })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [lookupsRes, ouRes, ccRes] = await Promise.all([
        fetch(`${API_BASE}/cost-centers/lookups`),
        fetch(`${API_BASE}/cost-centers/organizational-units`),
        fetch(`${API_BASE}/cost-centers/`),
      ])

      if (!lookupsRes.ok || !ouRes.ok || !ccRes.ok) throw new Error('Error cargando datos')

      const lookupsData = await lookupsRes.json()
      setCompanies(lookupsData.companies || [])
      setBranches(lookupsData.branches || [])
      setDepartments(lookupsData.departments || [])
      setAreas(lookupsData.areas || [])
      setOrgUnits(await ouRes.json())
      setCostCenters(await ccRes.json())
    } catch (err: any) {
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const requiresBranch = orgUnitForm.scope_level !== 'company'
  const requiresDepartment = orgUnitForm.scope_level === 'department' || orgUnitForm.scope_level === 'area'
  const requiresArea = orgUnitForm.scope_level === 'area'

  const buildOrgUnitPayload = () => {
    const branchId = requiresBranch ? orgUnitForm.branch_id || null : null
    const departmentId = requiresDepartment ? orgUnitForm.department_id || null : null
    const areaId = requiresArea ? orgUnitForm.area_id || null : null

    return {
      company_id: orgUnitForm.company_id,
      branch_id: branchId,
      department_id: departmentId,
      area_id: areaId,
      is_active: true,
    }
  }

  const handleCreateCompany = async () => {
    if (!companyForm.name.trim() || !companyForm.tax_id.trim()) {
      alert('Nombre y Código son obligatorios')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyForm.name,
          legal_name: companyForm.legal_name || companyForm.name,
          tax_id: companyForm.tax_id,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear empresa')
      setCompanyForm({ name: '', legal_name: '', tax_id: '' })
      await fetchAll()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateEntity = async (entity: 'branches' | 'departments' | 'areas', form: { code: string; name: string }) => {
    if (!form.code.trim() || !form.name.trim()) {
      alert('Código y Nombre son obligatorios')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/cost-centers/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`No se pudo crear ${entity}`)
      if (entity === 'branches') setBranchForm({ code: '', name: '' })
      if (entity === 'departments') setDepartmentForm({ code: '', name: '' })
      if (entity === 'areas') setAreaForm({ code: '', name: '' })
      await fetchAll()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateOrgUnit = async (): Promise<number | null> => {
    if (!orgUnitForm.company_id) {
      alert('Debe seleccionar una empresa')
      return null
    }
    if (requiresBranch && !orgUnitForm.branch_id) {
      alert('Debe seleccionar una sucursal')
      return null
    }
    if (requiresDepartment && !orgUnitForm.department_id) {
      alert('Debe seleccionar un departamento')
      return null
    }
    if (requiresArea && !orgUnitForm.area_id) {
      alert('Debe seleccionar un area')
      return null
    }

    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/cost-centers/organizational-units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrgUnitPayload()),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.detail || 'No se pudo crear unidad organizativa')
      }
      const data = await res.json()
      setCcForm(prev => ({ ...prev, organizational_unit_id: data.id }))
      await fetchAll()
      return data.id
    } catch (err: any) {
      alert(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const handleCreateCostCenter = async () => {
    if (!ccForm.organizational_unit_id) {
      alert('Debe seleccionar una unidad organizativa')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/cost-centers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ccForm, created_by: 'ui-user' }),
      })
      if (!res.ok) throw new Error('No se pudo crear centro de costo')
      setCcForm({ organizational_unit_id: 0, name: '', description: '' })
      setShowModal(false)
      setActiveTab('company')
      setCompanyForm({ name: '', legal_name: '', tax_id: '' })
      setBranchForm({ code: '', name: '' })
      setDepartmentForm({ code: '', name: '' })
      setAreaForm({ code: '', name: '' })
      setOrgUnitForm({ company_id: 0, branch_id: 0, department_id: 0, area_id: 0, scope_level: 'area' })
      await fetchAll()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteCostCenter = async (id: number) => {
    if (!confirm('Desea eliminar este centro de costo?')) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/cost-centers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar')
      await fetchAll()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filteredCostCenters = useMemo(() => {
    if (!search.trim()) return costCenters
    const query = search.toLowerCase()
    return costCenters.filter(cc =>
      cc.code.toLowerCase().includes(query) ||
      (cc.name || '').toLowerCase().includes(query) ||
      (cc.organizational_unit?.company_name || '').toLowerCase().includes(query)
    )
  }, [costCenters, search])

  const treeData = useMemo(() => {
    const allById = new Map<number, CostCenter>(costCenters.map(cc => [cc.id, cc]))
    const query = search.trim().toLowerCase()

    const visibleIds = new Set<number>()
    if (!query) {
      costCenters.forEach(cc => visibleIds.add(cc.id))
    } else {
      filteredCostCenters.forEach(cc => {
        visibleIds.add(cc.id)
        let parentId = cc.parent_cost_center_id ?? null
        while (parentId && allById.has(parentId)) {
          visibleIds.add(parentId)
          parentId = allById.get(parentId)?.parent_cost_center_id ?? null
        }
      })
    }

    const items = costCenters.filter(cc => visibleIds.has(cc.id))
    const childrenMap: Record<number, CostCenter[]> = {}
    const roots: CostCenter[] = []

    items.forEach(cc => {
      const parentId = cc.parent_cost_center_id
      if (parentId && visibleIds.has(parentId)) {
        if (!childrenMap[parentId]) childrenMap[parentId] = []
        childrenMap[parentId].push(cc)
      } else {
        roots.push(cc)
      }
    })

    const sortByCode = (a: CostCenter, b: CostCenter) => a.code.localeCompare(b.code)
    roots.sort(sortByCode)
    Object.keys(childrenMap).forEach(key => {
      childrenMap[Number(key)].sort(sortByCode)
    })

    return { roots, childrenMap }
  }, [costCenters, filteredCostCenters, search])

  const toggleNode = (id: number) => {
    setExpandedNodeIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600'></div>
          <p className='mt-4 text-gray-600'>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>
      <div className='px-4 py-6'>
        <div className='mb-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Centros de Costos</h1>
              <p className='mt-2 text-sm text-gray-600'>Gestiona la estructura organizacional y centros de costo</p>
            </div>
            <button
              onClick={() => {
                setShowModal(true)
                setActiveTab('company')
              }}
              className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium'
            >
              + Crear Centro de Costo
            </button>
          </div>
          {error && <p className='mt-2 text-red-600 text-sm'>{error}</p>}
        </div>

        <div className='bg-white rounded-lg border'>
          <div className='px-6 py-4 border-b flex items-center justify-between'>
            <h2 className='font-semibold text-lg'>Centros Creados ({filteredCostCenters.length})</h2>
            <div className='flex items-center gap-3'>
              <div className='inline-flex rounded border overflow-hidden'>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Tabla
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-2 text-sm ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Arbol
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Buscar por código, nombre...'
                className='border rounded px-3 py-2 w-80 text-sm'
              />
            </div>
          </div>

          {viewMode === 'table' && (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-gray-50 border-b'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Código</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Nombre</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Nivel</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Padre</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Empresa</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Sucursal / Depto / Area</th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-700'>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCostCenters.map(cc => (
                    <tr key={cc.id} className='border-b hover:bg-gray-50'>
                      <td className='px-6 py-4 font-mono text-sm font-medium'>{cc.code}</td>
                      <td className='px-6 py-4'>
                        <div className='font-medium'>{cc.name || '-'}</div>
                        <div className='text-xs text-gray-500'>{cc.description || ''}</div>
                      </td>
                      <td className='px-6 py-4 text-sm capitalize'>{cc.scope_level || '-'}</td>
                      <td className='px-6 py-4 text-sm font-mono'>{cc.parent_cost_center_code || '-'}</td>
                      <td className='px-6 py-4 text-sm'>{cc.organizational_unit?.company_name}</td>
                      <td className='px-6 py-4 text-sm'>
                        {cc.organizational_unit?.branch_code || '*'} / {cc.organizational_unit?.department_code || '*'} / {cc.organizational_unit?.area_code || '*'}
                      </td>
                      <td className='px-6 py-4'>
                        <button onClick={() => handleDeleteCostCenter(cc.id)} className='text-red-600 hover:text-red-800 text-sm font-medium'>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'tree' && (
            <div className='p-4 space-y-1'>
              {treeData.roots.map(root => {
                const renderNode = (node: CostCenter, depth: number): JSX.Element => {
                  const children = treeData.childrenMap[node.id] || []
                  const isExpanded = expandedNodeIds[node.id] ?? true
                  return (
                    <div key={node.id}>
                      <div
                        className='flex items-start justify-between rounded border px-3 py-2 hover:bg-gray-50'
                        style={{ marginLeft: `${depth * 18}px` }}
                      >
                        <div className='flex items-start gap-2 min-w-0'>
                          {children.length > 0 ? (
                            <button
                              onClick={() => toggleNode(node.id)}
                              className='mt-0.5 text-xs w-5 h-5 rounded border text-gray-700 hover:bg-gray-100'
                              title={isExpanded ? 'Colapsar' : 'Expandir'}
                            >
                              {isExpanded ? '-' : '+'}
                            </button>
                          ) : (
                            <span className='inline-block w-5 text-center text-gray-400'>•</span>
                          )}
                          <div className='min-w-0'>
                            <div className='font-mono text-sm font-semibold'>{node.code}</div>
                            <div className='text-sm font-medium truncate'>{node.name || 'Sin nombre'}</div>
                            <div className='text-xs text-gray-500'>
                              <span className='capitalize'>{node.scope_level || '-'}</span>
                              {' · '}
                              {node.organizational_unit?.company_name}
                              {' · '}
                              {node.organizational_unit?.branch_code || '*'} / {node.organizational_unit?.department_code || '*'} / {node.organizational_unit?.area_code || '*'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCostCenter(node.id)}
                          className='text-red-600 hover:text-red-800 text-sm font-medium ml-4'
                        >
                          Eliminar
                        </button>
                      </div>

                      {isExpanded && children.length > 0 && (
                        <div className='mt-1 space-y-1'>
                          {children.map(child => renderNode(child, depth + 1))}
                        </div>
                      )}
                    </div>
                  )
                }

                return renderNode(root, 0)
              })}
            </div>
          )}
          {filteredCostCenters.length === 0 && (
            <div className='p-6 text-center text-gray-500'>No hay centros de costo creados</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>Crear Centro de Costo</h2>
              <button onClick={() => setShowModal(false)} className='text-gray-400 hover:text-gray-600 text-2xl'>×</button>
            </div>

            <div className='flex border-b bg-gray-50'>
              {(['company', 'structure', 'details'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'company' && '1. Empresa'}
                  {tab === 'structure' && '2. Estructura'}
                  {tab === 'details' && '3. Centro de Costo'}
                </button>
              ))}
            </div>

            <div className='p-6 space-y-4'>
              {activeTab === 'company' && (
                <div className='space-y-5'>
                  <div>
                    <h3 className='font-semibold mb-4 text-base'>Paso 1: Seleccionar o Crear Empresa</h3>
                    <label className='block text-sm font-medium mb-2'>Empresa Existente</label>
                    <select
                      value={orgUnitForm.company_id}
                      onChange={(e) => setOrgUnitForm({ ...orgUnitForm, company_id: Number(e.target.value) })}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value={0}>Seleccionar empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className='border-t pt-5'>
                    <h4 className='font-medium text-sm mb-3'>O Crear Nueva Empresa</h4>
                    <div className='space-y-3'>
                      <div>
                        <label className='block text-xs font-medium mb-1'>Nombre de Empresa *</label>
                        <input
                          value={companyForm.name}
                          onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                          placeholder='Ej: Tech Solutions SA'
                          className='w-full border rounded px-3 py-2 text-sm'
                        />
                      </div>
                      <div>
                        <label className='block text-xs font-medium mb-1'>Nombre Público (Razón Social)</label>
                        <input
                          value={companyForm.legal_name}
                          onChange={(e) => setCompanyForm({ ...companyForm, legal_name: e.target.value })}
                          placeholder='Ej: Tech Solutions Sociedad Anónima'
                          className='w-full border rounded px-3 py-2 text-sm'
                        />
                      </div>
                      <div>
                        <label className='block text-xs font-medium mb-1'>Código (CUIT/RUT) *</label>
                        <input
                          value={companyForm.tax_id}
                          onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
                          placeholder='Ej: 30-12345678-9'
                          className='w-full border rounded px-3 py-2 text-sm'
                        />
                      </div>
                      <button
                        onClick={handleCreateCompany}
                        disabled={busy}
                        className='w-full bg-emerald-600 text-white rounded px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50 font-medium'
                      >
                        Crear Empresa
                      </button>
                    </div>
                  </div>

                  <div className='flex gap-2 justify-between pt-5 border-t'>
                    <button onClick={() => setShowModal(false)} className='px-4 py-2 border rounded hover:bg-gray-50'>Cancelar</button>
                    <button
                      onClick={() => {
                        if (!orgUnitForm.company_id) {
                          alert('Debe seleccionar o crear una empresa')
                          return
                        }
                        setActiveTab('structure')
                      }}
                      className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium'
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'structure' && (
                <div className='space-y-5'>
                  <h3 className='font-semibold text-base'>Paso 2: Crear o Seleccionar Estructura</h3>

                  <div>
                    <label className='block text-xs font-medium mb-2'>Nivel de Centro de Costo *</label>
                    <select
                      value={orgUnitForm.scope_level}
                      onChange={(e) => {
                        const nextScope = e.target.value as 'company' | 'branch' | 'department' | 'area'
                        setOrgUnitForm(prev => ({
                          ...prev,
                          scope_level: nextScope,
                          branch_id: nextScope === 'company' ? 0 : prev.branch_id,
                          department_id: nextScope === 'company' || nextScope === 'branch' ? 0 : prev.department_id,
                          area_id: nextScope === 'area' ? prev.area_id : 0,
                        }))
                      }}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value='company'>Empresa (incluye sucursales/deptos/areas)</option>
                      <option value='branch'>Sucursal (incluye deptos/areas)</option>
                      <option value='department'>Departamento (incluye areas)</option>
                      <option value='area'>Area (nivel final)</option>
                    </select>
                  </div>

                  {requiresBranch && (
                    <div>
                    <label className='block text-xs font-medium mb-2'>Sucursal *</label>
                    <div className='flex gap-2 mb-2'>
                      <input
                        value={branchForm.code}
                        onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                        placeholder='Código'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <input
                        value={branchForm.name}
                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                        placeholder='Nombre'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <button
                        onClick={() => handleCreateEntity('branches', branchForm)}
                        disabled={busy}
                        className='bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium'
                      >
                        +Crear
                      </button>
                    </div>
                    <select
                      value={orgUnitForm.branch_id}
                      onChange={(e) => setOrgUnitForm({ ...orgUnitForm, branch_id: Number(e.target.value) })}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value={0}>Seleccionar sucursal...</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                      ))}
                    </select>
                    </div>
                  )}

                  {requiresDepartment && (
                    <div>
                    <label className='block text-xs font-medium mb-2'>Departamento *</label>
                    <div className='flex gap-2 mb-2'>
                      <input
                        value={departmentForm.code}
                        onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                        placeholder='Código'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <input
                        value={departmentForm.name}
                        onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                        placeholder='Nombre'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <button
                        onClick={() => handleCreateEntity('departments', departmentForm)}
                        disabled={busy}
                        className='bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium'
                      >
                        +Crear
                      </button>
                    </div>
                    <select
                      value={orgUnitForm.department_id}
                      onChange={(e) => setOrgUnitForm({ ...orgUnitForm, department_id: Number(e.target.value) })}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value={0}>Seleccionar departamento...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                      ))}
                    </select>
                    </div>
                  )}

                  {requiresArea && (
                    <div>
                    <label className='block text-xs font-medium mb-2'>Area *</label>
                    <div className='flex gap-2 mb-2'>
                      <input
                        value={areaForm.code}
                        onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value })}
                        placeholder='Código'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <input
                        value={areaForm.name}
                        onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                        placeholder='Nombre'
                        className='flex-1 border rounded px-3 py-2 text-sm'
                      />
                      <button
                        onClick={() => handleCreateEntity('areas', areaForm)}
                        disabled={busy}
                        className='bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium'
                      >
                        +Crear
                      </button>
                    </div>
                    <select
                      value={orgUnitForm.area_id}
                      onChange={(e) => setOrgUnitForm({ ...orgUnitForm, area_id: Number(e.target.value) })}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value={0}>Seleccionar area...</option>
                      {areas.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                    </div>
                  )}

                  <div className='text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3'>
                    Al crear un centro de costo de nivel superior, los centros de menor nivel de la misma combinacion quedaran vinculados como hijos automaticamente.
                  </div>

                  <div className='flex gap-2 justify-between pt-5 border-t'>
                    <button onClick={() => setActiveTab('company')} className='px-4 py-2 border rounded hover:bg-gray-50'>← Anterior</button>
                    <button
                      onClick={async () => {
                        const createdOrgUnitId = await handleCreateOrgUnit()
                        if (!createdOrgUnitId) {
                          return
                        }
                        setCcForm(prev => ({ ...prev, organizational_unit_id: createdOrgUnitId }))
                        setActiveTab('details')
                      }}
                      disabled={busy}
                      className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium'
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className='space-y-5'>
                  <h3 className='font-semibold text-base'>Paso 3: Crear Centro de Costo</h3>

                  <div>
                    <label className='block text-xs font-medium mb-2'>Unidad Organizativa *</label>
                    <select
                      value={ccForm.organizational_unit_id}
                      onChange={(e) => setCcForm({ ...ccForm, organizational_unit_id: Number(e.target.value) })}
                      className='w-full border rounded px-3 py-2 text-sm'
                    >
                      <option value={0}>Seleccionar...</option>
                      {orgUnits.filter(ou => ou.is_active).map(ou => (
                        <option key={ou.id} value={ou.id}>
                          {ou.company_name} → {ou.branch_code || '*'} → {ou.department_code || '*'} → {ou.area_code || '*'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-xs font-medium mb-2'>Nombre (Opcional)</label>
                    <input
                      value={ccForm.name}
                      onChange={(e) => setCcForm({ ...ccForm, name: e.target.value })}
                      placeholder='Ej: Centro Principal'
                      className='w-full border rounded px-3 py-2 text-sm'
                    />
                  </div>

                  <div>
                    <label className='block text-xs font-medium mb-2'>Descripción (Opcional)</label>
                    <input
                      value={ccForm.description}
                      onChange={(e) => setCcForm({ ...ccForm, description: e.target.value })}
                      placeholder='Ej: Centro de operaciones principal'
                      className='w-full border rounded px-3 py-2 text-sm'
                    />
                  </div>

                  <div className='bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800'>
                    <strong>ℹ️ Código Auto-generado:</strong> EMP-[SUCURSAL]-[DEPTO]-[AREA]-[SECUENCIA]<br/>
                    Para niveles superiores se usan comodines automáticos (BRA/DEP/ARE).
                  </div>

                  <div className='flex gap-2 justify-between pt-5 border-t'>
                    <button onClick={() => setActiveTab('structure')} className='px-4 py-2 border rounded hover:bg-gray-50'>← Anterior</button>
                    <button
                      onClick={handleCreateCostCenter}
                      disabled={busy}
                      className='px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 font-medium'
                    >
                      Crear Centro de Costo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
