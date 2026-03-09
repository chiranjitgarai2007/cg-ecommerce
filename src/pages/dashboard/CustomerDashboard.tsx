import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingBag, Search, ShoppingCart, Clock, User, Package, UtensilsCrossed, Receipt, CalendarClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

const navItems = [
  { label: 'Browse Products', path: '/', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'My Cart', path: '/cart', icon: <ShoppingCart className="w-4 h-4" /> },
  { label: 'My Orders', path: '/my-orders', icon: <Clock className="w-4 h-4" /> },
  { label: '15-Day Bill', path: '/my-billing', icon: <Receipt className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchProducts();
    if (user) fetchOrders();
  }, [user]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true);
    setProducts(data || []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase.from('orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false });
    setOrders(data || []);
  };

  const addToCart = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    if (!user) return;
    const { error } = await supabase.from('cart_items').upsert(
      { user_id: user.id, product_id: productId, quantity: 1 },
      { onConflict: 'user_id,product_id' }
    );
    if (error) toast.error('Failed to add to cart');
    else toast.success('Added to cart!');
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout title="Shop" navItems={navItems}>
      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Products Available</p>
            <p className="text-2xl font-heading font-bold text-foreground">{products.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">My Orders</p>
            <p className="text-2xl font-heading font-bold text-foreground">{orders.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 col-span-2 md:col-span-1">
            <p className="text-sm text-muted-foreground">Active Orders</p>
            <p className="text-2xl font-heading font-bold text-primary">{orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length}</p>
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products found</p>
            <p className="text-sm text-muted-foreground">Products will appear here once sellers add them</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(product => (
              <div
                key={product.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-foreground text-sm truncate">{product.name}</h3>
                  <p className="text-primary font-heading font-bold mt-1">₹{product.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
                  <Button size="sm" className="w-full mt-2" disabled={product.stock === 0} onClick={(e) => addToCart(e, product.id)}>
                    <ShoppingCart className="w-3 h-3 mr-1" /> Add to Cart
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
