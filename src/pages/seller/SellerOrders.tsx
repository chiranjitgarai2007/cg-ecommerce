import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, MapPin, Phone, Clock, CheckCircle, XCircle, Loader2, UtensilsCrossed, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

interface OrderWithItems {
  id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  contact_number: string | null;
  landmark: string | null;
  delivery_type: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  customer_id: string;
  seller_delivers: boolean | null;
  food_preferences: string | null;
  scheduled_date: string | null;
  customer_name?: string;
  customer_email?: string;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    product_name: string;
    product_image: string | null;
  }[];
}

const navItems = [
  { label: 'My Products', path: '/', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/seller/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/seller/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'Customer Bills', path: '/seller/billing', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Analytics', path: '/seller/analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

const statusColors: Record<OrderStatus, string> = {
  scheduled: 'bg-violet-100 text-violet-800 border-violet-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-purple-100 text-purple-800 border-purple-200',
  shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  picked_up: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  on_the_way: 'bg-orange-100 text-orange-800 border-orange-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  returned: 'bg-gray-100 text-gray-800 border-gray-200',
};

const filterTabs: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function SellerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // Track per-order delivery boy toggle (used when accepting pending orders)
  const [needsDeliveryBoy, setNeedsDeliveryBoy] = useState<Record<string, boolean>>({});
  const [prepTime, setPrepTime] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('seller-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (user) fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    const { data: orderItems, error: oiError } = await supabase
      .from('order_items')
      .select('id, order_id, quantity, unit_price, product_id')
      .eq('seller_id', user.id);

    if (oiError || !orderItems?.length) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];
    const productIds = [...new Set(orderItems.map(oi => oi.product_id).filter(Boolean))] as string[];

    const [ordersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').in('id', orderIds).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, image_url').in('id', productIds),
    ]);

    const productsMap = new Map((productsRes.data || []).map(p => [p.id, p]));

    const customerIds = [...new Set((ordersRes.data || []).map(o => o.customer_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', customerIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enrichedOrders: OrderWithItems[] = (ordersRes.data || []).map(order => {
      const items = orderItems
        .filter(oi => oi.order_id === order.id)
        .map(oi => {
          const product = oi.product_id ? productsMap.get(oi.product_id) : null;
          return {
            id: oi.id,
            quantity: oi.quantity,
            unit_price: Number(oi.unit_price),
            product_name: product?.name || 'Unknown Product',
            product_image: product?.image_url || null,
          };
        });
      const profile = profileMap.get(order.customer_id);
      return {
        ...order,
        total_amount: Number(order.total_amount),
        customer_name: profile?.full_name || 'Customer',
        customer_email: profile?.email || '',
        items,
      };
    });

    setOrders(enrichedOrders);
    setLoading(false);
  };

  const acceptOrder = async (orderId: string) => {
    setUpdatingId(orderId);
    const useDeliveryBoy = needsDeliveryBoy[orderId] ?? false;

    // Update order with seller's delivery decision
    const { error } = await supabase.from('orders').update({
      status: 'confirmed' as OrderStatus,
      seller_delivers: !useDeliveryBoy,
      delivery_type: useDeliveryBoy ? 'delivery_boy' : 'seller',
    }).eq('id', orderId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Order accepted!');
      fetchOrders();
    }
    setUpdatingId(null);
  };

  const startProcessing = async (orderId: string) => {
    setUpdatingId(orderId);
    const estPrepTime = prepTime[orderId] ? parseInt(prepTime[orderId]) : null;
    const updateData: Record<string, unknown> = { status: 'processing' as OrderStatus };
    if (estPrepTime && estPrepTime > 0) updateData.estimated_preparation_time = estPrepTime;

    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);

    if (error) {
      toast.error(error.message);
    } else {
      const order = orders.find(o => o.id === orderId);
      if (order && order.delivery_type === 'delivery_boy') {
        await notifyDeliveryBoys(order);
      }
      toast.success('Order is now being prepared');
      fetchOrders();
    }
    setUpdatingId(null);
  };

  const notifyDeliveryBoys = async (order: OrderWithItems) => {
    // Find all delivery boys
    const { data: deliveryBoys } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery_boy');

    if (!deliveryBoys?.length) return;

    // Create delivery record (unassigned)
    await supabase.from('deliveries').insert({
      order_id: order.id,
      delivery_boy_id: null,
      status: 'assigned',
    } as any);

    // Send notification to all delivery boys
    const notifications = deliveryBoys.map(db => ({
      user_id: db.user_id,
      title: 'New Delivery Available',
      message: `Order #${order.id.slice(0, 8)} is ready for pickup. Deliver to: ${order.shipping_address.slice(0, 50)}`,
      type: 'delivery_available',
      related_order_id: order.id,
    }));

    await supabase.from('notifications').insert(notifications);
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Order ${newStatus.replace('_', ' ')}`);
      fetchOrders();
    }
    setUpdatingId(null);
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const getActions = (order: OrderWithItems) => {
    const actions: { label: string; handler: () => void; variant: 'default' | 'destructive' | 'outline'; icon: React.ReactNode; showPrepTime?: boolean }[] = [];
    switch (order.status) {
      case 'pending':
        actions.push(
          { label: 'Accept', handler: () => acceptOrder(order.id), variant: 'default', icon: <CheckCircle className="w-4 h-4" /> },
          { label: 'Reject', handler: () => updateOrderStatus(order.id, 'cancelled'), variant: 'destructive', icon: <XCircle className="w-4 h-4" /> },
        );
        break;
      case 'confirmed':
        actions.push({ label: 'Start Preparing', handler: () => startProcessing(order.id), variant: 'default', icon: <Loader2 className="w-4 h-4" />, showPrepTime: true });
        break;
      case 'processing':
        if (order.delivery_type === 'seller' || order.seller_delivers) {
          // Seller delivers personally — mark as shipped directly
          actions.push({ label: 'Packed & Out for Delivery', handler: () => updateOrderStatus(order.id, 'shipped'), variant: 'default', icon: <Truck className="w-4 h-4" /> });
        } else {
          // Waiting for delivery boy pickup
          actions.push({ label: 'Packed (Waiting for Pickup)', handler: () => updateOrderStatus(order.id, 'shipped'), variant: 'default', icon: <Package className="w-4 h-4" /> });
        }
        break;
    }
    return actions;
  };

  return (
    <DashboardLayout title="Seller Orders" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders', value: orders.length, color: 'text-foreground' },
            { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'text-yellow-600' },
            { label: 'Processing', value: orders.filter(o => ['confirmed', 'processing'].includes(o.status)).length, color: 'text-primary' },
            { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: 'text-green-600' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <Button
              key={tab.value}
              variant={filter === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-lg">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const actions = getActions(order);
              return (
                <div key={order.id} className="bg-card border border-border rounded-lg p-5 space-y-4">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[order.status]}>{order.status.replace('_', ' ')}</Badge>
                      {order.delivery_type === 'delivery_boy' && (
                        <Badge variant="outline" className="text-xs"><Truck className="w-3 h-3 mr-1" />Delivery Boy</Badge>
                      )}
                      {(order.seller_delivers || order.delivery_type === 'seller') && (
                        <Badge variant="outline" className="text-xs"><User className="w-3 h-3 mr-1" />Self Deliver</Badge>
                      )}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{order.customer_name}</span>
                    {order.contact_number && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{order.contact_number}</span>}
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{order.shipping_address.slice(0, 40)}...</span>
                    {order.scheduled_date && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(order.scheduled_date).toLocaleDateString()}</span>
                    )}
                  </div>

                  {/* Food preferences */}
                  {order.food_preferences && (
                    <div className="bg-muted/50 rounded-md p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">🍽️ Customer Preferences:</p>
                      <p className="text-foreground">{order.food_preferences}</p>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-muted/50 rounded-md p-2">
                        <div className="w-10 h-10 rounded bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.product_image ? <img src={item.product_image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item.unit_price}</p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">₹{(item.quantity * item.unit_price).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {/* Delivery boy toggle — only shown for pending orders */}
                  {order.status === 'pending' && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                      <Truck className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <Label htmlFor={`db-${order.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                          Need a Delivery Boy?
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {needsDeliveryBoy[order.id] ? 'A delivery partner will be notified when packing is done' : 'You will deliver this order personally (no delivery charge)'}
                        </p>
                      </div>
                      <Switch
                        id={`db-${order.id}`}
                        checked={needsDeliveryBoy[order.id] ?? false}
                        onCheckedChange={(checked) =>
                          setNeedsDeliveryBoy(prev => ({ ...prev, [order.id]: checked }))
                        }
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-bold text-foreground">₹{order.total_amount.toLocaleString()}</span>
                      <span className="ml-3 text-muted-foreground">Payment: </span>
                      <span className="font-medium text-foreground">{order.payment_method.toUpperCase()} ({order.payment_status})</span>
                    </div>
                    {actions.length > 0 && (
                      <div className="flex gap-2">
                        {actions.map((action, idx) => (
                          <Button
                            key={idx}
                            variant={action.variant}
                            size="sm"
                            disabled={updatingId === order.id}
                            onClick={action.handler}
                          >
                            {updatingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
