import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, UserCheck, Package, MapPin, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Delivery = Database['public']['Tables']['deliveries']['Row'];

interface DeliveryBoy {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  vehicle_type: string | null;
  activeCount: number;
}

interface EnrichedOrder extends Order {
  delivery?: Delivery | null;
  customer_name?: string;
  otp_verified?: boolean;
  otp_verified_at?: string | null;
}

export default function AdminDeliveryManagement() {
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [selectedBoy, setSelectedBoy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Get orders that need delivery assignment (confirmed/processing/shipped but no delivery or unassigned)
    const { data: allOrders } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['confirmed', 'processing', 'shipped', 'pending'])
      .order('created_at', { ascending: false });

    if (!allOrders?.length) {
      setOrders([]);
      setLoading(false);
      await fetchDeliveryBoys();
      return;
    }

    const orderIds = allOrders.map(o => o.id);

    // Get existing deliveries, customer names, and OTP status
    const [deliveriesRes, customerIds] = await Promise.all([
      supabase.from('deliveries').select('*').in('order_id', orderIds),
      Promise.resolve([...new Set(allOrders.map(o => o.customer_id))]),
    ]);

    const [profilesRes, otpRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', customerIds),
      supabase.from('delivery_otps').select('order_id, is_verified, verified_at').in('order_id', orderIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
    const deliveryMap = new Map((deliveriesRes.data || []).map(d => [d.order_id, d]));
    const otpMap = new Map((otpRes.data || []).map(o => [o.order_id, o]));

    const enriched: EnrichedOrder[] = allOrders.map(o => {
      const otpData = otpMap.get(o.id);
      return {
        ...o,
        delivery: deliveryMap.get(o.id) || null,
        customer_name: profileMap.get(o.customer_id) || 'Customer',
        otp_verified: otpData?.is_verified || false,
        otp_verified_at: otpData?.verified_at || null,
      };
    });

    setOrders(enriched);
    await fetchDeliveryBoys();
    setLoading(false);
  };

  const fetchDeliveryBoys = async () => {
    // Get all delivery boy user IDs
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery_boy');

    if (!roles?.length) { setDeliveryBoys([]); return; }

    const boyIds = roles.map(r => r.user_id);
    const [profilesRes, activeDeliveriesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, phone, vehicle_type, is_blocked, is_approved').in('user_id', boyIds),
      supabase.from('deliveries').select('delivery_boy_id').in('delivery_boy_id', boyIds).in('status', ['assigned', 'accepted', 'picked_up', 'on_the_way']),
    ]);

    const activeCountMap = new Map<string, number>();
    (activeDeliveriesRes.data || []).forEach(d => {
      if (d.delivery_boy_id) {
        activeCountMap.set(d.delivery_boy_id, (activeCountMap.get(d.delivery_boy_id) || 0) + 1);
      }
    });

    const boys: DeliveryBoy[] = (profilesRes.data || [])
      .filter(p => !p.is_blocked)
      .map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        vehicle_type: p.vehicle_type,
        activeCount: activeCountMap.get(p.user_id) || 0,
      }));

    setDeliveryBoys(boys);
  };

  const assignDeliveryBoy = async (orderId: string) => {
    const boyId = selectedBoy[orderId];
    if (!boyId) { toast.error('Please select a delivery partner'); return; }

    // Check if delivery record exists
    const order = orders.find(o => o.id === orderId);
    if (order?.delivery) {
      // Update existing delivery
      const { error } = await supabase
        .from('deliveries')
        .update({ delivery_boy_id: boyId, status: 'assigned' })
        .eq('id', order.delivery.id);
      if (error) { toast.error(error.message); return; }
    } else {
      // Create new delivery
      const { error } = await supabase
        .from('deliveries')
        .insert({ order_id: orderId, delivery_boy_id: boyId, status: 'assigned' });
      if (error) { toast.error(error.message); return; }
    }

    toast.success('Delivery partner assigned!');
    setSelectedBoy(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    fetchData();
  };

  const unassignedOrders = orders.filter(o => !o.delivery || !o.delivery.delivery_boy_id);
  const assignedOrders = orders.filter(o => o.delivery?.delivery_boy_id);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Delivery Boys Overview */}
      <div>
        <h4 className="text-sm font-heading font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <UserCheck className="w-4 h-4" /> Available Delivery Partners ({deliveryBoys.length})
        </h4>
        {deliveryBoys.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-4">No delivery partners registered yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {deliveryBoys.map(boy => (
              <div key={boy.user_id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{boy.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{boy.vehicle_type || 'N/A'} · {boy.phone || 'No phone'}</p>
                </div>
                <Badge variant={boy.activeCount > 0 ? 'default' : 'secondary'}>
                  {boy.activeCount} active
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unassigned Orders */}
      <div>
        <h4 className="text-sm font-heading font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Unassigned Orders ({unassignedOrders.length})
        </h4>
        {unassignedOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-4 text-center">All orders have been assigned</p>
        ) : (
          <div className="space-y-3">
            {unassignedOrders.map(o => (
              <div key={o.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-foreground">Order #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_name} · ₹{o.total_amount}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{o.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{o.shipping_address}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <Select onValueChange={(v) => setSelectedBoy(prev => ({ ...prev, [o.id]: v }))}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Select delivery partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryBoys.map(boy => (
                        <SelectItem key={boy.user_id} value={boy.user_id}>
                          {boy.full_name || 'Unknown'} ({boy.activeCount} active)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => assignDeliveryBoy(o.id)} disabled={!selectedBoy[o.id]}>
                    <Truck className="w-3 h-3 mr-1" /> Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Orders */}
      {assignedOrders.length > 0 && (
        <div>
          <h4 className="text-sm font-heading font-semibold text-muted-foreground mb-3">
            Assigned Orders ({assignedOrders.length})
          </h4>
          <div className="space-y-2">
            {assignedOrders.map(o => (
              <div key={o.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{o.customer_name} · ₹{o.total_amount}</p>
                </div>
                <Badge className="capitalize">{o.delivery?.status?.replace('_', ' ') || 'assigned'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
