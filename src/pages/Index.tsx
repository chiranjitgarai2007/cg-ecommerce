import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import CustomerDashboard from './dashboard/CustomerDashboard';
import SellerDashboard from './dashboard/SellerDashboard';
import DeliveryDashboard from './dashboard/DeliveryDashboard';
import AdminDashboard from './dashboard/AdminDashboard';

export default function Index() {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Route based on role
  if (roles.includes('admin')) return <AdminDashboard />;
  if (roles.includes('seller')) return <SellerDashboard />;
  if (roles.includes('delivery_boy')) return <DeliveryDashboard />;
  return <CustomerDashboard />;
}
