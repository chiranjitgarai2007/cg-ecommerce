import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, MapPin, Phone, Clock, CheckCircle, XCircle, Loader2, UtensilsCrossed, Truck, Search, IndianRupee, ChefHat, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

export interface OrderWithItems {
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
  scheduled_time: string | null;
  estimated_preparation_time: number | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items: {
    id: string;
    quantity: number;
    unit_price: number;
    product_name: string;
    product_image: string | null;
    meal_type?: string | null;
  }[];
  delivery_boy_name?: string;
  delivery_boy_phone?: string;
  delivery_status?: string;
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

const statusLabels: Record<OrderStatus, string> = {
  scheduled: 'Scheduled',
  pending: 'Order Received',
  confirmed: 'Confirmed',
  processing: 'Preparing Food',
  shipped: 'Ready for Pickup',
  picked_up: 'Picked Up',
  on_the_way: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const filterTabs: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New Orders', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Preparing', value: 'processing' },
  { label: 'Ready', value: 'shipped' },
  { label: 'Out for Delivery', value: 'on_the_way' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function SellerOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [needsDeliveryBoy, setNeedsDeliveryBoy] = useState<Record<string, boolean>>({});
  const [prepTime, setPrepTime] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

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
      supabase.from('products').select('id, name, image_url, meal_type').in('id', productIds),
    ]);

    const productsMap = new Map((productsRes.data || []).map(p => [p.id, p]));

    const customerIds = [...new Set((ordersRes.data || []).map(o => o.customer_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', customerIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Fetch delivery boy info
    const { data: deliveries } = await supabase.from('deliveries').select('order_id, delivery_boy_id, status').in('order_id', orderIds);
    const deliveryMap = new Map((deliveries || []).map(d => [d.order_id, d]));

    const deliveryBoyIds = [...new Set((deliveries || []).map(d => d.delivery_boy_id).filter(Boolean))] as string[];
    let deliveryBoyMap = new Map();
    if (deliveryBoyIds.length > 0) {
      const { data: dbProfiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', deliveryBoyIds);
      deliveryBoyMap = new Map((dbProfiles || []).map(p => [p.user_id, p]));
    }

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
            meal_type: product?.meal_type || null,
          };
        });
      const profile = profileMap.get(order.customer_id);
      const delivery = deliveryMap.get(order.id);
      const deliveryBoy = delivery?.delivery_boy_id ? deliveryBoyMap.get(delivery.delivery_boy_id) : null;

      return {
        ...order,
        total_amount: Number(order.total_amount),
        customer_name: profile?.full_name || 'Customer',
        customer_email: profile?.email || '',
        customer_phone: profile?.phone || null,
        items,
        delivery_boy_name: deliveryBoy?.full_name || undefined,
        delivery_boy_phone: deliveryBoy?.phone || undefined,
        delivery_status: delivery?.status || undefined,
      };
    });

    setOrders(enrichedOrders);
    setLoading(false);
  };

  const autoAssignDeliveryBoy = async (orderId: string) => {
    // Get all delivery boys
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery_boy');
    if (!roles?.length) {
      toast.info('No delivery partners available. Admin will assign manually.');
      return;
    }

    const boyIds = roles.map(r => r.user_id);

    // Get approved, non-blocked delivery boys
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, is_blocked, is_approved')
      .in('user_id', boyIds);

    const activeBoys = (profiles || []).filter(p => !p.is_blocked && p.is_approved !== false);
    if (!activeBoys.length) {
      toast.info('No available delivery partners. Admin will assign manually.');
      return;
    }

    // Count active deliveries per boy
    const { data: activeDeliveries } = await supabase
      .from('deliveries')
      .select('delivery_boy_id')
      .in('delivery_boy_id', activeBoys.map(b => b.user_id))
      .in('status', ['assigned', 'accepted', 'picked_up', 'on_the_way']);

    const countMap = new Map<string, number>();
    activeBoys.forEach(b => countMap.set(b.user_id, 0));
    (activeDeliveries || []).forEach(d => {
      if (d.delivery_boy_id) countMap.set(d.delivery_boy_id, (countMap.get(d.delivery_boy_id) || 0) + 1);
    });

    // Pick the one with least active deliveries
    const sorted = activeBoys.sort((a, b) => (countMap.get(a.user_id) || 0) - (countMap.get(b.user_id) || 0));
    const bestBoy = sorted[0];

    // Create delivery record
    const { error: delError } = await supabase.from('deliveries').insert({
      order_id: orderId,
      delivery_boy_id: bestBoy.user_id,
      status: 'assigned',
    });

    if (delError) {
      console.error('Auto-assign failed:', delError.message);
      toast.info('Could not auto-assign. Admin will assign manually.');
      return;
    }

    // Notify the assigned delivery boy
    await supabase.from('notifications').insert({
      user_id: bestBoy.user_id,
      title: 'New Delivery Assigned',
      message: `Order #${orderId.slice(0, 8)} has been assigned to you.`,
      type: 'delivery_assigned',
      related_order_id: orderId,
    });

    toast.success(`Auto-assigned to ${bestBoy.full_name || 'delivery partner'}`);
  };

  const acceptOrder = async (orderId: string) => {
    setUpdatingId(orderId);
    const useDeliveryBoy = needsDeliveryBoy[orderId] ?? false;
    const { error } = await supabase.from('orders').update({
      status: 'confirmed' as OrderStatus,
      seller_delivers: !useDeliveryBoy,
      delivery_type: useDeliveryBoy ? 'delivery_boy' : 'seller',
    }).eq('id', orderId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Order accepted!');
      if (useDeliveryBoy) {
        await autoAssignDeliveryBoy(orderId);
      }
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
    const { data: deliveryBoys } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery_boy');
    if (!deliveryBoys?.length) return;

    await supabase.from('deliveries').insert({
      order_id: order.id,
      delivery_boy_id: null,
      status: 'assigned',
    } as any);

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
    if (error) toast.error(error.message);
    else { toast.success(`Order ${statusLabels[newStatus] || newStatus}`); fetchOrders(); }
    setUpdatingId(null);
  };

  // Today's stats
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
    return {
      total: todayOrders.length,
      pending: todayOrders.filter(o => o.status === 'pending').length,
      completed: todayOrders.filter(o => o.status === 'delivered').length,
      totalSales: todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0),
    };
  }, [orders]);

  // Filtered + searched orders
  const filteredOrders = useMemo(() => {
    let result = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q)
      );
    }
    return result;
  }, [orders, filter, searchQuery]);

  // Preparation queue: sort by order time, meal type deadline
  const preparationQueue = useMemo(() => {
    const activeOrders = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status));
    return activeOrders.sort((a, b) => {
      // Priority: pending > confirmed > processing
      const priorityMap: Record<string, number> = { pending: 0, confirmed: 1, processing: 2 };
      const pDiff = (priorityMap[a.status] ?? 9) - (priorityMap[b.status] ?? 9);
      if (pDiff !== 0) return pDiff;
      // Then by creation time
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

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
        actions.push({ label: 'Start Preparing', handler: () => startProcessing(order.id), variant: 'default', icon: <ChefHat className="w-4 h-4" />, showPrepTime: true });
        break;
      case 'processing':
        if (order.delivery_type === 'seller' || order.seller_delivers) {
          actions.push({ label: 'Ready & Out for Delivery', handler: () => updateOrderStatus(order.id, 'shipped'), variant: 'default', icon: <Truck className="w-4 h-4" /> });
        } else {
          actions.push({ label: 'Ready for Pickup', handler: () => updateOrderStatus(order.id, 'shipped'), variant: 'default', icon: <Package className="w-4 h-4" /> });
        }
        break;
      case 'shipped':
        if (order.delivery_type === 'seller' || order.seller_delivers) {
          actions.push({ label: 'Out for Delivery', handler: () => updateOrderStatus(order.id, 'on_the_way'), variant: 'default', icon: <Truck className="w-4 h-4" /> });
        }
        break;
      case 'on_the_way':
        if (order.delivery_type === 'seller' || order.seller_delivers) {
          actions.push({ label: 'Mark Delivered', handler: () => updateOrderStatus(order.id, 'delivered'), variant: 'default', icon: <CheckCircle className="w-4 h-4" /> });
        }
        break;
    }
    return actions;
  };

  const getMealType = (order: OrderWithItems) => {
    const types = [...new Set(order.items.map(i => i.meal_type).filter(Boolean))];
    return types.length > 0 ? types.join(', ') : null;
  };

  return (
    <DashboardLayout title="Order Management" navItems={navItems}>
      <div className="space-y-6">
        {/* Today's Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Orders", value: todayStats.total, icon: <ShoppingBag className="w-5 h-5 text-primary" />, color: 'text-foreground' },
            { label: 'Pending Orders', value: todayStats.pending, icon: <Clock className="w-5 h-5 text-yellow-500" />, color: 'text-yellow-600' },
            { label: 'Completed', value: todayStats.completed, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: 'text-green-600' },
            { label: "Today's Sales", value: `₹${todayStats.totalSales.toLocaleString()}`, icon: <IndianRupee className="w-5 h-5 text-primary" />, color: 'text-primary' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
              <div className="bg-muted rounded-lg p-2">{stat.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Order ID, Customer Name or Phone..."
              className="pl-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <Button
              key={tab.value}
              variant={filter === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {tab.value !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({orders.filter(o => o.status === tab.value).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Preparation Queue Banner */}
        {preparationQueue.length > 0 && filter === 'all' && (
          <div className="bg-accent/30 border border-accent rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-foreground">Preparation Queue</h3>
              <Badge variant="secondary">{preparationQueue.length} orders</Badge>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {preparationQueue.slice(0, 5).map(order => (
                <div
                  key={order.id}
                  className="flex-shrink-0 bg-card border border-border rounded-lg p-3 min-w-[200px] cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/seller/orders/${order.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[order.status]}`}>
                      {statusLabels[order.status]}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{order.customer_name}</p>
                  {getMealType(order) && (
                    <p className="text-xs text-muted-foreground">{getMealType(order)}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders list */}
        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-medium text-foreground mb-1">No Orders Yet</p>
            <p className="text-sm text-muted-foreground">Orders from customers will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const actions = getActions(order);
              const mealType = getMealType(order);
              return (
                <div key={order.id} className="bg-card border border-border rounded-xl p-5 space-y-4 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                      {mealType && (
                        <Badge variant="outline" className="text-xs">
                          <UtensilsCrossed className="w-3 h-3 mr-1" />{mealType}
                        </Badge>
                      )}
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
                    {(order.contact_number || order.customer_phone) && (
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{order.contact_number || order.customer_phone}</span>
                    )}
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

                  {/* Delivery Boy Info */}
                  {order.delivery_boy_name && (
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Delivery Boy: {order.delivery_boy_name}</p>
                        {order.delivery_boy_phone && <p className="text-xs text-muted-foreground">{order.delivery_boy_phone}</p>}
                      </div>
                      {order.delivery_status && (
                        <Badge variant="outline" className="text-xs capitalize">{order.delivery_status.replace('_', ' ')}</Badge>
                      )}
                    </div>
                  )}

                  {/* Delivery boy toggle — only shown for pending orders */}
                  {order.status === 'pending' && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                      <Truck className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <Label htmlFor={`db-${order.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                          Need a Delivery Boy?
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {needsDeliveryBoy[order.id] ? 'A delivery partner will be notified' : 'You will deliver personally (no delivery charge)'}
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

                  {/* Prep time input for confirmed orders */}
                  {order.status === 'confirmed' && (
                    <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                      <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex-1">
                        <Label htmlFor={`prep-${order.id}`} className="text-sm font-medium text-foreground">
                          Est. Preparation Time (minutes)
                        </Label>
                      </div>
                      <Input
                        id={`prep-${order.id}`}
                        type="number"
                        min="1"
                        max="180"
                        placeholder="30"
                        className="w-20 h-8 text-sm"
                        value={prepTime[order.id] || ''}
                        onChange={(e) => setPrepTime(prev => ({ ...prev, [order.id]: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-bold text-foreground text-base">₹{order.total_amount.toLocaleString()}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Payment: </span>
                        <span className="font-medium text-foreground">{order.payment_method.toUpperCase()} ({order.payment_status})</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/seller/orders/${order.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
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
