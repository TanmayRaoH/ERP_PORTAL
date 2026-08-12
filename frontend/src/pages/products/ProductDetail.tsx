import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { api, handleApiError } from '../../lib/api';
import { Product, StockMovement, PaginatedResponse } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

const movementSchema = z.object({
  quantity_changed: z.coerce.number().int().positive('Must be positive'),
  movement_type: z.enum(['IN', 'OUT']),
  reason: z.string().min(1, 'Reason is required'),
});

type MovementForm = z.infer<typeof movementSchema>;

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementPage, setMovementPage] = useState(1);
  const canWrite = user?.role === 'admin' || user?.role === 'warehouse';

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`).then(r => r.data),
  });

  const { data: movements } = useQuery({
    queryKey: ['movements', id, movementPage],
    queryFn: () =>
      api.get<PaginatedResponse<StockMovement>>(
        `/products/${id}/stock-movements?page=${movementPage}&limit=10`
      ).then(r => r.data),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { movement_type: 'IN' },
  });

  const movementMutation = useMutation({
    mutationFn: (data: MovementForm) =>
      api.post(`/products/${id}/stock-movements`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['movements', id] });
      toast.success('Stock movement recorded');
      reset();
      setShowMovementForm(false);
    },
    onError: handleApiError,
  });

  if (isLoading || !product) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLowStock = product.current_stock <= product.min_stock_alert && product.min_stock_alert > 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2" aria-label="Go back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-sm text-gray-500">{product.sku}</p>
        </div>
        {canWrite && (
          <Link to={`/products/${id}/edit`} className="btn-secondary">
            Edit Product
          </Link>
        )}
      </div>

      {/* Product info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Category</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{product.category}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Unit Price</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">₹{Number(product.unit_price).toFixed(2)}</p>
        </div>
        <div className={`card p-4 ${isLowStock ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase font-medium">Current Stock</p>
            {isLowStock && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
          <p className={`text-lg font-semibold mt-1 ${isLowStock ? 'text-red-700' : 'text-gray-900'}`}>
            {product.current_stock}
          </p>
          <p className="text-xs text-gray-400">min alert: {product.min_stock_alert}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Location</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{product.location || '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Last Updated</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {format(new Date(product.updated_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Stock movement form */}
      {canWrite && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Record Stock Movement</h2>
            <button
              className="btn-secondary text-sm"
              onClick={() => setShowMovementForm(!showMovementForm)}
            >
              {showMovementForm ? 'Cancel' : (
                <><Plus className="w-4 h-4" />Add Movement</>
              )}
            </button>
          </div>

          {showMovementForm && (
            <form
              onSubmit={handleSubmit((d) => movementMutation.mutate(d))}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div>
                <label className="label" htmlFor="movement_type">Type</label>
                <select id="movement_type" className="input" {...register('movement_type')}>
                  <option value="IN">IN (Receive)</option>
                  <option value="OUT">OUT (Dispatch)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="qty">Quantity</label>
                <input
                  id="qty"
                  type="number"
                  className={`input ${errors.quantity_changed ? 'border-red-500' : ''}`}
                  placeholder="0"
                  {...register('quantity_changed')}
                />
                {errors.quantity_changed && (
                  <p className="mt-1 text-xs text-red-600">{errors.quantity_changed.message}</p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="reason">Reason</label>
                <input
                  id="reason"
                  className={`input ${errors.reason ? 'border-red-500' : ''}`}
                  placeholder="purchase receipt, adjustment..."
                  {...register('reason')}
                />
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
                )}
              </div>
              <div className="sm:col-span-3 flex gap-3">
                <button type="submit" className="btn-primary" disabled={movementMutation.isPending}>
                  {movementMutation.isPending ? 'Saving...' : 'Record Movement'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Movement history */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Stock Movement History</h2>
        {!movements || movements.data.length === 0 ? (
          <p className="text-sm text-gray-500">No movements recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movements.data.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {format(new Date(m.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.movement_type} />
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${m.movement_type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
                        {m.movement_type === 'IN' ? '+' : '-'}{m.quantity_changed}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.reason}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{m.created_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {movements.total > 10 && (
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  className="btn-secondary text-sm"
                  disabled={movementPage <= 1}
                  onClick={() => setMovementPage(p => p - 1)}
                >
                  Prev
                </button>
                <span className="text-sm text-gray-500 self-center">
                  Page {movementPage} of {Math.ceil(movements.total / 10)}
                </span>
                <button
                  className="btn-secondary text-sm"
                  disabled={movementPage >= Math.ceil(movements.total / 10)}
                  onClick={() => setMovementPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
