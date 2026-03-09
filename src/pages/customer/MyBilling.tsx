import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Receipt, Calendar, CheckCircle, Clock, IndianRupee, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BillingCycle {
  id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  is_paid: boolean;
  paid_at: string | null;
}

interface BillingOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  food_preferences: string | null;
  items: { name: string; quantity: number; unit_price: number; seller_name: string }[];
}

export default function MyBilling() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [allCycles, setAllCycles] = useState<BillingCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paying, setPaying] = useState(false);

  useEffect(() => { if (user) fetchCycles(); }, [user]);
  useEffect(() => { if (selectedCycleId) fetchOrdersForCycle(selectedCycleId); }, [selectedCycleId]);

  const fetchCycles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('customer_id', user.id)
      .order('start_date', { ascending: false });

    const cycles = (data || []) as BillingCycle[];
    setAllCycles(cycles);
    const active = cycles.find(c => !c.is_paid);
    const selected = active || cycles[0] || null;
    if (selected) { setCycle(selected); setSelectedCycleId(selected.id); }
    setLoading(false);
  };

  const fetchOrdersForCycle = async (cycleId: string) => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status, food_preferences')
      .eq('customer_id', user.id)
      .eq('billing_cycle_id', cycleId)
      .order('created_at', { ascending: false });

    if (!ordersData || ordersData.length === 0) { setOrders([]); return; }

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('order_id, quantity, unit_price, product:products(name, seller_id)')
      .in('order_id', orderIds);

    const sellerIds = [...new Set((itemsData || []).map((i: any) => i.product?.seller_id).filter(Boolean))];
    let sellerMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase.from('profiles').select('user_id, store_name, full_name').in('user_id', sellerIds);
      (sellers || []).forEach((s: any) => { sellerMap[s.user_id] = s.store_name || s.full_name || 'Unknown'; });
    }

    setOrders(ordersData.map(order => ({
      id: order.id,
      created_at: order.created_at,
      total_amount: order.total_amount,
      status: order.status,
      food_preferences: order.food_preferences,
      items: (itemsData || [])
        .filter((i: any) => i.order_id === order.id)
        .map((i: any) => ({
          name: i.product?.name || 'Unknown',
          quantity: i.quantity,
          unit_price: i.unit_price,
          seller_name: sellerMap[i.product?.seller_id] || 'Unknown',
        })),
    })));
  };

  const selectCycle = (c: BillingCycle) => { setCycle(c); setSelectedCycleId(c.id); };

  const handlePayment = async () => {
    if (!user || !cycle) return;
    setPaying(true);
    try {
      // Record payment
      const { error: payError } = await supabase.from('payments').insert({
        customer_id: user.id,
        billing_cycle_id: cycle.id,
        amount: cycle.total_amount,
        method: paymentMethod,
        status: paymentMethod === 'cash' ? 'pending' : 'completed',
        paid_at: paymentMethod !== 'cash' ? new Date().toISOString() : null,
      });
      if (payError) throw payError;

      // Mark cycle as paid (for non-cash payments)
      if (paymentMethod !== 'cash') {
        await supabase.from('billing_cycles').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', cycle.id);
      }

      toast.success(paymentMethod === 'cash' ? 'Cash payment recorded. Pay the seller directly.' : 'Payment successful!');
      setPayDialogOpen(false);
      fetchCycles();
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const totalOrders = orders.length;
  const totalAmount = orders.reduce((s, o) => s + o.total_amount, 0);
  const isCycleEnded = cycle ? new Date(cycle.end_date) < new Date() : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">My 15-Day Food Bill</h1>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Cycle Selector */}
        {allCycles.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {allCycles.map(c => (
              <Button key={c.id} variant={selectedCycleId === c.id ? 'default' : 'outline'} size="sm" onClick={() => selectCycle(c)} className="flex-shrink-0">
                {format(new Date(c.start_date), 'dd MMM')} – {format(new Date(c.end_date), 'dd MMM')}
                {c.is_paid && <CheckCircle className="w-3 h-3 ml-1" />}
              </Button>
            ))}
          </div>
        )}

        {!cycle ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No billing cycles yet</p>
              <p className="text-sm text-muted-foreground">Your billing cycle will start when you place your first order</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> Billing Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-heading font-bold text-foreground">{format(new Date(cycle.start_date), 'dd MMM yyyy')}</p>
                  <p className="text-sm text-muted-foreground">to {format(new Date(cycle.end_date), 'dd MMM yyyy')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Receipt className="w-4 h-4" /> Total Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-heading font-bold text-foreground">{totalOrders}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-heading font-bold text-primary">₹{totalAmount.toLocaleString()}</p>
                  <Badge variant={cycle.is_paid ? 'default' : 'destructive'} className="mt-1">
                    {cycle.is_paid ? 'Paid' : 'Unpaid'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Pay Now Button */}
            {!cycle.is_paid && cycle.total_amount > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="font-heading font-bold text-foreground">
                      {isCycleEnded ? '⚠️ Your 15-day food bill is ready for payment.' : 'Pay your current bill anytime.'}
                    </p>
                    <p className="text-sm text-muted-foreground">Total: ₹{cycle.total_amount.toLocaleString()}</p>
                  </div>
                  <Button size="lg" onClick={() => setPayDialogOpen(true)}>
                    <CreditCard className="w-4 h-4 mr-2" /> Pay Now
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Orders Table */}
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No orders in this billing cycle</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Order Details</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(order => (
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/track-order/${order.id}`)}>
                          <TableCell className="whitespace-nowrap text-sm">{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-sm">{item.name} × {item.quantity} <span className="text-muted-foreground ml-1">(₹{item.unit_price})</span></p>
                              ))}
                              {order.food_preferences && <p className="text-xs text-muted-foreground italic">Pref: {order.food_preferences}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {[...new Set(order.items.map(i => i.seller_name))].map((s, idx) => <p key={idx} className="text-sm">{s}</p>)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-heading font-bold">₹{order.total_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">{order.status.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Your 15-Day Bill</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-3xl font-heading font-bold text-primary">₹{cycle?.total_amount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {cycle && `${format(new Date(cycle.start_date), 'dd MMM')} – ${format(new Date(cycle.end_date), 'dd MMM yyyy')}`}
              </p>
            </div>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
              <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
                <RadioGroupItem value="upi" id="upi" />
                <Label htmlFor="upi" className="cursor-pointer">
                  <span className="font-medium text-foreground">UPI</span>
                  <p className="text-xs text-muted-foreground">Pay via Google Pay, PhonePe, etc.</p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="cursor-pointer">
                  <span className="font-medium text-foreground">Card</span>
                  <p className="text-xs text-muted-foreground">Debit / Credit Card</p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
                <RadioGroupItem value="cash" id="cash-pay" />
                <Label htmlFor="cash-pay" className="cursor-pointer">
                  <span className="font-medium text-foreground">Cash Payment to Seller</span>
                  <p className="text-xs text-muted-foreground">Pay the seller directly in cash</p>
                </Label>
              </div>
            </RadioGroup>
            <Button className="w-full" size="lg" onClick={handlePayment} disabled={paying}>
              {paying ? 'Processing...' : paymentMethod === 'cash' ? 'Record Cash Payment' : `Pay ₹${cycle?.total_amount.toLocaleString()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
