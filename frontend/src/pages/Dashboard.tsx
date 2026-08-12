import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Users, FileText, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Product, Customer, Challan, PaginatedResponse } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: productsData } = useQuery({
    queryKey: ['products-low-stock'],
    queryFn: () => api.get<PaginatedResponse<Product>>('/products?limit=100').then(r => r.data),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-followup'],
    queryFn: () => api.get<PaginatedResponse<Customer>>('/customers?limit=100').then(r => r.data),
  });

  const { data: challansData } = useQuery({
    queryKey: ['challans-draft'],
    queryFn: () => api.get<PaginatedResponse<Challan>>('/challans?status=draft&limit=10').then(r => r.data),
  });

  const lowStockProducts = productsData?.data.filter(
    (p) => p.current_stock <= p.min_stock_alert && p.min_stock_alert > 0
  ) || [];

  const today = new Date().toISOString().split('T')[0];
  const followUpCustomers = customersData?.data.filter(
    (c) => c.follow_up_date && c.follow_up_date <= today && c.status !== 'inactive'
  ) || [];

  const draftChallans = challansData?.data || [];

  const stats = [
    {
      label: 'Total Products',
      value: productsData?.total ?? '—',
      icon: <Package className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-50',
      link: '/products',
    },
    {
      label: 'Total Customers',
      value: customersData?.total ?? '—',
      icon: <Users className="w-6 h-6 text-green-500" />,
      bg: 'bg-green-50',
      link: '/customers',
    },
    {
      label: 'Draft Challans',
      value: challansData?.total ?? '—',
      icon: <FileText className="w-6 h-6 text-yellow-500" />,
      bg: 'bg-yellow-50',
      link: '/challans?status=draft',
    },
    {
      label: 'Low Stock Alerts',
      value: lowStockProducts.length,
      icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
      bg: 'bg-red-50',
      link: '/products',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.name} — <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low stock alerts */}
        {(user?.role === 'admin' || user?.role === 'warehouse') && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
              {lowStockProducts.length > 0 && (
                <span className="ml-auto badge bg-red-100 text-red-700">{lowStockProducts.length}</span>
              )}
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-500">All stock levels are healthy.</p>
            ) : (
              <ul className="space-y-2">
                {lowStockProducts.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link to={`/products/${p.id}`} className="flex justify-between items-center group">
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-red-600">{p.current_stock}</span>
                        <p className="text-xs text-gray-400">min: {p.min_stock_alert}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Follow-up due */}
        {(user?.role === 'admin' || user?.role === 'sales') && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Follow-ups Due</h2>
              {followUpCustomers.length > 0 && (
                <span className="ml-auto badge bg-blue-100 text-blue-700">{followUpCustomers.length}</span>
              )}
            </div>
            {followUpCustomers.length === 0 ? (
              <p className="text-sm text-gray-500">No follow-ups due today.</p>
            ) : (
              <ul className="space-y-2">
                {followUpCustomers.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`/customers/${c.id}`} className="flex justify-between items-center group">
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.mobile}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={c.status} />
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.follow_up_date ? format(new Date(c.follow_up_date), 'MMM d') : ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Draft challans */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Pending Challans</h2>
            {draftChallans.length > 0 && (
              <span className="ml-auto badge bg-yellow-100 text-yellow-700">{draftChallans.length}</span>
            )}
          </div>
          {draftChallans.length === 0 ? (
            <p className="text-sm text-gray-500">No pending challans.</p>
          ) : (
            <ul className="space-y-2">
              {draftChallans.slice(0, 5).map((ch) => (
                <li key={ch.id}>
                  <Link to={`/challans/${ch.id}`} className="flex justify-between items-center group">
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600">
                        {ch.challan_number}
                      </p>
                      <p className="text-xs text-gray-400">{ch.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={ch.status} />
                      <p className="text-xs text-gray-400 mt-0.5">qty: {ch.total_quantity}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/challans" className="block mt-3 text-xs text-blue-600 hover:text-blue-700">
            View all challans →
          </Link>
        </div>
      </div>
    </div>
  );
}
