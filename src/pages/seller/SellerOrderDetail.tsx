import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, MapPin, Phone, Clock, CheckCircle, XCircle, Loader2, UtensilsCrossed, Truck, ArrowLeft, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type { OrderWithItems } from './SellerOrders';
import OtpVerification from '@/components/delivery/OtpVerification';

type OrderStatus = Database['public']['Enums']['order_status'];

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

const statusFlow: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'picked_up', 'on_the_way', 'delivered'];

interface StatusLog {
  id: string;
  status: string;
  created_at: string;
  note: string | null;
}

export default function SellerOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);

  useEffect(() => {
    if (user && orderId) fetchOrder();
  }, [user, orderId]);

  const fetchOrder = async () => {
    if (!user || !orderId) return;

    const { data: orderData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !orderData) {
      toast.error('Order not found');
      navigate('/seller/orders');
      return;
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, quantity, unit_price, product_id')
      .eq('order_id', orderId)
      .eq('seller_id', user.id);

    if (!orderItems?.length) {
      toast.error('This order does not belong to you');
      navigate('/seller/orders');
      return;
    }

    const productIds = orderItems.map(oi => oi.product_id).filter(Boolean) as string[];
    const [productsRes, profileRes, deliveryRes, logsRes] = await Promise.all([
      supabase.from('products').select('id, name, image_url, meal_type').in('id', productIds),
      supabase.from('profiles').select('user_id, full_name, email, phone').eq('user_id', orderData.customer_id).single(),
      supabase.from('deliveries').select('id, delivery_boy_id, status').eq('order_id', orderId).maybeSingle(),
      supabase.from('order_status_log').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    ]);

    const productsMap = new Map((productsRes.data || []).map(p => [p.id, p]));

    const items = orderItems.map(oi => {
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

    // Delivery boy info
    let deliveryBoyName: string | undefined;
    let deliveryBoyPhone: string | undefined;
    if (deliveryRes.data?.delivery_boy_id) {
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', deliveryRes.data.delivery_boy_id)
        .single();
      deliveryBoyName = dbProfile?.full_name || undefined;
      deliveryBoyPhone = dbProfile?.phone || undefined;
    }

    if (deliveryRes.data?.id) {
      setDeliveryId(deliveryRes.data.id);
    }

    setOrder({
      ...orderData,
      total_amount: Number(orderData.total_amount),
      customer_name: profileRes.data?.full_name || 'Customer',
      customer_email: profileRes.data?.email || '',
      customer_phone: profileRes.data?.phone || null,
      items,
      delivery_boy_name: deliveryBoyName,
      delivery_boy_phone: deliveryBoyPhone,
      delivery_status: deliveryRes.data?.status || undefined,
    });

    setStatusLogs(logsRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    setUpdatingStatus(newStatus);
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    if (error) {
      toast.error(error.message);
    } else {
      // Generate OTP when seller self-delivers and moves to on_the_way
      if (newStatus === 'on_the_way' && (order.seller_delivers || order.delivery_type === 'seller')) {
        let delId = deliveryId;
        if (!delId) {
          const { data: newDel } = await supabase
            .from('deliveries')
            .insert({ order_id: order.id, delivery_boy_id: user!.id, status: 'on_the_way' })
            .select('id')
            .single();
          delId = newDel?.id || null;
          if (delId) setDeliveryId(delId);
        }
        if (delId) {
          const { data: otpResult } = await supabase.rpc('generate_delivery_otp', {
            _order_id: order.id,
            _delivery_id: delId,
          });
          if (otpResult) {
            await supabase.from('notifications').insert({
              user_id: order.customer_id,
              title: 'Delivery OTP',
              message: `Your delivery OTP is: ${otpResult}. Share it with the delivery person to confirm delivery.`,
              type: 'delivery_otp',
              related_order_id: order.id,
            });
          }
        }
      }
      toast.success(`Order ${statusLabels[newStatus]}`);
      fetchOrder();
    }
    setUpdatingStatus(null);
  };

  const currentStatusIndex = order ? statusFlow.indexOf(order.status) : -1;

  if (loading) {
    return (
      <DashboardLayout title="Order Details" navItems={navItems}>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  if (!order) return null;

  const mealTypes = [...new Set(order.items.map(i => i.meal_type).filter(Boolean))];

  return (
    <DashboardLayout title="Order Details" navItems={navItems}>
      <div className="space-y-6">
        {/* Back button + header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/seller/orders')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Button>
          <Badge className={`text-sm px-3 py-1 ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-heading font-semibold text-foreground mb-1">Order #{order.id.slice(0, 8)}</h2>
              <p className="text-sm text-muted-foreground mb-4">{new Date(order.created_at).toLocaleString()}</p>

              {mealTypes.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <UtensilsCrossed className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Meal Type: {mealTypes.join(', ')}</span>
                </div>
              )}

              {order.food_preferences && (
                <div className="bg-muted/50 rounded-md p-3 text-sm mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">🍽️ Customer Preferences:</p>
                  <p className="text-foreground">{order.food_preferences}</p>
                </div>
              )}

              {/* Items */}
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">ITEMS ORDERED</h3>
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {item.product_image ? <img src={item.product_image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item.unit_price}</p>
                    </div>
                    <p className="font-semibold text-foreground">₹{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="font-medium text-muted-foreground">Total Amount</span>
                <span className="text-xl font-bold text-foreground">₹{order.total_amount.toLocaleString()}</span>
              </div>
            </div>

            {/* Status Controls */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-primary" />
                Update Order Status
              </h3>
              {order.status === 'cancelled' || order.status === 'delivered' ? (
                <p className="text-sm text-muted-foreground">This order is {statusLabels[order.status].toLowerCase()}.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {statusFlow.map((status, idx) => {
                      const isActive = order.status === status;
                      const isPast = idx < currentStatusIndex;
                      const isNext = idx === currentStatusIndex + 1;
                      const isSellerDelivery = order.delivery_type === 'seller' || order.seller_delivers;
                      const isDeliveryStep = ['picked_up', 'on_the_way', 'delivered'].includes(status);
                      // Block "delivered" button - OTP verification handles it
                      const needsOtp = status === 'delivered' && order.status === 'on_the_way' && isSellerDelivery;
                      const canClick = isNext && (!isDeliveryStep || isSellerDelivery) && !needsOtp;

                      return (
                        <Button
                          key={status}
                          variant={isActive ? 'default' : isPast ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={!canClick || !!updatingStatus}
                          onClick={() => canClick && updateStatus(status)}
                          className={`${isActive ? '' : isPast ? 'opacity-60' : ''}`}
                        >
                          {updatingStatus === status ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          {isPast && <CheckCircle className="w-3 h-3 mr-1" />}
                          {statusLabels[status]}
                        </Button>
                      );
                    })}
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!!updatingStatus}
                      onClick={() => updateStatus('cancelled')}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel Order
                    </Button>
                  </div>

                  {/* OTP Verification for seller self-delivery */}
                  {order.status === 'on_the_way' && (order.seller_delivers || order.delivery_type === 'seller') && deliveryId && !otpVerified && (
                    <OtpVerification
                      orderId={order.id}
                      deliveryId={deliveryId}
                      onVerified={() => {
                        setOtpVerified(true);
                        updateStatus('delivered');
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Order Timeline */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Order Timeline
              </h3>
              {statusLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status updates yet.</p>
              ) : (
                <div className="space-y-0">
                  {statusLogs.map((log, idx) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${idx === statusLogs.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                        {idx < statusLogs.length - 1 && <div className="w-0.5 h-8 bg-muted-foreground/20" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-foreground capitalize">{log.status.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        {log.note && <p className="text-xs text-muted-foreground mt-0.5">{log.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Customer Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                </div>
                {(order.contact_number || order.customer_phone) && (
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {order.contact_number || order.customer_phone}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Delivery Address</p>
                  <p className="font-medium text-foreground flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {order.shipping_address}
                  </p>
                </div>
                {order.landmark && (
                  <div>
                    <p className="text-muted-foreground text-xs">Landmark</p>
                    <p className="font-medium text-foreground">{order.landmark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3">Payment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium text-foreground">{order.payment_method.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                    {order.payment_status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Delivery
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium text-foreground capitalize">
                    {order.seller_delivers || order.delivery_type === 'seller' ? 'Self Delivery' : 'Delivery Boy'}
                  </span>
                </div>
                {order.delivery_boy_name && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Boy</span>
                      <span className="font-medium text-foreground">{order.delivery_boy_name}</span>
                    </div>
                    {order.delivery_boy_phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium text-foreground">{order.delivery_boy_phone}</span>
                      </div>
                    )}
                    {order.delivery_status && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className="text-xs capitalize">{order.delivery_status.replace('_', ' ')}</Badge>
                      </div>
                    )}
                  </>
                )}
                {order.estimated_preparation_time && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prep Time</span>
                    <span className="font-medium text-foreground">{order.estimated_preparation_time} min</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
