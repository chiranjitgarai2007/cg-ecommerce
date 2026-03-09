import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, UtensilsCrossed, Receipt, Phone, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CustomerBill {
  cycleId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  orderCount: number;
}

const navItems = [
  { label: 'My Products', path: '/', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/seller/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/seller/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'Customer Bills', path: '/seller/billing', icon: <Receipt className="w-4 h-4" /> },
  { label: 'Analytics', path: '/seller/analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

export default function SellerBilling() {
  const { user } = useAuth();
  const [bills, setBills] = useState<CustomerBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [selectedBill, setSelectedBill] = useState<CustomerBill | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [marking, setMarking] = useState(false);

  useEffect(() => { if (user) fetchBills(); }, [user]);

  const fetchBills = async () => {
    if (!user) return;

    // Get all order items for this seller
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('seller_id', user.id);

    if (!orderItems?.length) { setBills([]); setLoading(false); return; }

    const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];

    // Get orders with billing cycles
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, customer_id, billing_cycle_id, total_amount')
      .in('id', orderIds)
      .not('billing_cycle_id', 'is', null);

    if (!ordersData?.length) { setBills([]); setLoading(false); return; }

    const cycleIds = [...new Set(ordersData.map(o => o.billing_cycle_id).filter(Boolean))] as string[];
    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];

    const [cyclesRes, profilesRes] = await Promise.all([
      supabase.from('billing_cycles').select('*').in('id', cycleIds),
      supabase.from('profiles').select('user_id, full_name, phone').in('user_id', customerIds),
    ]);

    const profileMap: Record<string, any> = {};
    (profilesRes.data || []).forEach(p => { profileMap[p.user_id] = p; });

    const billMap: Record<string, CustomerBill> = {};
    (cyclesRes.data || []).forEach((c: any) => {
      const profile = profileMap[c.customer_id];
      const cycleOrders = ordersData.filter(o => o.billing_cycle_id === c.id);
      billMap[c.id] = {
        cycleId: c.id,
        customerId: c.customer_id,
        customerName: profile?.full_name || 'Customer',
        customerPhone: profile?.phone || 'N/A',
        startDate: c.start_date,
        endDate: c.end_date,
        totalAmount: c.total_amount,
        isPaid: c.is_paid,
        paidAt: c.paid_at,
        orderCount: cycleOrders.length,
      };
    });

    setBills(Object.values(billMap).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    setLoading(false);
  };

  const viewOrders = async (bill: CustomerBill) => {
    setSelectedBill(bill);
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status, food_preferences')
      .eq('customer_id', bill.customerId)
      .eq('billing_cycle_id', bill.cycleId)
      .order('created_at', { ascending: false });

    if (!ordersData?.length) { setOrders([]); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, quantity, unit_price, product:products(name)')
      .in('order_id', orderIds)
      .eq('seller_id', user!.id);

    setOrders(ordersData.map(o => ({
      ...o,
      items: (items || []).filter((i: any) => i.order_id === o.id).map((i: any) => ({
        name: i.product?.name || 'Unknown',
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    })));
  };

  const markAsPaid = async (bill: CustomerBill) => {
    setMarking(true);
    try {
      // Record payment
      await supabase.from('payments').insert({
        customer_id: bill.customerId,
        billing_cycle_id: bill.cycleId,
        amount: bill.totalAmount,
        method: 'cash',
        status: 'completed',
        paid_at: new Date().toISOString(),
      });

      // Mark cycle as paid
      await supabase.from('billing_cycles').update({
        is_paid: true,
        paid_at: new Date().toISOString(),
      }).eq('id', bill.cycleId);

      toast.success('Payment marked as received!');
      setSelectedBill(null);
      fetchBills();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark payment');
    } finally {
      setMarking(false);
    }
  };

  const filtered = filter === 'all' ? bills : bills.filter(b => filter === 'paid' ? b.isPaid : !b.isPaid);
  const totalPending = bills.filter(b => !b.isPaid).reduce((s, b) => s + b.totalAmount, 0);

  return (
    <DashboardLayout title="Regular Customer Bills" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-heading font-bold text-foreground">{[...new Set(bills.map(b => b.customerId))].length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Amount</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-heading font-bold text-destructive">₹{totalPending.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Cycles</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-heading font-bold text-primary">{bills.filter(b => !b.isPaid).length}</p></CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(['unpaid', 'paid', 'all'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>

        {/* Bills List */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No billing records found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(bill => (
              <div key={bill.cycleId} className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => viewOrders(bill)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{bill.customerName}</h4>
                    <Badge variant={bill.isPaid ? 'default' : 'destructive'}>{bill.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{bill.customerPhone}</span>
                    <span>{format(new Date(bill.startDate), 'dd MMM')} – {format(new Date(bill.endDate), 'dd MMM')}</span>
                    <span>{bill.orderCount} orders</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-heading font-bold text-primary">₹{bill.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBill?.customerName} – Order History</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedBill.customerPhone}</span>
                <span>{format(new Date(selectedBill.startDate), 'dd MMM yyyy')} – {format(new Date(selectedBill.endDate), 'dd MMM yyyy')}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-heading font-bold text-primary">₹{selectedBill.totalAmount.toLocaleString()}</p>
                </div>
                {!selectedBill.isPaid && (
                  <Button onClick={() => markAsPaid(selectedBill)} disabled={marking}>
                    <CheckCircle className="w-4 h-4 mr-2" /> {marking ? 'Processing...' : 'Mark as Paid (Cash)'}
                  </Button>
                )}
                {selectedBill.isPaid && (
                  <Badge className="text-base py-1 px-3">✅ Paid</Badge>
                )}
              </div>

              {orders.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm whitespace-nowrap">{format(new Date(order.created_at), 'dd MMM')}</TableCell>
                        <TableCell>
                          {order.items.map((i: any, idx: number) => (
                            <p key={idx} className="text-sm">{i.name} × {i.quantity}</p>
                          ))}
                          {order.food_preferences && <p className="text-xs text-muted-foreground italic">{order.food_preferences}</p>}
                        </TableCell>
                        <TableCell className="text-right font-bold">₹{order.total_amount}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{order.status.replace(/_/g, ' ')}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
