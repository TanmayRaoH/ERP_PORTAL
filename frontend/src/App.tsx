import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { RoleGuard } from './components/RoleGuard';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ProductListPage } from './pages/products/ProductList';
import { ProductFormPage } from './pages/products/ProductForm';
import { ProductDetailPage } from './pages/products/ProductDetail';
import { ChallanListPage } from './pages/challans/ChallanList';
import { ChallanNewPage } from './pages/challans/ChallanNew';
import { ChallanDetailPage } from './pages/challans/ChallanDetail';
import { CustomerListPage } from './pages/customers/CustomerList';
import { CustomerFormPage } from './pages/customers/CustomerForm';
import { CustomerDetailPage } from './pages/customers/CustomerDetail';
import { UsersPage } from './pages/Users';

function PrivateRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Products */}
        <Route path="/products" element={<ProductListPage />} />
        <Route
          path="/products/new"
          element={
            <RoleGuard allowedRoles={['admin', 'warehouse']}>
              <ProductFormPage />
            </RoleGuard>
          }
        />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route
          path="/products/:id/edit"
          element={
            <RoleGuard allowedRoles={['admin', 'warehouse']}>
              <ProductFormPage />
            </RoleGuard>
          }
        />

        {/* Challans */}
        <Route path="/challans" element={<ChallanListPage />} />
        <Route
          path="/challans/new"
          element={
            <RoleGuard allowedRoles={['admin', 'sales']}>
              <ChallanNewPage />
            </RoleGuard>
          }
        />
        <Route path="/challans/:id" element={<ChallanDetailPage />} />

        {/* Customers */}
        <Route path="/customers" element={<CustomerListPage />} />
        <Route
          path="/customers/new"
          element={
            <RoleGuard allowedRoles={['admin', 'sales']}>
              <CustomerFormPage />
            </RoleGuard>
          }
        />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route
          path="/customers/:id/edit"
          element={
            <RoleGuard allowedRoles={['admin', 'sales']}>
              <CustomerFormPage />
            </RoleGuard>
          }
        />

        {/* Users - Admin only */}
        <Route
          path="/users"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <UsersPage />
            </RoleGuard>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPageWrapper />} />
        <Route path="/*" element={<PrivateRoutes />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function LoginPageWrapper() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}
