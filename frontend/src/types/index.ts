export type UserRole = 'admin' | 'sales' | 'warehouse' | 'accounts';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  business_name?: string;
  gst_number?: string;
  customer_type: 'retail' | 'wholesale' | 'distributor';
  address: string;
  status: 'lead' | 'active' | 'inactive';
  follow_up_date?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit_price: number;
  current_stock: number;
  min_stock_alert: number;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  quantity_changed: number;
  movement_type: 'IN' | 'OUT';
  reason: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface ChallanItem {
  id: string;
  challan_id: string;
  product_id: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  current_product_stock?: number;
}

export interface Challan {
  id: string;
  challan_number: string;
  customer_id: string;
  customer_name?: string;
  customer_mobile?: string;
  total_quantity: number;
  status: 'draft' | 'confirmed' | 'cancelled';
  created_by: string;
  created_by_name?: string;
  created_at: string;
  confirmed_at?: string;
  items?: ChallanItem[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
