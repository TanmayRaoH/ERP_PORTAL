import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Customer, PaginatedResponse } from '../../types';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function CustomerListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return api.get<PaginatedResponse<Customer>>(`/customers?${params}`).then(r => r.data);
    },
  });

  const canCreate = user?.role === 'admin' || user?.role === 'sales';

  const columns = [
    {
      header: 'Name',
      render: (c: Customer) => (
        <div>
          <p className="font-medium text-gray-900">{c.name}</p>
          {c.business_name && <p className="text-xs text-gray-400">{c.business_name}</p>}
        </div>
      ),
    },
    { header: 'Mobile', accessor: 'mobile' as const },
    {
      header: 'Type',
      render: (c: Customer) => <StatusBadge status={c.customer_type} />,
    },
    {
      header: 'Status',
      render: (c: Customer) => <StatusBadge status={c.status} />,
    },
    {
      header: 'Follow-up',
      render: (c: Customer) =>
        c.follow_up_date ? (
          <span className={`text-sm ${new Date(c.follow_up_date) <= new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {format(new Date(c.follow_up_date), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total customers</p>
        </div>
        {canCreate && (
          <Link to="/customers/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Customer
          </Link>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'lead', 'active', 'inactive'].map((s) => (
          <button
            key={s}
            className={`btn ${status === s ? 'btn-primary' : 'btn-secondary'} text-sm`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search customers..."
        isLoading={isLoading}
        emptyMessage="No customers found."
        searchValue={search}
        actions={(c) => (
          <button
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            onClick={() => navigate(`/customers/${c.id}`)}
          >
            View
          </button>
        )}
      />
    </div>
  );
}
