import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { Product, PaginatedResponse } from '../types';

export interface PickedItem {
  product_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
}

interface ProductPickerProps {
  items: PickedItem[];
  onChange: (items: PickedItem[]) => void;
  disabled?: boolean;
}

export function ProductPicker({ items, onChange, disabled = false }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const { data } = useQuery({
    queryKey: ['products-picker', search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' });
      if (search) params.set('search', search);
      return api.get<PaginatedResponse<Product>>(`/products?${params}`).then(r => r.data);
    },
  });

  const addProduct = (product: Product) => {
    const exists = items.find(i => i.product_id === product.id);
    if (exists) {
      onChange(items.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      onChange([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit_price: product.unit_price,
          quantity: 1,
        },
      ]);
    }
    setSearch('');
    setShowDropdown(false);
  };

  const removeItem = (product_id: string) => {
    onChange(items.filter(i => i.product_id !== product_id));
  };

  const updateQty = (product_id: string, qty: number) => {
    if (qty < 1) return;
    onChange(items.map(i => i.product_id === product_id ? { ...i, quantity: qty } : i));
  };

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Search */}
      {!disabled && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              className="input pl-10"
              placeholder="Search and add products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
          </div>
          {showDropdown && (
            <div
              className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
              onMouseDown={(e) => e.preventDefault()}
            >
              {data?.data.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No products found</p>
              ) : (
                data?.data.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between items-center"
                    onClick={() => addProduct(p)}
                  >
                    <div>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="ml-2 text-gray-400 text-xs">{p.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700">₹{Number(p.unit_price).toFixed(2)}</span>
                      <span className={`ml-2 text-xs ${p.current_stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        stock: {p.current_stock}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Items table */}
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <Plus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Search above to add products</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                {!disabled && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => (
                <tr key={item.product_id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    ₹{Number(item.unit_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {disabled ? (
                      <span className="text-sm font-semibold">{item.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateQty(item.product_id, parseInt(e.target.value) || 1)}
                        className="input w-20 text-center"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    ₹{(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </td>
                  {!disabled && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeItem(item.product_id)}
                        className="text-red-400 hover:text-red-600"
                        aria-label={`Remove ${item.product_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-right text-gray-700">Total</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{total.toFixed(2)}</td>
                {!disabled && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
