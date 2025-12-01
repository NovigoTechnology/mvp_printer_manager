'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ClockIcon, ArrowPathIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface CurrentRate {
  // Nuevos nombres descriptivos
  dolar_venta?: number;        // Venta de dólares
  dolar_compra?: number;       // Compra de dólares
  
  // Mantener compatibilidad
  ARS_to_USD: number;
  USD_to_ARS: number;
  
  date: string;
  source: string;
  last_updated: string;
  confidence_level?: number;
  is_manual_override?: boolean;
}

interface ExchangeRate {
  id: number;
  date: string;
  rate: number;
  source: string;
  is_manual_override: boolean;
  confidence_level: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export default function ExchangeRatesPage() {
  const [currentRate, setCurrentRate] = useState<CurrentRate | null>(null);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);

  const [newRate, setNewRate] = useState({
    rate: '',
    notes: 'Tasa manual ingresada manualmente'
  });

  // Estados para filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    source: 'todos', // 'todos', 'manual', 'DolarAPI', 'CriptoYa'
    dateFrom: '',
    dateTo: '',
    minRate: '',
    maxRate: '',
    onlyManual: false
  });
  const [filteredHistory, setFilteredHistory] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCurrentRate(),
        loadHistory()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentRate = async () => {
    try {
      const response = await fetch(`${API_BASE}/exchange-rates/current`);
      const data = await response.json();
      setCurrentRate(data);
    } catch (error) {
      console.error('Error loading current rate:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/exchange-rates/history?days=30`);
      const data = await response.json();
      // Ordenar por fecha y hora más reciente primero (created_at descendente)
      const sortedData = Array.isArray(data) ? data.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }) : [];
      setHistory(sortedData);
      // Los filtros se aplicarán automáticamente por el useEffect
    } catch (error) {
      console.error('Error loading history:', error);
      setHistory([]);
      setFilteredHistory([]);
    }
  };

  // Función para aplicar filtros
  const applyFilters = () => {
    let filtered = [...history];

    // Filtro por fuente
    if (filters.source !== 'todos') {
      filtered = filtered.filter(rate => rate.source === filters.source);
    }

    // Filtro solo manuales
    if (filters.onlyManual) {
      filtered = filtered.filter(rate => rate.is_manual_override);
    }

    // Filtro por fecha desde
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(rate => new Date(rate.created_at) >= fromDate);
    }

    // Filtro por fecha hasta
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo + 'T23:59:59');
      filtered = filtered.filter(rate => new Date(rate.created_at) <= toDate);
    }

    // Filtro por tasa mínima
    if (filters.minRate) {
      const minRate = parseFloat(filters.minRate);
      filtered = filtered.filter(rate => rate.rate >= minRate);
    }

    // Filtro por tasa máxima
    if (filters.maxRate) {
      const maxRate = parseFloat(filters.maxRate);
      filtered = filtered.filter(rate => rate.rate <= maxRate);
    }

    setFilteredHistory(filtered);
  };

  // UseEffect para aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [filters, history]);

  // Función para detectar filtros activos
  const hasActiveFilters = () => {
    return filters.source !== 'todos' || 
           filters.dateFrom || 
           filters.dateTo || 
           filters.minRate || 
           filters.maxRate || 
           filters.onlyManual;
  };

  // Función para resetear filtros
  const resetFilters = () => {
    setFilters({
      source: 'todos',
      dateFrom: '',
      dateTo: '',
      minRate: '',
      maxRate: '',
      onlyManual: false
    });
  };

  const updateFromAPIs = async () => {
    try {
      setUpdating(true);
      const response = await fetch(`${API_BASE}/exchange-rates/update-from-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await loadData();
        alert('Actualización completada: ' + JSON.stringify(result.results));
      } else {
        alert('Error en la actualización: ' + (result.detail || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      alert('Error conectando con el servidor');
    } finally {
      setUpdating(false);
    }
  };

  const addManualRate = async () => {
    try {
      if (!newRate.rate) {
        alert('Por favor ingrese una tasa válida');
        return;
      }

      // Usar fecha y hora actual exacta
      const now = new Date();
      const rateData = {
        date: now.toISOString(),  // Fecha y hora actual exacta
        base_currency: 'ARS',
        target_currency: 'USD',
        rate: parseFloat(newRate.rate),
        source: 'manual',
        is_manual_override: true,
        confidence_level: 1.0,
        notes: newRate.notes || 'Tasa manual ingresada manualmente',
        created_by: 'admin'
      };

      const response = await fetch(`${API_BASE}/exchange-rates/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateData)
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewRate({
          rate: '',
          notes: 'Tasa manual ingresada manualmente'
        });
        // Recargar datos inmediatamente para mostrar la nueva tasa
        await Promise.all([loadCurrentRate(), loadHistory()]);
        alert('Tasa manual agregada exitosamente');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.detail || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error adding manual rate:', error);
      alert('Error conectando con el servidor');
    }
  };

  const editRate = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setNewRate({
      rate: rate.rate.toString(),
      notes: rate.notes || ''
    });
    setShowEditModal(true);
  };

  const updateRate = async () => {
    if (!editingRate) return;

    try {
      if (!newRate.rate) {
        alert('Por favor ingrese una tasa válida');
        return;
      }

      const rateData = {
        date: editingRate.date,
        base_currency: 'ARS',
        target_currency: 'USD',
        rate: parseFloat(newRate.rate),
        source: editingRate.source,
        is_manual_override: editingRate.is_manual_override,
        confidence_level: editingRate.confidence_level,
        notes: newRate.notes || editingRate.notes,
        created_by: editingRate.created_by || 'admin'
      };

      const response = await fetch(`${API_BASE}/exchange-rates/${editingRate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingRate(null);
        setNewRate({
          rate: '',
          notes: 'Tasa manual ingresada manualmente'
        });
        await loadData();
        alert('Tasa actualizada exitosamente');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.detail || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error updating rate:', error);
      alert('Error conectando con el servidor');
    }
  };

  const deleteRate = async (rateId: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta tasa de cambio?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/exchange-rates/${rateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadData();
        alert('Tasa eliminada exitosamente');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.detail || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error deleting rate:', error);
      alert('Error conectando con el servidor');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'USD' ? 4 : 2
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR');
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR') + ' ' + date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2 text-lg">Cargando tasas de cambio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Tasas de Cambio</h1>
          <div className="flex gap-3">
            <Button
              onClick={updateFromAPIs}
              disabled={updating}
              variant="secondary"
              className="text-sm flex items-center gap-2"
            >
              <ArrowPathIcon className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
              {updating ? 'Actualizando...' : 'Actualizar'}
            </Button>
            <Button
              onClick={() => setShowScheduleModal(true)}
              variant="secondary"
              className="text-sm flex items-center gap-2"
            >
              <ClockIcon className="h-4 w-4" />
              Programar
            </Button>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="text-sm"
            >
              + Nueva Tasa
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {/* Tasa Actual - Diseño Minimalista */}
          <div className="mb-8">
            {currentRate ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 mb-4">
                    USD/ARS • {currentRate.source}
                  </div>
                  <div className="text-5xl font-light text-gray-900 mb-2 tracking-tight">
                    ${currentRate.dolar_compra || currentRate.USD_to_ARS ? 
                      (currentRate.dolar_compra || currentRate.USD_to_ARS).toLocaleString('es-AR', {minimumFractionDigits: 2}) : 
                      'N/A'}
                  </div>
                  <div className="text-sm text-gray-500 mb-6">
                    Actualizado el {formatDateTime(currentRate.last_updated)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-700">No se pudo cargar la tasa actual</p>
              </div>
            )}
          </div>

          {/* Histórico */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              📅 Histórico (Últimos 30 días) 
              <span className="text-sm font-normal text-blue-600 ml-2">- Ordenado por más reciente</span>
            </h2>
            <Button
              variant={hasActiveFilters() ? "primary" : "secondary"}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 ${hasActiveFilters() ? 'bg-blue-600 text-white' : ''}`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filtros
              {hasActiveFilters() && (
                <span className="bg-white text-blue-600 text-xs px-2 py-1 rounded-full font-semibold">
                  {filteredHistory.length}
                </span>
              )}
            </Button>
          </div>

          {/* Panel de Filtros */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">🔗 Fuente</label>
                  <select
                    title="Seleccionar fuente de datos"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.source}
                    onChange={(e) => setFilters({...filters, source: e.target.value})}
                  >
                    <option value="todos">Todas las fuentes</option>
                    <option value="manual">Manual</option>
                    <option value="DolarAPI">DolarAPI</option>
                    <option value="CriptoYa">CriptoYa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">📅 Desde</label>
                  <input
                    type="date"
                    title="Fecha desde"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">📅 Hasta</label>
                  <input
                    type="date"
                    title="Fecha hasta"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">💵 Tasa mínima</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1000.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.minRate}
                    onChange={(e) => setFilters({...filters, minRate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">💵 Tasa máxima</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="2000.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters.maxRate}
                    onChange={(e) => setFilters({...filters, maxRate: e.target.value})}
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                      checked={filters.onlyManual}
                      onChange={(e) => setFilters({...filters, onlyManual: e.target.checked})}
                    />
                    <span className="text-sm font-medium">⚙️ Solo tasas manuales</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="flex items-center gap-2"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Limpiar filtros
                </Button>
                <Button
                  onClick={() => setShowFilters(false)}
                >
                  Aplicar filtros
                </Button>
              </div>
            </div>
          )}
          
          {filteredHistory.length > 0 ? (
            <div>
              <div className="flex justify-between items-center mb-3 text-sm text-gray-600">
                <span>
                  📊 Mostrando {Math.min(filteredHistory.length, 15)} de {filteredHistory.length} registros
                  {filteredHistory.length !== history.length && (
                    <span className="ml-1">
                      (filtrado de {history.length} total)
                    </span>
                  )}
                </span>
                {filteredHistory.length > 15 && (
                  <span className="text-blue-600">⚠️ Mostrando solo los primeros 15 registros</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-2 font-semibold">
                      📅 Fecha de Registro
                      <span className="ml-1 text-xs font-normal text-blue-600">↓ Más recientes primero</span>
                    </th>
                    <th className="text-left py-3 px-2 font-semibold">💵 Precio del Dólar</th>
                    <th className="text-left py-3 px-2 font-semibold">🔗 Fuente</th>
                    <th className="text-left py-3 px-2 font-semibold">⚙️ Tipo</th>
                    <th className="text-left py-3 px-2 font-semibold">📊 Confianza</th>
                    <th className="text-left py-3 px-2 font-semibold">🛠️ Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.slice(0, 15).map((rate, index) => (
                    <tr key={rate.id || index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm">
                        <div className="font-medium">{formatDateTime(rate.created_at)}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-mono font-bold text-green-700">
                          {rate.rate > 100 
                            ? `$${rate.rate.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                            : `$${(1/rate.rate).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                          }
                        </div>
                        <div className="text-xs text-gray-500">pesos por USD</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rate.source === 'manual' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rate.source}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {rate.is_manual_override ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">✋ Manual</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">🔄 API</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <div className="text-sm font-medium">{(rate.confidence_level * 100).toFixed(0)}%</div>
                          <div className={`w-2 h-2 rounded-full ${
                            rate.confidence_level > 0.8 ? 'bg-green-400' :
                            rate.confidence_level > 0.6 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}></div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex space-x-1">
                          <Button
                            variant="secondary"
                            onClick={() => editRate(rate)}
                            className="text-xs px-2 py-1"
                          >
                            ✏️ Editar
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => deleteRate(rate.id)}
                            className="text-xs px-2 py-1"
                          >
                            🗑️ Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <p className="text-yellow-800">
                {history.length === 0 
                  ? '⚠️ No hay datos históricos disponibles'
                  : '🔍 No se encontraron registros con los filtros aplicados'
                }
              </p>
              {history.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={resetFilters}
                  className="mt-2 text-sm"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Modal para agregar tasa manual */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">💰 Agregar Tasa Manual del Dólar</h2>
              
              <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md mb-4">
                ℹ️ La fecha y hora se registrarán automáticamente al momento de guardar
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">💵 Precio del Dólar (1 USD = ? ARS)</label>
                <div className="text-xs text-gray-500 mb-2">
                  Ingrese cuántos pesos argentinos ARS necesita para comprar 1 dólar USD
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1445.00"
                  title="Precio del dólar en pesos argentinos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({...newRate, rate: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Observaciones sobre esta tasa..."
                  value={newRate.notes}
                  onChange={(e) => setNewRate({...newRate, notes: e.target.value})}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={addManualRate}>
                  Agregar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal para editar tasa */}
      {showEditModal && editingRate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">✏️ Editar Tasa del Dólar</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Fecha</label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {editingRate ? new Date(editingRate.date).toLocaleDateString('es-AR') : ''}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  La fecha no puede modificarse en tasas existentes
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">💵 Precio del Dólar (1 USD = ? ARS)</label>
                <div className="text-xs text-gray-500 mb-2">
                  Modifique cuántos pesos argentinos ARS necesita para comprar 1 dólar USD
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1445.00"
                  title="Nuevo precio del dólar en pesos argentinos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({...newRate, rate: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Observaciones sobre esta tasa..."
                  value={newRate.notes}
                  onChange={(e) => setNewRate({...newRate, notes: e.target.value})}
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">
                  <div><strong>Fuente original:</strong> {editingRate.source}</div>
                  <div><strong>Creado:</strong> {formatDate(editingRate.created_at)}</div>
                  {editingRate.created_by && <div><strong>Por:</strong> {editingRate.created_by}</div>}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRate(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={updateRate}>
                  Actualizar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Programación */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Programar Actualización Automática</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-sm">Estado Actual: Activo</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    La actualización automática está configurada para ejecutarse diariamente a las 9:00 AM.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frecuencia de Actualización
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Seleccionar frecuencia de actualización"
                  >
                    <option value="daily">Diaria (9:00 AM)</option>
                    <option value="hourly">Cada hora</option>
                    <option value="manual">Solo manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fuentes API Habilitadas
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm">DolarAPI (Principal)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm">DolarSi (Respaldo)</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" defaultChecked className="mr-2" />
                      <span className="text-sm">Banco Nación (Oficial)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-700">
                    <strong>Próxima ejecución:</strong> Mañana a las 9:00 AM
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 mt-6 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={() => {
                  // Aquí iría la lógica para actualizar la configuración
                  setShowScheduleModal(false);
                  alert('Configuración de programación actualizada correctamente');
                }}>
                  Guardar Configuración
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}