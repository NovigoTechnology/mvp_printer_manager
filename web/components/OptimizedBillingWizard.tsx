'use client'

import React, { useEffect, useState } from 'react'
import { LeaseContract } from '@/types/contract'
import { WizardStep1 } from './wizard/WizardStep1'
import { WizardStep2 } from './wizard/WizardStep2'

import { API_BASE } from '@/lib/config'

interface BillingPeriod {
  id: number
  name: string
  start_date: string
  end_date: string
  cut_off_date: string
  status: string
  description?: string
}

interface Printer {
  id: number
  ip_address: string
  ip?: string
  location?: string
  model?: string
  brand?: string
  initial_counter_bw?: number
  initial_counter_color?: number
  initial_counter_total?: number
}

const normalizePrinters = (rawData: any): Printer[] => {
  const items = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.printers)
      ? rawData.printers
      : Array.isArray(rawData?.items)
        ? rawData.items
        : []

  return items
    .map((item: any) => {
      const rawPrinter = item?.printer ?? item
      if (!rawPrinter) return null

      const resolvedId = rawPrinter.id ?? item.printer_id ?? item.id
      if (!resolvedId) return null

      return {
        id: resolvedId,
        ip_address: rawPrinter.ip_address ?? rawPrinter.ip ?? '',
        ip: rawPrinter.ip,
        location: rawPrinter.location,
        model: rawPrinter.model,
        brand: rawPrinter.brand,
        initial_counter_bw: rawPrinter.initial_counter_bw,
        initial_counter_color: rawPrinter.initial_counter_color,
        initial_counter_total: rawPrinter.initial_counter_total,
      } as Printer
    })
    .filter((printer: Printer | null): printer is Printer => Boolean(printer))
}

interface WizardStep {
  number: number
  title: string
  description: string
  completed: boolean
}

interface VisualDraft {
  number: string
  generatedAt: string
  total: number
  status: string
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const getContractTypeLabel = (contractType?: string) => {
  if (contractType === 'cost_per_copy') return 'Por copia'
  if (contractType === 'monthly_fixed') return 'Cuota fija mensual'
  if (contractType === 'annual_fixed') return 'Cuota fija anual'
  return 'Costo fijo por cantidad'
}

const formatCurrency = (value: number, currency = 'ARS', maximumFractionDigits = 2) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(value)
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const OptimizedBillingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [periods, setPeriods] = useState<BillingPeriod[]>([])
  const [contracts, setContracts] = useState<LeaseContract[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null)
  const [selectedContract, setSelectedContract] = useState<LeaseContract | null>(null)
  const [printers, setPrinters] = useState<Printer[]>([])
  const [visualDraft, setVisualDraft] = useState<VisualDraft | null>(null)

  const [clientFilter, setClientFilter] = useState('')

  const steps: WizardStep[] = [
    { number: 1, title: 'Período y Cliente', description: 'Seleccionar período de facturación y cliente', completed: false },
    { number: 2, title: 'Tipo de Contrato', description: 'Revisar condiciones y reglas de facturación', completed: false },
    { number: 3, title: 'Validación de Contadores', description: 'Verificar lecturas y calcular copias', completed: false },
    { number: 4, title: 'Cálculo de Montos', description: 'Aplicar tarifas, descuentos e impuestos', completed: false },
    { number: 5, title: 'Vista Previa', description: 'Validar datos antes de generar factura', completed: false },
    { number: 6, title: 'Generar Borrador', description: 'Crear factura en estado borrador', completed: false },
    { number: 7, title: 'Envío Final', description: 'Enviar y registrar factura', completed: false },
  ]

  useEffect(() => {
    fetchPeriods()
    fetchContracts()
  }, [])

  useEffect(() => {
    setVisualDraft(null)
  }, [selectedPeriod, selectedContract])

  const fetchPeriods = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/billing/periods`)
      if (response.ok) {
        const data = await response.json()
        const closedPeriods = data.filter((p: BillingPeriod) => p.status === 'closed')
        // Fallback: si no hay periodos cerrados, permitir seleccionar abiertos para no bloquear el wizard.
        const availablePeriods = closedPeriods.length > 0
          ? closedPeriods
          : data.filter((p: BillingPeriod) => p.status === 'open')
        setPeriods(availablePeriods)
      }
    } catch (error) {
      console.error('Error fetching periods:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts`)
      if (response.ok) {
        const data = await response.json()
        setContracts(data)
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    }
  }

  const fetchContractPrinters = async (contractId: number) => {
    try {
      const response = await fetch(`${API_BASE}/contracts/${contractId}/printers`)
      if (response.ok) {
        const data = await response.json()
        setPrinters(normalizePrinters(data))
      }
    } catch (error) {
      console.error('Error fetching contract printers:', error)
    }
  }

  const handleContractSelect = async (contract: LeaseContract) => {
    setSelectedContract(contract)

    // Cargar inmediatamente desde el payload del contrato (si viene incluido)
    // para no dejar la UI vacía mientras responde el endpoint dedicado.
    setPrinters(normalizePrinters(contract.contract_printers ?? []))

    setLoading(true)

    if (selectedPeriod) {
      await fetchContractPrinters(contract.id)
    }

    setLoading(false)
  }

  const canProceedFromStep1 = () => Boolean(selectedPeriod && selectedContract)

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGenerateVisualDraft = () => {
    if (!selectedContract || !selectedPeriod) return

    const timestamp = new Date()
    setVisualDraft({
      number: `DRAFT-${selectedPeriod.id}-${selectedContract.id}-${timestamp.getTime().toString().slice(-5)}`,
      generatedAt: timestamp.toISOString(),
      total: simulatedTotal,
      status: 'Borrador visual generado',
    })
  }

  const handleDownloadVisualDraft = () => {
    if (!visualDraft || !selectedContract || !selectedPeriod) return

    const generatedAt = new Date(visualDraft.generatedAt).toLocaleString('es-AR')
    const printerRows = printers.map((printer) => `
      <tr>
        <td>${escapeHtml(`${printer.brand || 'N/A'} ${printer.model || 'Sin modelo'}`)}</td>
        <td>${escapeHtml(printer.ip_address || '-')}</td>
        <td>${escapeHtml(printer.location || 'Sin ubicación')}</td>
      </tr>
    `).join('')

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(visualDraft.number)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
    h1 { margin-bottom: 4px; }
    .muted { color: #6b7280; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f9fafb; font-size: 12px; text-transform: uppercase; color: #4b5563; }
    .total { font-size: 22px; font-weight: 700; color: #047857; }
  </style>
</head>
<body>
  <h1>Borrador de factura</h1>
  <p class="muted">Archivo generado localmente desde el wizard visual. No implica guardado ni emisión fiscal.</p>

  <div class="summary">
    <div class="box"><strong>Número</strong><br />${escapeHtml(visualDraft.number)}</div>
    <div class="box"><strong>Generado</strong><br />${escapeHtml(generatedAt)}</div>
    <div class="box"><strong>Contrato</strong><br />${escapeHtml(selectedContract.contract_number)}</div>
    <div class="box"><strong>Cliente / Proveedor</strong><br />${escapeHtml(selectedContract.supplier)}</div>
    <div class="box"><strong>Período</strong><br />${escapeHtml(selectedPeriod.name)}</div>
    <div class="box"><strong>Total estimado</strong><br /><span class="total">${escapeHtml(formatCurrency(visualDraft.total, selectedCurrency))}</span></div>
  </div>

  <h2>Resumen económico</h2>
  <table>
    <tbody>
      <tr><td>Copias B/N simuladas</td><td>${simulatedBwCopies.toLocaleString('es-AR')}</td></tr>
      <tr><td>Copias color simuladas</td><td>${simulatedColorCopies.toLocaleString('es-AR')}</td></tr>
      <tr><td>Cargo B/N</td><td>${escapeHtml(formatCurrency(simulatedBwAmount, selectedCurrency))}</td></tr>
      <tr><td>Cargo color</td><td>${escapeHtml(formatCurrency(simulatedColorAmount, selectedCurrency))}</td></tr>
      <tr><td>Subtotal</td><td>${escapeHtml(formatCurrency(simulatedSubtotal, selectedCurrency))}</td></tr>
      <tr><td>IVA (19%)</td><td>${escapeHtml(formatCurrency(simulatedTax, selectedCurrency))}</td></tr>
      <tr><td><strong>Total</strong></td><td><strong>${escapeHtml(formatCurrency(simulatedTotal, selectedCurrency))}</strong></td></tr>
    </tbody>
  </table>

  <h2>Equipos incluidos</h2>
  <table>
    <thead><tr><th>Equipo</th><th>IP</th><th>Ubicación</th></tr></thead>
    <tbody>${printerRows || '<tr><td colspan="3">No hay equipos asociados</td></tr>'}</tbody>
  </table>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${visualDraft.number}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const simulatedBwCopies = printers.length * 850
  const simulatedColorCopies = Math.round(printers.length * 0.2 * 850)
  const simulatedTotalCopies = simulatedBwCopies + simulatedColorCopies

  const bwRate = Number(selectedContract?.cost_bw_per_copy || 0)
  const colorRate = Number(selectedContract?.cost_color_per_copy || 0)
  const fixedMonthlyCost = Number(selectedContract?.fixed_monthly_cost || 0)
  const selectedCurrency = selectedContract?.currency || 'ARS'
  const simulatedBwAmount = roundMoney(simulatedBwCopies * bwRate)
  const simulatedColorAmount = roundMoney(simulatedColorCopies * colorRate)
  const simulatedSubtotal = roundMoney(fixedMonthlyCost + simulatedBwAmount + simulatedColorAmount)
  const simulatedTax = roundMoney(simulatedSubtotal * 0.19)
  const simulatedTotal = roundMoney(simulatedSubtotal + simulatedTax)

  const renderMissingContext = () => (
    <div className="bg-white p-8 rounded-lg shadow text-center">
      <h4 className="text-lg font-semibold text-gray-900 mb-2">Antes de continuar</h4>
      <p className="text-gray-600">
        Selecciona un período y un contrato en el paso 1 para visualizar este paso.
      </p>
    </div>
  )

  const renderStep3 = () => {
    if (!selectedContract || !selectedPeriod) return renderMissingContext()

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Validación de Contadores</h4>
          <p className="text-sm text-gray-600 mb-6">
            Vista visual de lecturas para el período {selectedPeriod.name}. Esta pantalla no guarda cambios.
          </p>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando datos de equipos...</div>
          ) : printers.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              No hay equipos asociados al contrato seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Equipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">IP</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">B/N período</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Color período</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total período</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {printers.map((printer, index) => {
                    const rowBw = 700 + index * 35
                    const rowColor = Math.round(rowBw * 0.18)
                    const rowTotal = rowBw + rowColor
                    return (
                      <tr key={printer.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {printer.brand || 'N/A'} {printer.model || 'Sin modelo'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{printer.ip_address}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-800">{rowBw.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-800">{rowColor.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{rowTotal.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            Validado
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-700 uppercase font-semibold">Copias B/N</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{simulatedBwCopies.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs text-indigo-700 uppercase font-semibold">Copias Color</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{simulatedColorCopies.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs text-green-700 uppercase font-semibold">Total Copias</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{simulatedTotalCopies.toLocaleString('es-CL')}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderStep4 = () => {
    if (!selectedContract || !selectedPeriod) return renderMissingContext()

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Cálculo de Montos</h4>
          <p className="text-sm text-gray-600 mb-6">
            Simulación visual de cálculo para contrato {selectedContract.contract_number}.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Tarifas Aplicadas</h5>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span>Tipo de contrato:</span><span>{getContractTypeLabel(selectedContract.contract_type)}</span></p>
                <p className="flex justify-between"><span>Valor copia B/N:</span><span>{formatCurrency(bwRate, selectedCurrency, 4)}</span></p>
                <p className="flex justify-between"><span>Valor copia color:</span><span>{formatCurrency(colorRate, selectedCurrency, 4)}</span></p>
                <p className="flex justify-between"><span>Cargo fijo mensual:</span><span>{formatCurrency(fixedMonthlyCost, selectedCurrency)}</span></p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Resumen Económico</h5>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span>Cargo por B/N:</span><span>{formatCurrency(simulatedBwAmount, selectedCurrency)}</span></p>
                <p className="flex justify-between"><span>Cargo por color:</span><span>{formatCurrency(simulatedColorAmount, selectedCurrency)}</span></p>
                <p className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(simulatedSubtotal, selectedCurrency)}</span></p>
                <p className="flex justify-between"><span>IVA (19%):</span><span>{formatCurrency(simulatedTax, selectedCurrency)}</span></p>
                <p className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                  <span>Total estimado:</span>
                  <span className="text-green-700">{formatCurrency(simulatedTotal, selectedCurrency)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderStep5 = () => {
    if (!selectedContract || !selectedPeriod) return renderMissingContext()

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Vista Previa de Factura</h4>

          <div className="border border-gray-200 rounded-lg p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Cliente</p>
                <p className="font-medium text-gray-900">{selectedContract.supplier}</p>
              </div>
              <div>
                <p className="text-gray-500">Contrato</p>
                <p className="font-medium text-gray-900">{selectedContract.contract_number}</p>
              </div>
              <div>
                <p className="text-gray-500">Período</p>
                <p className="font-medium text-gray-900">{selectedPeriod.name}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs uppercase text-gray-500 font-semibold">Consumo</p>
                <p className="mt-2 text-sm text-gray-700">B/N: {simulatedBwCopies.toLocaleString('es-CL')} copias</p>
                <p className="text-sm text-gray-700">Color: {simulatedColorCopies.toLocaleString('es-CL')} copias</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs uppercase text-green-700 font-semibold">Total a facturar</p>
                <p className="mt-2 text-2xl font-bold text-green-800">{formatCurrency(simulatedTotal, selectedCurrency)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            Esta es una vista previa visual. El envío y la persistencia aún no están habilitados.
          </div>
        </div>
      </div>
    )
  }

  const renderStep6 = () => {
    if (!selectedContract || !selectedPeriod) return renderMissingContext()

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Generar Borrador</h4>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              Simulación de creación de borrador para {selectedContract.contract_number} ({selectedPeriod.name}).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Opciones de generación</h5>
              <div className="space-y-2 text-sm text-gray-700">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Generar PDF visual</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Incluir resumen por equipo</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Preparar envío por email</label>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Datos del borrador</h5>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span>Número:</span><span>{visualDraft?.number || `DRAFT-${selectedPeriod.id}-${selectedContract.id}`}</span></p>
                <p className="flex justify-between"><span>Fecha emisión:</span><span>{visualDraft ? new Date(visualDraft.generatedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}</span></p>
                <p className="flex justify-between font-bold"><span>Total estimado:</span><span>{formatCurrency(simulatedTotal, selectedCurrency)}</span></p>
                <p className="flex justify-between"><span>Estado:</span><span className={visualDraft ? 'text-green-700 font-medium' : 'text-gray-500'}>{visualDraft?.status || 'Pendiente de generación'}</span></p>
              </div>
            </div>
          </div>

          {visualDraft && (
            <div className="mt-6 border border-green-200 bg-green-50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h5 className="font-medium text-green-900">Borrador generado correctamente</h5>
                  <p className="mt-1 text-sm text-green-800">
                    Se preparó el borrador visual {visualDraft.number} por {formatCurrency(visualDraft.total, selectedCurrency)}.
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    Generado el {new Date(visualDraft.generatedAt).toLocaleString('es-AR')}. No se guardó información en el backend.
                  </p>
                </div>
                <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                  Listo
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleGenerateVisualDraft}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              {visualDraft ? 'Regenerar borrador (visual)' : 'Generar borrador (visual)'}
            </button>
          </div>

          {visualDraft && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleDownloadVisualDraft}
                className="px-6 py-3 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium"
              >
                Descargar borrador
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderStep7 = () => {
    if (!selectedContract || !selectedPeriod) return renderMissingContext()

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Envío Final</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Destinatarios</h5>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">Cliente:</span> {selectedContract.supplier}</p>
                <p><span className="font-medium">Contacto:</span> {selectedContract.contact_person || 'No definido'}</p>
                <p><span className="font-medium">Email:</span> {selectedContract.contact_email || 'No definido'}</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Confirmación visual</h5>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" /> Confirmo revisión de datos
              </label>
              <p className="text-xs text-gray-500 mt-3">
                Esta etapa es solo visual y no enviará correos ni actualizará estado.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            Modo visual activo: no se ejecutan acciones en backend.
          </div>

          <div className="mt-6 flex justify-center gap-4">
            <button type="button" className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
              Vista previa final
            </button>
            <button type="button" className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Enviar factura (visual)
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🧙‍♂️ Wizard de Facturación</h1>
        <p className="text-gray-600">Generación guiada de facturas paso a paso</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.number
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-500'
              }`}>
                {step.completed ? '✓' : step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-medium text-gray-900">{steps[currentStep - 1].title}</h3>
          <p className="text-gray-600">{steps[currentStep - 1].description}</p>
        </div>
      </div>

      <div className="min-h-96">
        {currentStep === 1 && (
          <WizardStep1
            periods={periods}
            contracts={contracts}
            selectedPeriod={selectedPeriod}
            selectedContract={selectedContract}
            clientFilter={clientFilter}
            onPeriodSelect={setSelectedPeriod}
            onContractSelect={handleContractSelect}
            onClientFilterChange={setClientFilter}
          />
        )}
        {currentStep === 2 && (
          <WizardStep2
            selectedContract={selectedContract}
            printers={printers}
            loading={loading}
          />
        )}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
        {currentStep === 7 && renderStep7()}
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium transition-colors"
        >
          ← Anterior
        </button>

        <button
          onClick={handleNextStep}
          disabled={currentStep === 1 && !canProceedFromStep1()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:text-blue-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

export default OptimizedBillingWizard
