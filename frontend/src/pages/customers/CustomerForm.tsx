import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { api, handleApiError } from '../../lib/api';
import { Customer } from '../../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(1, 'Mobile is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  business_name: z.string().optional().default(''),
  gst_number: z.string().optional().nullable(),
  customer_type: z.enum(['retail', 'wholesale', 'distributor']),
  address: z.string().min(1, 'Address is required'),
  status: z.enum(['lead', 'active', 'inactive']),
  follow_up_date: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: customer
      ? {
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email || '',
          business_name: customer.business_name || '',
          gst_number: customer.gst_number || '',
          customer_type: customer.customer_type,
          address: customer.address,
          status: customer.status,
          follow_up_date: customer.follow_up_date || '',
        }
      : { customer_type: 'retail', status: 'lead' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? api.put<Customer>(`/customers/${id}`, data).then(r => r.data)
        : api.post<Customer>('/customers', data).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      navigate(`/customers/${data.id}`);
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
          {isEdit ? 'Edit Customer' : 'Add Customer'}
        </h1>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="label" htmlFor="name">Full Name *</label>
            <input id="name" className={`input ${errors.name ? 'border-red-500' : ''}`} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="mobile">Mobile *</label>
            <input id="mobile" className={`input ${errors.mobile ? 'border-red-500' : ''}`} {...register('mobile')} />
            {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="business_name">Business Name</label>
            <input id="business_name" className="input" {...register('business_name')} />
          </div>

          <div>
            <label className="label" htmlFor="customer_type">Customer Type *</label>
            <select id="customer_type" className="input" {...register('customer_type')}>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="status">Status *</label>
            <select id="status" className="input" {...register('status')}>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="gst_number">GST Number</label>
            <input id="gst_number" className="input" placeholder="Optional" {...register('gst_number')} />
          </div>

          <div>
            <label className="label" htmlFor="follow_up_date">Follow-up Date</label>
            <input id="follow_up_date" type="date" className="input" {...register('follow_up_date')} />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">Address *</label>
            <textarea
              id="address"
              rows={3}
              className={`input resize-none ${errors.address ? 'border-red-500' : ''}`}
              {...register('address')}
            />
            {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
