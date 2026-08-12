interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  // Challan
  draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Draft' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Confirmed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
  // Customer
  lead: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Lead' },
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
  // Stock
  IN: { bg: 'bg-green-100', text: 'text-green-800', label: 'IN' },
  OUT: { bg: 'bg-red-100', text: 'text-red-800', label: 'OUT' },
  // Customer type
  retail: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Retail' },
  wholesale: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Wholesale' },
  distributor: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Distributor' },
  // Roles
  admin: { bg: 'bg-red-100', text: 'text-red-800', label: 'Admin' },
  sales: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Sales' },
  warehouse: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Warehouse' },
  accounts: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Accounts' },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: status,
  };

  return (
    <span className={`badge ${config.bg} ${config.text} ${className}`}>
      {config.label}
    </span>
  );
}
