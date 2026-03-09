import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Phone, MapPin, Package, CheckCircle, Truck, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const TRACKING_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'processing', label: 'Preparing', icon: Package },
  { key: 'shipped', label: 'Ready / Shipped', icon: Truck },
  { key: 'picked_up', label: 'Picked Up', icon: Truck },
  { key: 'on_the_way', label: 'On The Way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

interface StatusLog {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) fetchData(orderId);

    const channel = supabase
      .channel(`track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        setOrder((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_log', filter: `order_id=eq.${orderId}` }, (payload) => {
        setStatusLogs(prev => [...prev, payload.new as StatusLog]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const fetchData = async (id: string) => {
    const [orderRes, deliveryRes, logsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('deliveries').select('*').eq('order_id', id).maybeSingle(),
      supabase.from('order_status_log').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    ]);

    setOrder(orderRes.data);
    setDelivery(deliveryRes.data);
    setStatusLogs((logsRes.data || []) as StatusLog[]);

    if (deliveryRes.data?.delivery_boy_id) {
      const { data: boyData } = await supabase.from('profiles').select('full_name, phone').eq('user_id', deliveryRes.data.delivery_boy_id).single();
      setDeliveryBoy(boyData);
    }
    setLoading(false);
  };

  const handleReorder = () => {
    // Navigate to cart — items would need to be re-added
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">Order not found</p>
        <Button onClick={() => navigate('/my-orders')}>Go to Orders</Button>
      </div>
    );
  }

  const currentIdx = TRACKING_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const progressPercent = isCancelled ? 0 : isDelivered ? 100 : Math.max(5, ((currentIdx + 1) / TRACKING_STEPS.length) * 100);

  // Build a map of status → timestamp from logs
  const statusTimestamps: Record<string, string> = {};
  statusLogs.forEach(log => {
    if (!statusTimestamps[log.status]) {
      statusTimestamps[log.status] = log.created_at;
    }
  });

  const estimatedDate = order.estimated_delivery_date ? new Date(order.estimated_delivery_date) : null;
  const now = new Date();
  const diffMs = estimatedDate ? estimatedDate.getTime() - now.getTime() : 0;
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/my-orders')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">Track Order</h1>
        <span className="text-xs text-muted-foreground font-mono ml-auto">#{order.id.slice(0, 8).toUpperCase()}</span>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-6">
        {/* Progress Bar */}
        {!isCancelled && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Order Placed</span>
              <span>{isDelivered ? 'Delivered ✓' : TRACKING_STEPS[currentIdx]?.label || 'Processing'}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Status Card */}
        <div className="bg-card border border-border rounded-lg p-5">
          {isCancelled ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-destructive" />
              </div>
              <p className="text-lg font-heading font-bold text-destructive">Order Cancelled</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                {order.estimated_preparation_time && !isDelivered && (
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary font-medium">
                      Est. prep time: {order.estimated_preparation_time} min
                    </span>
                  </div>
                )}
                {estimatedDate && (
                  <>
                    <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                    <p className="text-lg font-heading font-bold text-foreground">
                      {estimatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </>
                )}
                {daysLeft > 0 && !isDelivered && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary font-medium">{daysLeft} day{daysLeft > 1 ? 's' : ''} remaining</span>
                  </div>
                )}
              </div>

              {/* Timeline with timestamps */}
              <div className="space-y-0">
                {TRACKING_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  const Icon = step.icon;
                  const timestamp = statusTimestamps[step.key];
                  return (
                    <div key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        } ${isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {idx < TRACKING_STEPS.length - 1 && (
                          <div className={`w-0.5 h-8 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {timestamp && (
                          <p className="text-xs text-muted-foreground mt-0.5">{formatTime(timestamp)}</p>
                        )}
                        {isCurrent && !timestamp && (
                          <p className="text-xs text-primary mt-0.5">Current status</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Delivery Boy */}
        {deliveryBoy && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-heading font-semibold text-foreground text-sm mb-3">Delivery Partner</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{deliveryBoy.full_name}</p>
                {deliveryBoy.phone && (
                  <p className="text-xs text-muted-foreground">{deliveryBoy.phone}</p>
                )}
              </div>
              {deliveryBoy.phone && (
                <a href={`tel:${deliveryBoy.phone}`}>
                  <Button variant="outline" size="icon"><Phone className="w-4 h-4" /></Button>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-heading font-semibold text-foreground text-sm mb-2">Delivery Address</h3>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">{order.shipping_address}</p>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-semibold text-foreground text-sm mb-2">Order Info</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-heading font-bold text-primary">₹{order.total_amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment</span>
            <span className="text-foreground capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span className="text-foreground capitalize">{order.delivery_type}</span>
          </div>
        </div>

        {/* Reorder Button */}
        {isDelivered && (
          <Button className="w-full" variant="outline" onClick={handleReorder}>
            <RefreshCw className="w-4 h-4 mr-2" /> Reorder
          </Button>
        )}
      </div>
    </div>
  );
}
