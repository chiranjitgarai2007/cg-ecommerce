import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Truck, User, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { EnrichedDelivery, DeliveryStatus } from '@/types/delivery';
import DeliveryStatsCards from '@/components/delivery/DeliveryStatsCards';
import DeliveryCard from '@/components/delivery/DeliveryCard';
import GpsLocationTracker from '@/components/delivery/GpsLocationTracker';

const navItems = [
  { label: 'Active Deliveries', path: '/', icon: <Truck className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

const statusFlow: Record<string, DeliveryStatus> = {
  assigned: 'accepted',
  accepted: 'picked_up',
  picked_up: 'on_the_way',
  on_the_way: 'delivered',
};

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<EnrichedDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchDeliveries(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('delivery-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        if (user) fetchDeliveries();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchDeliveries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('delivery_boy_id', user.id)
      .order('created_at', { ascending: false });

    if (!data?.length) { setDeliveries([]); setLoading(false); return; }

    const orderIds = data.map(d => d.order_id);
    const [ordersRes, orderItemsRes] = await Promise.all([
      supabase.from('orders').select('id, shipping_address, contact_number, landmark, total_amount, customer_id, latitude, longitude').in('id', orderIds),
      supabase.from('order_items').select('order_id, quantity, product_id').in('order_id', orderIds),
    ]);

    const customerIds = [...new Set((ordersRes.data || []).map(o => o.customer_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', customerIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    const productIds = [...new Set((orderItemsRes.data || []).map(oi => oi.product_id).filter(Boolean))] as string[];
    const { data: products } = await supabase.from('products').select('id, name, seller_id').in('id', productIds);
    const prodMap = new Map((products || []).map(p => [p.id, p]));

    const sellerIds = [...new Set((products || []).map(p => p.seller_id))];
    const { data: sellerProfiles } = await supabase.from('profiles').select('user_id, business_address, store_name').in('user_id', sellerIds);
    const sellerMap = new Map((sellerProfiles || []).map(s => [s.user_id, s]));

    // Get seller addresses (lat/lng) if available
    const { data: sellerAddresses } = await supabase.from('addresses').select('user_id, latitude, longitude').in('user_id', sellerIds).eq('is_default', true);
    const sellerAddrMap = new Map((sellerAddresses || []).map(a => [a.user_id, a]));

    const enriched: EnrichedDelivery[] = data.map(d => {
      const order = (ordersRes.data || []).find(o => o.id === d.order_id);
      const items = (orderItemsRes.data || []).filter(oi => oi.order_id === d.order_id);
      const prodDetails = items.map(oi => {
        const prod = oi.product_id ? prodMap.get(oi.product_id) : null;
        return { name: prod?.name || 'Unknown', quantity: oi.quantity };
      });
      const firstProd = items[0]?.product_id ? prodMap.get(items[0].product_id) : null;
      const seller = firstProd ? sellerMap.get(firstProd.seller_id) : null;
      const sellerAddr = firstProd ? sellerAddrMap.get(firstProd.seller_id) : null;

      return {
        ...d,
        order: order ? {
          shipping_address: order.shipping_address,
          contact_number: order.contact_number,
          landmark: order.landmark,
          total_amount: Number(order.total_amount),
          customer_name: profileMap.get(order.customer_id) || 'Customer',
          latitude: order.latitude,
          longitude: order.longitude,
        } : undefined,
        seller_address: seller?.business_address || seller?.store_name || 'Seller location',
        seller_latitude: sellerAddr?.latitude || null,
        seller_longitude: sellerAddr?.longitude || null,
        products: prodDetails,
      };
    });

    setDeliveries(enriched);
    setLoading(false);
  };

  const updateStatus = async (id: string, currentStatus: string) => {
    const next = statusFlow[currentStatus];
    if (!next) return;
    const updates: Record<string, unknown> = { status: next };
    if (next === 'picked_up') updates.picked_up_at = new Date().toISOString();
    if (next === 'delivered') updates.delivered_at = new Date().toISOString();

    const { error } = await supabase.from('deliveries').update(updates).eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Status updated!');
      const delivery = deliveries.find(d => d.id === id);
      if (delivery) {
        const orderStatusMap: Record<string, string> = {
          picked_up: 'picked_up',
          on_the_way: 'on_the_way',
          delivered: 'delivered',
        };
        const mappedStatus = orderStatusMap[next] as Database['public']['Enums']['order_status'] | undefined;
        if (mappedStatus) {
          await supabase.from('orders').update({ status: mappedStatus }).eq('id', delivery.order_id);
        }

        // Generate OTP when status changes to on_the_way
        if (next === 'on_the_way') {
          const { data: otpResult, error: otpError } = await supabase.rpc('generate_delivery_otp', {
            _order_id: delivery.order_id,
            _delivery_id: delivery.id,
          });
          if (otpError) {
            console.error('OTP generation failed:', otpError.message);
          } else {
            // Notify customer about OTP
            const order = (await supabase.from('orders').select('customer_id').eq('id', delivery.order_id).single()).data;
            if (order) {
              await supabase.from('notifications').insert({
                user_id: order.customer_id,
                title: 'Delivery OTP',
                message: `Your delivery OTP is: ${otpResult}. Share it with the delivery person to confirm delivery.`,
                type: 'delivery_otp',
                related_order_id: delivery.order_id,
              });
            }
          }
        }
      }
      fetchDeliveries();
    }
  };

  const rejectDelivery = async (id: string) => {
    const { error } = await supabase.from('deliveries').update({ status: 'rejected' as DeliveryStatus }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Delivery rejected'); fetchDeliveries(); }
  };

  const active = deliveries.filter(d => !['delivered', 'rejected'].includes(d.status));
  const completed = deliveries.filter(d => d.status === 'delivered');

  return (
    <DashboardLayout title="Delivery Dashboard" navItems={navItems}>
      <div className="space-y-6">
        <DeliveryStatsCards active={active} completed={completed} total={deliveries.length} />
        
        <GpsLocationTracker hasActiveDeliveries={active.length > 0} />

        <h3 className="text-lg font-heading font-semibold text-foreground">Active Deliveries</h3>

        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : active.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No active deliveries</p>
            <p className="text-sm text-muted-foreground">New deliveries will appear here when assigned</p>
          </div>
        ) : (
          <div className="space-y-4">
            {active.map(d => (
              <DeliveryCard key={d.id} delivery={d} onUpdateStatus={updateStatus} onReject={rejectDelivery} />
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <>
            <h3 className="text-lg font-heading font-semibold text-foreground">Completed</h3>
            <div className="space-y-2">
              {completed.slice(0, 10).map(d => (
                <div key={d.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Order #{d.order_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">Delivered {d.delivered_at ? new Date(d.delivered_at).toLocaleString() : ''}</p>
                  </div>
                  <Badge className="bg-success text-success-foreground">Delivered</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
