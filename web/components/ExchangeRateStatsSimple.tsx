'use client';

import { useEffect, useState } from 'react';

interface ExchangeRateStats {
  par_monedas: string;
  periodo: {
    dias: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  resumen: {
    total_registros: number;
    tasa_minima: number;
    tasa_maxima: number;
    tasa_promedio: number;
    volatilidad_pct: number;
    tendencia_pct: number;
    rango_variacion: number;
  };
  por_fuente: Record<string, {
    count: number;
    manual_overrides: number;
    avg_confidence: number;
  }>;
  datos_recientes: Array<{
    fecha: string;
    tasa: number;
    fuente: string;
    tipo: string;
  }>;
}

interface ValidationResult {
  status: string;
  par_monedas: string;
  resumen: {
    total_rates: number;
    anomalias: number;
    advertencias: number;
    tasa_promedio: number;
  };
  anomalias: Array<{
    fecha: string;
    tasa: number;
    problema: string;
    desviacion_pct: number;
    fuente: string;
    tipo: string;
  }>;
}

export default function ExchangeRateStats() {
  const [stats, setStats] = useState<ExchangeRateStats | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('ARS');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [days, setDays] = useState(30);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsResponse, validationResponse] = await Promise.all([
        fetch(`/api/exchange-rates/statistics?base_currency=${baseCurrency}&target_currency=${targetCurrency}&days=${days}`),
        fetch(`/api/exchange-rates/validate?base_currency=${baseCurrency}&target_currency=${targetCurrency}&days=7`)
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        setValidation(validationData);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: string) => {
    try {
      const response = await fetch(`/api/exchange-rates/export?base_currency=${baseCurrency}&target_currency=${targetCurrency}&days=${days}&format=${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasas_cambio_${baseCurrency}_${targetCurrency}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error al exportar datos:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [baseCurrency, targetCurrency, days]);

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'clean': return '✅';
      case 'warnings_found': return '⚠️';
      case 'anomalies_detected': return '🚨';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-800">📈 Análisis de Tasas de Cambio</h1>

      {/* Controles */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Configuración de Análisis</h2>
        <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">💱 Tipo de Cambio</label>
              <div className="flex gap-2 items-center">
                <select 
                  value={baseCurrency} 
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                  aria-label="Moneda base"
                >
                  <option value="ARS">ARS (Pesos)</option>
                  <option value="USD">USD (Dólares)</option>
                </select>
                <span className="self-center text-gray-400">→</span>
                <select 
                  value={targetCurrency} 
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                  aria-label="Moneda objetivo"
                >
                  <option value="USD">USD (Dólares)</option>
                  <option value="ARS">ARS (Pesos)</option>
                </select>
              </div>
              <div className="text-xs text-gray-500">
                {baseCurrency === "ARS" ? "💰 Venta de dólares (ARS → USD)" : "💵 Compra de dólares (USD → ARS)"}
              </div>
            </div>          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Período (días)</label>
            <select 
              value={days} 
              onChange={(e) => setDays(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm"
              aria-label="Período de análisis"
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={365}>1 año</option>
            </select>
          </div>

          <button 
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>

          <div className="flex gap-2">
            <button 
              onClick={() => exportData('csv')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              📥 Exportar CSV
            </button>
            <button 
              onClick={() => exportData('json')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              📥 Exportar JSON
            </button>
          </div>
        </div>
      </div>

      {/* Estado de Validación */}
      {validation && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            {getStatusEmoji(validation.status)} Estado de Validación
          </h2>
          <p className="text-gray-600 mb-4">
            Análisis de calidad de datos para {validation.par_monedas}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center bg-blue-50 p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">{validation.resumen.total_rates}</div>
              <div className="text-sm text-gray-600">Total Registros</div>
            </div>
            <div className="text-center bg-red-50 p-3 rounded">
              <div className="text-2xl font-bold text-red-600">{validation.resumen.anomalias}</div>
              <div className="text-sm text-gray-600">Anomalías</div>
            </div>
            <div className="text-center bg-yellow-50 p-3 rounded">
              <div className="text-2xl font-bold text-yellow-600">{validation.resumen.advertencias}</div>
              <div className="text-sm text-gray-600">Advertencias</div>
            </div>
            <div className="text-center bg-green-50 p-3 rounded">
              <div className="text-2xl font-bold text-green-600">${validation.resumen.tasa_promedio.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Tasa Promedio</div>
            </div>
          </div>

          {validation.anomalias && validation.anomalias.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-red-600 mb-2">⚠️ Anomalías Detectadas:</h4>
              <div className="space-y-2">
                {validation.anomalias.map((anomaly, i) => (
                  <div key={i} className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{anomaly.fecha}</div>
                        <div className="text-sm text-gray-600">{anomaly.problema}</div>
                        <div className="text-sm">
                          Tasa: ${anomaly.tasa} | Desviación: {anomaly.desviacion_pct}%
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                        {anomaly.fuente}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas Principales */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tasa Promedio</p>
                  <p className="text-2xl font-bold">${stats.resumen.tasa_promedio.toFixed(4)}</p>
                </div>
                <div className="text-2xl">📊</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Volatilidad</p>
                  <p className="text-2xl font-bold">{stats.resumen.volatilidad_pct.toFixed(1)}%</p>
                </div>
                <div className="text-2xl">📈</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tendencia</p>
                  <p className={`text-2xl font-bold ${stats.resumen.tendencia_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.resumen.tendencia_pct > 0 ? '+' : ''}{stats.resumen.tendencia_pct.toFixed(1)}%
                  </p>
                </div>
                <div className="text-2xl">
                  {stats.resumen.tendencia_pct >= 0 ? '📈' : '📉'}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Rango</p>
                  <p className="text-2xl font-bold">${stats.resumen.rango_variacion.toFixed(4)}</p>
                  <p className="text-xs text-gray-400">
                    ${stats.resumen.tasa_minima.toFixed(2)} - ${stats.resumen.tasa_maxima.toFixed(2)}
                  </p>
                </div>
                <div className="text-2xl">📏</div>
              </div>
            </div>
          </div>

          {/* Estadísticas por Fuente */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">📊 Estadísticas por Fuente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.por_fuente).map(([source, data]) => (
                <div key={source} className="p-4 border rounded bg-gray-50">
                  <h4 className="font-medium mb-2">{source}</h4>
                  <div className="space-y-1 text-sm">
                    <div>📊 Registros: <span className="font-medium">{data.count}</span></div>
                    <div>✋ Manuales: <span className="font-medium">{data.manual_overrides}</span></div>
                    <div>🎯 Confianza: <span className="font-medium">{(data.avg_confidence * 100).toFixed(1)}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Datos Recientes */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">📅 Últimos 7 días</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium">Tasa</th>
                    <th className="text-left py-3 px-4 font-medium">Fuente</th>
                    <th className="text-left py-3 px-4 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.datos_recientes.map((rate, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{new Date(rate.fecha).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono font-medium">${rate.tasa.toFixed(4)}</td>
                      <td className="py-3 px-4">{rate.fuente}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rate.tipo === 'Manual' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {rate.tipo === 'Manual' ? '✋ Manual' : '🔄 API'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}