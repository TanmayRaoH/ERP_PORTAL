import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api, handleApiError } from '../lib/api';
import { User, PaginatedResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
  role: z.enum(['admin', 'sales', 'warehouse', 'accounts']),
});

type FormData = z.infer<typeof schema>;

export function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<PaginatedResponse<User>>('/users').then(r => r.data),
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'sales' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/users', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
      reset();
      setShowForm(false);
    },
    onError: handleApiError,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} employees</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : <><Plus className="w-4 h-4" />Add User</>}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="card p-6 grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          <div>
            <label className="label" htmlFor="uname">Full Name *</label>
            <input id="uname" className={`input ${errors.name ? 'border-red-500' : ''}`} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="uemail">Email *</label>
            <input id="uemail" type="email" className={`input ${errors.email ? 'border-red-500' : ''}`} {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="upwd">Password *</label>
            <input id="upwd" type="password" className={`input ${errors.password ? 'border-red-500' : ''}`} {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="urole">Role *</label>
            <select id="urole" className="input" {...register('role')}>
              <option value="admin">Admin</option>
              <option value="sales">Sales</option>
              <option value="warehouse">Warehouse</option>
              <option value="accounts">Accounts</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); reset(); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.data.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(u.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
