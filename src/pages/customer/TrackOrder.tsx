import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MapPin, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import TrackingTimeline, { TRACKING_STEPS, type StatusLog } from '@/components/tracking/TrackingTimeline';
import DeliveryLocationCard from '@/components/tracking/DeliveryLocationCard';
import OtpDisplay from '@/components/delivery/OtpDisplay';

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    fetchData(orderId);

    // Real-time: order status changes
    const channel = supabase
      .channel(`track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        setOrder((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_log', filter: `order_id=eq.${orderId}` }, (payload) => {
        setStatusLogs(prev => [...prev, payload.new as StatusLog]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `order_id=eq.${orderId}` }, (payload) => {
        const newDelivery = payload.new as any;
        setDelivery(newDelivery);
        // Fetch delivery boy info if newly assigned
        if (newDelivery?.delivery_boy_id && !deliveryBoy) {
          supabase.from('profiles').select('full_name, phone').eq('user_id', newDelivery.delivery_boy_id).single()
            .then(({ data }) => { if (data) setDeliveryBoy(data); });
        }
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
        <p className="text-muted-foreground">অর্ডার পাওয়া যায়নি</p>
        <Button onClick={() => navigate('/my-orders')}>অর্ডার দেখুন</Button>
      </div>
    );
  }

  const currentIdx = TRACKING_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const progressPercent = isCancelled ? 0 : isDelivered ? 100 : Math.max(5, ((currentIdx + 1) / TRACKING_STEPS.length) * 100);

  const estimatedDate = order.estimated_delivery_date ? new Date(order.estimated_delivery_date) : null;
  const daysLeft = estimatedDate ? Math.max(0, Math.ceil((estimatedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/my-orders')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">অর্ডার ট্র্যাক করুন</h1>
        <span className="text-xs text-muted-foreground font-mono ml-auto">#{order.id.slice(0, 8).toUpperCase()}</span>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-5">
        {/* Progress Bar */}
        {!isCancelled && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>অর্ডার করা হয়েছে</span>
              <span>{isDelivered ? 'ডেলিভারি সম্পন্ন ✓' : TRACKING_STEPS[currentIdx]?.label || 'প্রসেসিং'}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Estimated Info */}
        {!isCancelled && !isDelivered && (
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            {order.estimated_preparation_time && (
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">
                  আনুমানিক প্রস্তুতি: {order.estimated_preparation_time} মিনিট
                </span>
              </div>
            )}
            {estimatedDate && (
              <>
                <p className="text-sm text-muted-foreground">আনুমানিক ডেলিভারি</p>
                <p className="text-lg font-heading font-bold text-foreground">
                  {estimatedDate.toLocaleDateString('bn-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </>
            )}
            {daysLeft > 0 && (
              <p className="text-xs text-primary mt-1">{daysLeft} দিন বাকি</p>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-card border border-border rounded-lg p-5">
          <TrackingTimeline currentStatus={order.status} statusLogs={statusLogs} isCancelled={isCancelled} />
        </div>

        {/* Delivery Boy & Live Location */}
        <DeliveryLocationCard deliveryBoy={deliveryBoy} delivery={delivery} orderStatus={order.status} />

        {/* Delivery Address */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-heading font-semibold text-foreground text-sm mb-2">ডেলিভারি ঠিকানা</h3>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">{order.shipping_address}</p>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-heading font-semibold text-foreground text-sm mb-2">অর্ডার তথ্য</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">মোট</span>
            <span className="font-heading font-bold text-primary">₹{order.total_amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">পেমেন্ট</span>
            <span className="text-foreground capitalize">{order.payment_method === 'cod' ? 'ক্যাশ অন ডেলিভারি' : 'অনলাইন'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ডেলিভারি</span>
            <span className="text-foreground capitalize">{order.delivery_type}</span>
          </div>
        </div>

        {/* Reorder */}
        {isDelivered && (
          <Button className="w-full" variant="outline" onClick={() => navigate('/')}>
            <RefreshCw className="w-4 h-4 mr-2" /> পুনরায় অর্ডার করুন
          </Button>
        )}
      </div>
    </div>
  );
}
