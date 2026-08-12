import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { Product, PaginatedResponse } from '../../types';
import { DataTable } from '../../components/DataTable';
import { useAuth } from '../../contexts/AuthContext';

export function ProductListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, category],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      return api.get<PaginatedResponse<Product>>(`/products?${params}`).then(r => r.data);
    },
  });

  const canWrite = user?.role === 'admin' || user?.role === 'warehouse';

  const columns = [
    {
      header: 'Name / SKU',
      render: (p: Product) => (
        <div>
          <p className="font-medium text-gray-900">{p.name}</p>
          <p className="text-xs text-gray-400">{p.sku}</p>
        </div>
      ),
    },
    { header: 'Category', accessor: 'category' as const },
    {
      header: 'Price',
      render: (p: Product) => <span>₹{Number(p.unit_price).toFixed(2)}</span>,
    },
    {
      header: 'Stock',
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          <span
            className={`font-semibold ${
              p.current_stock <= p.min_stock_alert && p.min_stock_alert > 0
                ? 'text-red-600'
                : 'text-gray-900'
            }`}
          >
            {p.current_stock}
          </span>
          {p.current_stock <= p.min_stock_alert && p.min_stock_alert > 0 && (
            <span title="Low stock">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </span>
          )}
        </div>
      ),
    },
    { header: 'Location', accessor: 'location' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total products</p>
        </div>
        {canWrite && (
          <Link to="/products/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Filter by category..."
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Search products..."
        isLoading={isLoading}
        emptyMessage="No products found."
        searchValue={search}
        actions={(p) => (
          <button
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            onClick={() => navigate(`/products/${p.id}`)}
          >
            View
          </button>
        )}
      />
    </div>
  );
}
