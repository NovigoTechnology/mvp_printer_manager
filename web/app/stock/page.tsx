'use client';

import { useState, useEffect } from 'react';

interface StockLocation {
  id: number;
  name: string;
  description?: string;
  location_type: string;
  address?: string;
  responsible_person?: string;
  is_active: boolean;
  created_at: string;
}

interface StockItem {
  id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  brand?: string;
  model?: string;
  description?: string;
  compatible_printers?: string;
  unit_of_measure: string;
  minimum_stock: number;
  maximum_stock: number;
  cost_per_unit: number;
  supplier?: string;
  supplier_code?: string;
  storage_location_id?: number;
  is_active: boolean;
  created_at: string;
  current_stock?: number;
  reserved_stock?: number;
  available_stock?: number;
}

interface StockMovement {
  id: number;
  stock_item_id: number;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type?: string;
  reference_id?: number;
  source_location_id?: number;
  destination_location_id?: number;
  printer_id?: number;
  notes?: string;
  moved_by: string;
  movement_date: string;
  item_name?: string;
  item_code?: string;
  source_location_name?: string;
  destination_location_name?: string;
  printer_info?: string;
}

interface StockSummary {
  total_items: number;
  low_stock_items: number;
  total_stock_value: number;
  recent_movements_7days: number;
  items_by_type: Array<{ type: string; count: number }>;
}

// Product Modal Component
interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: any) => void;
  product?: StockItem | null;
  locations: StockLocation[];
}

function ProductModal({ isOpen, onClose, onSave, product, locations }: ProductModalProps) {
  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    item_type: 'toner',
    brand: '',
    model: '',
    description: '',
    compatible_printers: '',
    unit_of_measure: 'unidad',
    minimum_stock: 0,
    maximum_stock: 100,
    cost_per_unit: 0,
    supplier: '',
    supplier_code: '',
    storage_location_id: 1
  });

  useEffect(() => {
    if (product) {
      setFormData({
        item_code: product.item_code,
        item_name: product.item_name,
        item_type: product.item_type,
        brand: product.brand || '',
        model: product.model || '',
        description: product.description || '',
        compatible_printers: product.compatible_printers || '',
        unit_of_measure: product.unit_of_measure,
        minimum_stock: product.minimum_stock,
        maximum_stock: product.maximum_stock,
        cost_per_unit: product.cost_per_unit,
        supplier: product.supplier || '',
        supplier_code: product.supplier_code || '',
        storage_location_id: product.storage_location_id || 1
      });
    } else {
      setFormData({
        item_code: '',
        item_name: '',
        item_type: 'toner',
        brand: '',
        model: '',
        description: '',
        compatible_printers: '',
        unit_of_measure: 'unidad',
        minimum_stock: 0,
        maximum_stock: 100,
        cost_per_unit: 0,
        supplier: '',
        supplier_code: '',
        storage_location_id: 1
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = product 
        ? `http://localhost:8000/stock/items/${product.id}`
        : 'http://localhost:8000/stock/items/';
      
      const method = product ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
      } else {
        console.error('Error saving product');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {product ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código del Producto *
              </label>
              <input
                type="text"
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Producto *
              </label>
              <input
                type="text"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={formData.item_type}
                onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="toner">Tóner</option>
                <option value="papel">Papel</option>
                <option value="repuesto">Repuesto</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marca
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidad de Medida
              </label>
              <select
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="unidad">Unidad</option>
                <option value="resma">Resma</option>
                <option value="caja">Caja</option>
                <option value="paquete">Paquete</option>
                <option value="lata">Lata</option>
                <option value="litro">Litro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impresoras Compatibles
            </label>
            <input
              type="text"
              value={formData.compatible_printers}
              onChange={(e) => setFormData({ ...formData, compatible_printers: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Ej: HP LaserJet Pro M404, M428"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Mínimo
              </label>
              <input
                type="number"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Máximo
              </label>
              <input
                type="number"
                value={formData.maximum_stock}
                onChange={(e) => setFormData({ ...formData, maximum_stock: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código del Proveedor
              </label>
              <input
                type="text"
                value={formData.supplier_code}
                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación de Almacenamiento
            </label>
            <select
              value={formData.storage_location_id}
              onChange={(e) => setFormData({ ...formData, storage_location_id: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {product ? 'Actualizar' : 'Crear'} Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Location Modal Component
interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: any) => void;
}

function LocationModal({ isOpen, onClose, onSave }: LocationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_type: 'warehouse',
    address: '',
    responsible_person: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:8000/stock/locations/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
        setFormData({
          name: '',
          description: '',
          location_type: 'warehouse',
          address: '',
          responsible_person: ''
        });
      } else {
        console.error('Error saving location');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Nueva Ubicación</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo *
            </label>
            <select
              value={formData.location_type}
              onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="warehouse">Depósito</option>
              <option value="office">Oficina</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="storage">Almacén</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsable
            </label>
            <input
              type="text"
              value={formData.responsible_person}
              onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Crear Ubicación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Movement Modal Component
interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (movement: any) => void;
  items: StockItem[];
  locations: StockLocation[];
  preselectedItem?: StockItem | null;
}

function MovementModal({ isOpen, onClose, onSave, items, locations, preselectedItem }: MovementModalProps) {
  const [formData, setFormData] = useState({
    stock_item_id: '',
    movement_type: 'in',
    quantity: 1,
    unit_cost: 0,
    source_location_id: '',
    destination_location_id: '',
    notes: '',
    moved_by: ''
  });

  // Update form when preselected item changes
  useEffect(() => {
    if (preselectedItem) {
      setFormData(prev => ({
        ...prev,
        stock_item_id: preselectedItem.id.toString(),
        unit_cost: preselectedItem.cost_per_unit
      }));
    }
  }, [preselectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      stock_item_id: parseInt(formData.stock_item_id),
      source_location_id: formData.source_location_id ? parseInt(formData.source_location_id) : null,
      destination_location_id: formData.destination_location_id ? parseInt(formData.destination_location_id) : null,
    };
    
    try {
      const response = await fetch('http://localhost:8000/stock/movements/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
        setFormData({
          stock_item_id: '',
          movement_type: 'in',
          quantity: 1,
          unit_cost: 0,
          source_location_id: '',
          destination_location_id: '',
          notes: '',
          moved_by: ''
        });
      } else {
        console.error('Error saving movement');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {preselectedItem ? `Movimiento - ${preselectedItem.item_name}` : 'Nuevo Movimiento'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto *
            </label>
            <select
              value={formData.stock_item_id}
              onChange={(e) => {
                const selectedItem = items.find(item => item.id === parseInt(e.target.value));
                setFormData({ 
                  ...formData, 
                  stock_item_id: e.target.value,
                  unit_cost: selectedItem ? selectedItem.cost_per_unit : 0
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
              disabled={!!preselectedItem}
            >
              <option value="">Seleccionar producto</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code} - {item.item_name} {item.current_stock ? `(Stock: ${item.current_stock})` : ''}
                </option>
              ))}
            </select>
            {preselectedItem && (
              <p className="text-sm text-gray-600 mt-1">
                Stock actual: <span className="font-medium">{preselectedItem.current_stock || 0} {preselectedItem.unit_of_measure}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Movimiento *
            </label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({ ...formData, movement_type: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="in">Entrada</option>
              <option value="out">Salida</option>
              <option value="transfer">Transferencia</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="1"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
          </div>

          {formData.movement_type === 'out' || formData.movement_type === 'transfer' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación Origen
              </label>
              <select
                value={formData.source_location_id}
                onChange={(e) => setFormData({ ...formData, source_location_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar ubicación</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {formData.movement_type === 'in' || formData.movement_type === 'transfer' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ubicación Destino
              </label>
              <select
                value={formData.destination_location_id}
                onChange={(e) => setFormData({ ...formData, destination_location_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccionar ubicación</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Movido por *
            </label>
            <input
              type="text"
              value={formData.moved_by}
              onChange={(e) => setFormData({ ...formData, moved_by: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Crear Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<StockItem | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string>('');

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadStockSummary();
    } else if (activeTab === 'items') {
      loadStockItems();
      if (stockLocations.length === 0) {
        loadStockLocations();
      }
    } else if (activeTab === 'locations') {
      loadStockLocations();
    } else if (activeTab === 'movements') {
      loadStockMovements();
      if (stockLocations.length === 0) {
        loadStockLocations();
      }
      if (stockItems.length === 0) {
        loadStockItems();
      }
    }
  }, [activeTab, selectedItemType]);

  const loadStockSummary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/stock/reports/summary');
      if (response.ok) {
        const data = await response.json();
        setStockSummary(data);
      }
    } catch (error) {
      console.error('Error loading stock summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStockItems = async () => {
    setIsLoading(true);
    try {
      const url = selectedItemType 
        ? `http://localhost:8000/stock/items/?item_type=${selectedItemType}`
        : 'http://localhost:8000/stock/items/';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStockItems(data);
      }
    } catch (error) {
      console.error('Error loading stock items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStockLocations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/stock/locations/');
      if (response.ok) {
        const data = await response.json();
        setStockLocations(data);
      }
    } catch (error) {
      console.error('Error loading stock locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStockMovements = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/stock/movements/?limit=50');
      if (response.ok) {
        const data = await response.json();
        setStockMovements(data);
      }
    } catch (error) {
      console.error('Error loading stock movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStockStatus = (item: StockItem) => {
    const current = item.current_stock || 0;
    if (current <= item.minimum_stock) return 'low';
    if (current >= item.maximum_stock) return 'high';
    return 'normal';
  };

  const getStockStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'low': return 'text-red-600 bg-red-50';
      case 'high': return 'text-blue-600 bg-blue-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Control de Stock</h1>
            <p className="text-gray-600 mt-2">
              Gestión de inventario de insumos, tóner, papel y repuestos
            </p>
          </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                { id: 'items', label: 'Productos', icon: '📦' },
                { id: 'locations', label: 'Ubicaciones', icon: '🏢' },
                { id: 'movements', label: 'Movimientos', icon: '📋' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {stockSummary && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Total Productos</p>
                        <p className="text-2xl font-semibold text-gray-900">{stockSummary.total_items}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        📦
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
                        <p className="text-2xl font-semibold text-red-600">{stockSummary.low_stock_items}</p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        ⚠️
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Valor Total</p>
                        <p className="text-2xl font-semibold text-green-600">
                          {formatCurrency(stockSummary.total_stock_value)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        💰
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">Movimientos (7d)</p>
                        <p className="text-2xl font-semibold text-gray-900">{stockSummary.recent_movements_7days}</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        🔄
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items by Type */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Productos por Tipo</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stockSummary.items_by_type.map((item, index) => (
                      <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 capitalize">{item.type}</p>
                        <p className="text-xl font-semibold text-gray-900">{item.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Productos en Stock</h3>
                  <div className="flex space-x-3">
                    <select
                      value={selectedItemType}
                      onChange={(e) => setSelectedItemType(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Todos los tipos</option>
                      <option value="toner">Tóner</option>
                      <option value="papel">Papel</option>
                      <option value="repuesto">Repuesto</option>
                      <option value="mantenimiento">Mantenimiento</option>
                    </select>
                    <button
                      onClick={() => setShowItemModal(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      ➕ Nuevo Producto
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock Actual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min/Max
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Costo Unitario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockItems.map((item) => {
                      const status = getStockStatus(item);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.item_code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                              {item.brand && <div className="text-sm text-gray-500">{item.brand} {item.model}</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                            {item.item_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.current_stock || 0} {item.unit_of_measure}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.minimum_stock} / {item.maximum_stock}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(status)}`}>
                              {status === 'low' ? 'Stock Bajo' : status === 'high' ? 'Sobrestockeado' : 'Normal'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.cost_per_unit)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItemForMovement(item);
                                setShowMovementModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                            >
                              📦
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Ubicaciones de Stock</h3>
                  <button
                    onClick={() => setShowLocationModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    ➕ Nueva Ubicación
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dirección
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Responsable
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockLocations.map((location) => (
                      <tr key={location.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{location.name}</div>
                            {location.description && (
                              <div className="text-sm text-gray-500">{location.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {location.location_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {location.address || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {location.responsible_person || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(location.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Movements Tab */}
        {activeTab === 'movements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Movimientos de Stock</h3>
                  <button
                    onClick={() => {
                      setSelectedItemForMovement(null);
                      setShowMovementModal(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    ➕ Nuevo Movimiento
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Origen/Destino
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Movido por
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Costo Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockMovements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(movement.movement_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{movement.item_name}</div>
                            <div className="text-sm text-gray-500">{movement.item_code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            movement.movement_type === 'in' ? 'bg-green-100 text-green-800' :
                            movement.movement_type === 'out' ? 'bg-red-100 text-red-800' :
                            movement.movement_type === 'transfer' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {movement.movement_type === 'in' ? 'Entrada' :
                             movement.movement_type === 'out' ? 'Salida' :
                             movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {movement.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {movement.movement_type === 'transfer' ? (
                            <>
                              <div>{movement.source_location_name} →</div>
                              <div>{movement.destination_location_name}</div>
                            </>
                          ) : movement.movement_type === 'in' ? (
                            movement.destination_location_name
                          ) : (
                            movement.source_location_name
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {movement.moved_by}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(movement.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Product Modal */}
        {showItemModal && (
          <ProductModal
            isOpen={showItemModal}
            onClose={() => {
              setShowItemModal(false);
              setEditingItem(null);
            }}
            onSave={(product) => {
              if (editingItem) {
                // Update existing product
                console.log('Updating product:', product);
              } else {
                // Create new product
                console.log('Creating product:', product);
              }
              setShowItemModal(false);
              setEditingItem(null);
              loadStockItems();
            }}
            product={editingItem}
            locations={stockLocations}
          />
        )}

        {/* Location Modal */}
        {showLocationModal && (
          <LocationModal
            isOpen={showLocationModal}
            onClose={() => setShowLocationModal(false)}
            onSave={(location) => {
              console.log('Creating location:', location);
              setShowLocationModal(false);
              loadStockLocations();
            }}
          />
        )}

        {/* Movement Modal */}
        {showMovementModal && (
          <MovementModal
            isOpen={showMovementModal}
            onClose={() => {
              setShowMovementModal(false);
              setSelectedItemForMovement(null);
            }}
            onSave={(movement) => {
              console.log('Creating movement:', movement);
              setShowMovementModal(false);
              setSelectedItemForMovement(null);
              // Refresh both movements and stock items to show updated stock levels
              loadStockMovements();
              loadStockItems();
            }}
            items={stockItems}
            locations={stockLocations}
            preselectedItem={selectedItemForMovement}
          />
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span>Cargando...</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}