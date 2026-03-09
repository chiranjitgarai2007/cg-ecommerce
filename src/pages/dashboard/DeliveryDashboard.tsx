import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Truck, Clock, CheckCircle, User, DollarSign, Package, MapPin, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Delivery = Database['public']['Tables']['deliveries']['Row'];
type DeliveryStatus = Database['public']['Enums']['delivery_status'];

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

const statusLabels: Record<string, string> = {
  assigned: 'Accept Delivery',
  accepted: 'Mark Picked Up',
  picked_up: 'Start Delivery',
  on_the_way: 'Mark Delivered',
};

interface EnrichedDelivery extends Delivery {
  order?: {
    shipping_address: string;
    contact_number: string | null;
    landmark: string | null;
    total_amount: number;
    customer_name?: string;
  };
  seller_address?: string;
  products?: { name: string; quantity: number }[];
}

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<EnrichedDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchDeliveries(); }, [user]);

  // Realtime for new deliveries
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
      supabase.from('orders').select('id, shipping_address, contact_number, landmark, total_amount, customer_id').in('id', orderIds),
      supabase.from('order_items').select('order_id, quantity, product_id').in('order_id', orderIds),
    ]);

    // Get customer names
    const customerIds = [...new Set((ordersRes.data || []).map(o => o.customer_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', customerIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    // Get product names
    const productIds = [...new Set((orderItemsRes.data || []).map(oi => oi.product_id).filter(Boolean))] as string[];
    const { data: products } = await supabase.from('products').select('id, name, seller_id').in('id', productIds);
    const prodMap = new Map((products || []).map(p => [p.id, p]));

    // Get seller addresses
    const sellerIds = [...new Set((products || []).map(p => p.seller_id))];
    const { data: sellerProfiles } = await supabase.from('profiles').select('user_id, business_address, store_name').in('user_id', sellerIds);
    const sellerMap = new Map((sellerProfiles || []).map(s => [s.user_id, s]));

    const enriched: EnrichedDelivery[] = data.map(d => {
      const order = (ordersRes.data || []).find(o => o.id === d.order_id);
      const items = (orderItemsRes.data || []).filter(oi => oi.order_id === d.order_id);
      const prodDetails = items.map(oi => {
        const prod = oi.product_id ? prodMap.get(oi.product_id) : null;
        return { name: prod?.name || 'Unknown', quantity: oi.quantity };
      });
      // Get seller address from first product
      const firstProd = items[0]?.product_id ? prodMap.get(items[0].product_id) : null;
      const seller = firstProd ? sellerMap.get(firstProd.seller_id) : null;

      return {
        ...d,
        order: order ? {
          shipping_address: order.shipping_address,
          contact_number: order.contact_number,
          landmark: order.landmark,
          total_amount: Number(order.total_amount),
          customer_name: profileMap.get(order.customer_id) || 'Customer',
        } : undefined,
        seller_address: seller?.business_address || seller?.store_name || 'Seller location',
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
      // Also update the order status
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
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-heading font-bold text-primary">{active.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-heading font-bold text-success">{completed.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-heading font-bold text-foreground">{deliveries.length}</p>
          </div>
        </div>

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
              <div key={d.id} className="bg-card border border-border rounded-lg p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-foreground">Order #{d.order_id.slice(0, 8)}</p>
                    <Badge variant="outline" className="mt-1 capitalize">{d.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                </div>

                {/* Product Details */}
                {d.products && d.products.length > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Items:</p>
                    {d.products.map((p, i) => (
                      <p key={i} className="text-sm text-foreground">{p.name} × {p.quantity}</p>
                    ))}
                  </div>
                )}

                {/* Locations */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-foreground">{d.seller_address}</p>
                    </div>
                  </div>
                  {d.order && (
                    <>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Delivery to {d.order.customer_name}</p>
                          <p className="text-foreground">{d.order.shipping_address}</p>
                          {d.order.landmark && <p className="text-xs text-muted-foreground">Landmark: {d.order.landmark}</p>}
                        </div>
                      </div>
                      {d.order.contact_number && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${d.order.contact_number}`} className="text-primary text-sm">{d.order.contact_number}</a>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {statusFlow[d.status] && (
                    <Button size="sm" onClick={() => updateStatus(d.id, d.status)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> {statusLabels[d.status]}
                    </Button>
                  )}
                  {d.status === 'assigned' && (
                    <Button size="sm" variant="destructive" onClick={() => rejectDelivery(d.id)}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed */}
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
