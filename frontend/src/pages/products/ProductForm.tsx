import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, handleApiError } from '../../lib/api';
import { Product } from '../../types';
import { ArrowLeft } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  unit_price: z.coerce.number().positive('Price must be positive'),
  current_stock: z.coerce.number().int().min(0, 'Stock must be 0 or more').optional().default(0),
  min_stock_alert: z.coerce.number().int().min(0).optional().default(0),
  location: z.string().optional().default(''),
});

type FormData = z.infer<typeof schema>;

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<Product>(`/products/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: product
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category,
          unit_price: product.unit_price,
          current_stock: product.current_stock,
          min_stock_alert: product.min_stock_alert,
          location: product.location,
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? api.put<Product>(`/products/${id}`, data).then(r => r.data)
        : api.post<Product>('/products', data).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast.success(isEdit ? 'Product updated' : 'Product created');
      navigate(`/products/${data.id}`);
    },
    onError: handleApiError,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2" aria-label="Go back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Product' : 'Add Product'}
        </h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className={`input ${errors.name ? 'border-red-500' : ''}`} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="sku">SKU</label>
            <input id="sku" className={`input ${errors.sku ? 'border-red-500' : ''}`} {...register('sku')} />
            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="category">Category</label>
            <input id="category" className={`input ${errors.category ? 'border-red-500' : ''}`} {...register('category')} />
            {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="unit_price">Unit Price (₹)</label>
            <input id="unit_price" type="number" step="0.01" className={`input ${errors.unit_price ? 'border-red-500' : ''}`} {...register('unit_price')} />
            {errors.unit_price && <p className="mt-1 text-xs text-red-600">{errors.unit_price.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="current_stock">Initial Stock</label>
            <input id="current_stock" type="number" className={`input ${errors.current_stock ? 'border-red-500' : ''}`} {...register('current_stock')} disabled={isEdit} />
            {isEdit && <p className="mt-1 text-xs text-gray-400">Use stock movements to adjust stock.</p>}
            {errors.current_stock && <p className="mt-1 text-xs text-red-600">{errors.current_stock.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="min_stock_alert">Min Stock Alert</label>
            <input id="min_stock_alert" type="number" className={`input ${errors.min_stock_alert ? 'border-red-500' : ''}`} {...register('min_stock_alert')} />
            {errors.min_stock_alert && <p className="mt-1 text-xs text-red-600">{errors.min_stock_alert.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="location">Location</label>
            <input id="location" className="input" placeholder="Warehouse A, Shelf B3..." {...register('location')} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => isEdit ? reset() : navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
