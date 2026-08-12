import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Challan, PaginatedResponse } from '../../types';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

export function ChallanListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['challans', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      return api.get<PaginatedResponse<Challan>>(`/challans?${params}`).then(r => r.data);
    },
  });

  const canCreate = user?.role === 'admin' || user?.role === 'sales';

  const columns = [
    {
      header: 'Challan #',
      render: (ch: Challan) => (
        <span className="font-mono font-medium text-gray-900">{ch.challan_number}</span>
      ),
    },
    {
      header: 'Customer',
      render: (ch: Challan) => (
        <span className="text-gray-700">{ch.customer_name || '—'}</span>
      ),
    },
    {
      header: 'Status',
      render: (ch: Challan) => <StatusBadge status={ch.status} />,
    },
    {
      header: 'Qty',
      render: (ch: Challan) => <span>{ch.total_quantity}</span>,
    },
    {
      header: 'Created By',
      render: (ch: Challan) => <span className="text-gray-500">{ch.created_by_name}</span>,
    },
    {
      header: 'Date',
      render: (ch: Challan) => (
        <span className="text-gray-500 text-xs">
          {format(new Date(ch.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Challans</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total challans</p>
        </div>
        {canCreate && (
          <Link to="/challans/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Challan
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        {['', 'draft', 'confirmed', 'cancelled'].map((s) => (
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
        isLoading={isLoading}
        emptyMessage="No challans found."
        actions={(ch) => (
          <button
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            onClick={() => navigate(`/challans/${ch.id}`)}
          >
            View
          </button>
        )}
      />
    </div>
  );
}
