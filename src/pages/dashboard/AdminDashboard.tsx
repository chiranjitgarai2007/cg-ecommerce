import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Package, ShoppingBag, BarChart3, Settings, Layers, Truck, DollarSign, Shield, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';
import AdminDeliveryManagement from '@/components/admin/AdminDeliveryManagement';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

const navItems = [
  { label: 'Overview', path: '/', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Users', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
  { label: 'Products', path: '/admin/products', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/admin/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Categories', path: '/admin/categories', icon: <Layers className="w-4 h-4" /> },
  { label: 'Deliveries', path: '/admin/deliveries', icon: <Truck className="w-4 h-4" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
];

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [p, pr, o] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('products').select('*'),
      supabase.from('orders').select('*'),
    ]);
    setProfiles(p.data || []);
    setProducts(pr.data || []);
    setOrders(o.data || []);
    setLoading(false);
  };

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_blocked: !isBlocked }).eq('user_id', userId);
    if (error) toast.error(error.message);
    else { toast.success(isBlocked ? 'User unblocked' : 'User blocked'); fetchAll(); }
  };

  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);

  return (
    <DashboardLayout title="Admin Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="w-4 h-4" /><span className="text-sm">Users</span></div>
            <p className="text-2xl font-heading font-bold text-foreground">{profiles.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Package className="w-4 h-4" /><span className="text-sm">Products</span></div>
            <p className="text-2xl font-heading font-bold text-foreground">{products.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><ShoppingBag className="w-4 h-4" /><span className="text-sm">Orders</span></div>
            <p className="text-2xl font-heading font-bold text-foreground">{orders.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /><span className="text-sm">Revenue</span></div>
            <p className="text-2xl font-heading font-bold text-primary">₹{totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
            ) : profiles.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No users yet</p>
            ) : (
              <div className="space-y-2">
                {profiles.map(p => (
                  <div key={p.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{p.full_name || p.store_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.is_blocked && <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">Blocked</span>}
                      <Button size="sm" variant={p.is_blocked ? "default" : "outline"} onClick={() => toggleBlock(p.user_id, !!p.is_blocked)}>
                        {p.is_blocked ? <><Shield className="w-3 h-3 mr-1" /> Unblock</> : <><Ban className="w-3 h-3 mr-1" /> Block</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            {products.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No products yet</p>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-sm text-muted-foreground">₹{p.price} · Stock: {p.stock}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {orders.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {orders.map(o => (
                  <div key={o.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Order #{o.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">₹{o.total_amount} · {new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground capitalize">{o.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deliveries" className="mt-4">
            <AdminDeliveryManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
