import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Package, MapPin, Phone, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-violet-100 text-violet-800',
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-primary/10 text-primary',
  processing: 'bg-primary/10 text-primary',
  shipped: 'bg-accent text-accent-foreground',
  picked_up: 'bg-accent text-accent-foreground',
  on_the_way: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
  returned: 'bg-muted text-muted-foreground',
};

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

interface OrderWithItems {
  id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  created_at: string;
  payment_method: string;
  delivery_type: string;
  estimated_delivery_date: string | null;
  contact_number: string | null;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    product: { name: string; image_url: string | null } | null;
    seller_id: string | null;
  }[];
  sellerPhones: Record<string, string>;
}

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (user) fetchOrders();

    // Realtime subscription
    const channel = supabase
      .channel('my-orders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        if (user) fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const enriched: OrderWithItems[] = [];
    for (const order of ordersData) {
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, quantity, unit_price, seller_id, product:products(name, image_url)')
        .eq('order_id', order.id);

      const sellerIds = [...new Set((itemsData || []).map(i => i.seller_id).filter(Boolean))] as string[];
      const sellerPhones: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase.from('profiles').select('user_id, phone').in('user_id', sellerIds);
        (sellers || []).forEach(s => { if (s.phone) sellerPhones[s.user_id] = s.phone; });
      }

      enriched.push({
        ...order,
        items: (itemsData || []).map((i: any) => ({ ...i, product: i.product })),
        sellerPhones,
      });
    }
    setOrders(enriched);
    setLoading(false);
  };

  const cancelOrder = async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled' as OrderStatus }).eq('id', orderId);
    if (error) toast.error('Failed to cancel');
    else { toast.success('Order cancelled'); fetchOrders(); }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">My Orders</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTER_OPTIONS.map(f => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.value)}
              className="flex-shrink-0"
            >
              {f.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-foreground font-medium">No orders found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => (
              <div key={order.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Order Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Items */}
                <div className="p-4 space-y-3">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : <Package className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.product?.name || 'Product'}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity} · ₹{item.unit_price}</p>
                        {item.seller_id && order.sellerPhones[item.seller_id] && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{order.sellerPhones[item.seller_id]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className="px-4 py-3 border-t border-border space-y-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{order.shipping_address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="capitalize">{order.delivery_type} delivery</span>
                    {order.estimated_delivery_date && (
                      <span>· Est. {new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="font-heading font-bold text-primary">₹{order.total_amount}</p>
                    <div className="flex gap-2">
                      {!['delivered', 'cancelled', 'returned'].includes(order.status) && (
                        <Button variant="outline" size="sm" onClick={() => cancelOrder(order.id)}>
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" onClick={() => navigate(`/track-order/${order.id}`)}>
                        Track
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
