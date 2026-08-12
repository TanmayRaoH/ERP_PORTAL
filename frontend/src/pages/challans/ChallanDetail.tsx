import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Edit } from 'lucide-react';
import { api, handleApiError } from '../../lib/api';
import { Challan, Customer, PaginatedResponse } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { ProductPicker, PickedItem } from '../../components/ProductPicker';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editItems, setEditItems] = useState<PickedItem[]>([]);

  const { data: challan, isLoading } = useQuery({
    queryKey: ['challan', id],
    queryFn: () => api.get<Challan>(`/challans/${id}`).then(r => r.data),
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => api.get<PaginatedResponse<Customer>>('/customers?limit=200').then(r => r.data),
    enabled: isEditing,
  });

  const startEdit = () => {
    if (!challan) return;
    setEditCustomerId(challan.customer_id);
    setEditItems(
      (challan.items || []).map(i => ({
        product_id: i.product_id,
        product_name: i.product_name_snapshot,
        sku: i.sku_snapshot,
        unit_price: i.unit_price_snapshot,
        quantity: i.quantity,
      }))
    );
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/challans/${id}`, {
        customer_id: editCustomerId,
        items: editItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan', id] });
      queryClient.invalidateQueries({ queryKey: ['challans'] });
      toast.success('Challan updated');
      setIsEditing(false);
    },
    onError: handleApiError,
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/challans/${id}/confirm`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan', id] });
      queryClient.invalidateQueries({ queryKey: ['challans'] });
      toast.success('Challan confirmed — stock deducted');
    },
    onError: (err) => {
      // Show specific stock shortfall details
      if ((err as any)?.response?.data?.error?.details) {
        const details = (err as any).response.data.error.details as Array<{
          product_name: string;
          available: number;
          requested: number;
        }>;
        details.forEach(d =>
          toast.error(`${d.product_name}: need ${d.requested}, have ${d.available}`, { duration: 5000 })
        );
      } else {
        handleApiError(err);
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/challans/${id}/cancel`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challan', id] });
      queryClient.invalidateQueries({ queryKey: ['challans'] });
      toast.success('Challan cancelled');
    },
    onError: handleApiError,
  });

  if (isLoading || !challan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = challan.status === 'draft' &&
    (user?.role === 'admin' || (user?.role === 'sales' && challan.created_by === user?.id));

  const canConfirm = challan.status === 'draft' &&
    (user?.role === 'admin' || user?.role === 'warehouse');

  const canCancel = challan.status !== 'cancelled' &&
    (user?.role === 'admin' || user?.role === 'warehouse' ||
      (user?.role === 'sales' && challan.status === 'draft' && challan.created_by === user?.id));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2" aria-label="Go back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{challan.challan_number}</h1>
            <StatusBadge status={challan.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Created by {challan.created_by_name} on {format(new Date(challan.created_at), 'MMM d, yyyy HH:mm')}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {canEdit && !isEditing && (
            <button className="btn-secondary" onClick={startEdit}>
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {canConfirm && !isEditing && (
            <button
              className="btn-success"
              onClick={() => {
                if (window.confirm('Confirm this challan? Stock will be deducted.')) {
                  confirmMutation.mutate();
                }
              }}
              disabled={confirmMutation.isPending}
            >
              <CheckCircle className="w-4 h-4" />
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm'}
            </button>
          )}
          {canCancel && !isEditing && (
            <button
              className="btn-danger"
              onClick={() => {
                if (window.confirm('Cancel this challan?')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="w-4 h-4" />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Customer</p>
          <p className="font-semibold text-gray-900 mt-1">{challan.customer_name}</p>
          {challan.customer_mobile && (
            <p className="text-sm text-gray-500">{challan.customer_mobile}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Quantity</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{challan.total_quantity}</p>
        </div>
        {challan.confirmed_at && (
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Confirmed At</p>
            <p className="font-semibold text-gray-900 mt-1">
              {format(new Date(challan.confirmed_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Items</h2>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="edit-customer">Customer</label>
              <select
                id="edit-customer"
                className="input max-w-md"
                value={editCustomerId}
                onChange={(e) => setEditCustomerId(e.target.value)}
              >
                {customers?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.mobile}
                  </option>
                ))}
              </select>
            </div>
            <ProductPicker items={editItems} onChange={setEditItems} />
            <div className="flex gap-3">
              <button
                className="btn-primary"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || editItems.length === 0}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn-secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <ProductPicker
            items={(challan.items || []).map(i => ({
              product_id: i.product_id,
              product_name: i.product_name_snapshot,
              sku: i.sku_snapshot,
              unit_price: i.unit_price_snapshot,
              quantity: i.quantity,
            }))}
            onChange={() => {}}
            disabled
          />
        )}
      </div>
    </div>
  );
}
