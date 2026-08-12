import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { api, handleApiError } from '../../lib/api';
import { Customer, PaginatedResponse } from '../../types';
import { ProductPicker, PickedItem } from '../../components/ProductPicker';

export function ChallanNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.get<PaginatedResponse<Customer>>('/customers?limit=200').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/challans', {
        customer_id: customerId,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      }).then(r => r.data),
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['challans'] });
      toast.success('Challan created as draft');
      navigate(`/challans/${data.id}`);
    },
    onError: handleApiError,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (items.length === 0) { toast.error('Add at least one product'); return; }
    mutation.mutate();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2" aria-label="Go back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Challan</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer selection */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Customer</h2>
          <div>
            <label className="label" htmlFor="customer">Select Customer</label>
            <select
              id="customer"
              className="input max-w-md"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">— Select a customer —</option>
              {customers?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.business_name ? `(${c.business_name})` : ''} — {c.mobile}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Products
            {items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                {items.length} item{items.length !== 1 ? 's' : ''}, total qty: {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </h2>
          <ProductPicker items={items} onChange={setItems} />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending || !customerId || items.length === 0}
          >
            {mutation.isPending ? 'Creating...' : 'Create Draft Challan'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
