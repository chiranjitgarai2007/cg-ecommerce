import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, MapPin, Clock, CreditCard, Truck, CalendarIcon, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CartItemWithProduct {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string; name: string; price: number; stock: number; image_url: string | null; seller_id: string; requires_delivery_boy: boolean | null; meal_type: string | null;
  };
}

interface MenuOrder {
  menuId: string;
  sellerId: string;
  sellerName: string;
  itemName: string;
  mealType: string;
  basePrice: number;
  addons: { id: string; name: string; price: number }[];
  totalPrice: number;
}

export default function Checkout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMenuOrder = searchParams.get('type') === 'menu';

  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [menuOrder, setMenuOrder] = useState<MenuOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [address, setAddress] = useState(profile?.address || '');
  const [landmark, setLandmark] = useState('');
  const [contactNumber, setContactNumber] = useState(profile?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [foodPreferences, setFoodPreferences] = useState('');

  useEffect(() => {
    if (isMenuOrder) {
      const stored = sessionStorage.getItem('pendingMenuOrder');
      if (stored) {
        setMenuOrder(JSON.parse(stored));
      }
      setLoading(false);
    } else if (user) {
      fetchCart();
    }
  }, [user, isMenuOrder]);

  useEffect(() => {
    if (profile) {
      if (!address && profile.address) setAddress(profile.address);
      if (!contactNumber && profile.phone) setContactNumber(profile.phone);
    }
  }, [profile]);

  const hasFoodItems = isMenuOrder || items.some(i => i.product.meal_type === 'lunch' || i.product.meal_type === 'dinner');

  const fetchCart = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, product:products(id, name, price, stock, image_url, seller_id, requires_delivery_boy, meal_type)')
      .eq('user_id', user.id);

    const mapped = (data || []).map((item: any) => ({
      id: item.id, product_id: item.product_id, quantity: item.quantity, product: item.product,
    }));
    setItems(mapped);
    setLoading(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); toast.success('Location detected!'); },
      () => toast.error('Unable to get location.')
    );
  };

  const subtotal = isMenuOrder ? (menuOrder?.totalPrice || 0) : items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const platformFee = Math.round(subtotal * 0.02);
  const total = subtotal + platformFee;

  const validateFoodCutoff = (): boolean => {
    if (!hasFoodItems) return true;
    const now = new Date();
    const selectedDate = deliveryDate || now;
    const isToday = selectedDate.toDateString() === now.toDateString();
    if (!isToday) return true;

    const hours = now.getHours();
    const mealType = isMenuOrder ? menuOrder?.mealType : null;
    const hasLunch = isMenuOrder ? mealType === 'lunch' : items.some(i => i.product.meal_type === 'lunch');
    const hasDinner = isMenuOrder ? mealType === 'dinner' : items.some(i => i.product.meal_type === 'dinner');

    if (hasLunch && hours >= 10) { toast.error('Lunch orders must be placed before 10:00 AM for same-day delivery'); return false; }
    if (hasDinner && hours >= 17) { toast.error('Dinner orders must be placed before 5:00 PM for same-day delivery'); return false; }
    return true;
  };

  const placeOrder = async () => {
    if (!user) return;
    if (!isMenuOrder && items.length === 0) return;
    if (isMenuOrder && !menuOrder) return;
    if (!address.trim()) { toast.error('Please enter delivery address'); return; }
    if (!contactNumber.trim()) { toast.error('Please enter contact number'); return; }
    if (hasFoodItems && !deliveryDate) { toast.error('Please select a delivery date'); return; }
    if (!validateFoodCutoff()) return;

    setSubmitting(true);
    try {
      let billingCycleId: string | null = null;
      const { data: cycleData } = await supabase.rpc('get_or_create_billing_cycle', { _customer_id: user.id });
      if (cycleData) billingCycleId = cycleData as string;

      const foodPrefText = isMenuOrder
        ? `${menuOrder!.itemName}${foodPreferences ? ' | Preferences: ' + foodPreferences : ''}`
        : (foodPreferences || null);

      const { data: order, error: orderError } = await supabase.from('orders').insert({
        customer_id: user.id,
        total_amount: total,
        shipping_address: `${address}${landmark ? ', ' + landmark : ''}`,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        delivery_type: 'standard',
        latitude, longitude, landmark,
        contact_number: contactNumber,
        scheduled_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
        food_preferences: foodPrefText,
        seller_delivers: false,
        estimated_delivery_date: deliveryDate ? deliveryDate.toISOString() : new Date(Date.now() + 5 * 86400000).toISOString(),
        billing_cycle_id: billingCycleId,
      } as any).select().single();

      if (orderError) throw orderError;

      if (isMenuOrder && menuOrder) {
        // Insert order items for menu order - base meal as one item
        const orderItems = [{
          order_id: order.id,
          product_id: null,
          seller_id: menuOrder.sellerId,
          quantity: 1,
          unit_price: menuOrder.totalPrice,
        }];
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;
        sessionStorage.removeItem('pendingMenuOrder');
      } else {
        const orderItems = items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          seller_id: item.product.seller_id,
          quantity: item.quantity,
          unit_price: item.product.price,
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        for (const item of items) {
          await supabase.from('products').update({ stock: item.product.stock - item.quantity }).eq('id', item.product_id);
        }
        await supabase.from('cart_items').delete().eq('user_id', user.id);
      }

      // Update billing cycle total
      if (billingCycleId) {
        const { data: cycleRow } = await supabase.from('billing_cycles').select('total_amount').eq('id', billingCycleId).single();
        if (cycleRow) {
          await supabase.from('billing_cycles').update({ total_amount: (cycleRow.total_amount || 0) + total }).eq('id', billingCycleId);
        }
      }

      navigate(`/order-success/${order.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMenuOrder && items.length === 0) { navigate('/cart'); return null; }
  if (isMenuOrder && !menuOrder) { navigate('/food-menu'); return null; }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(isMenuOrder ? '/food-menu' : '/cart')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">Checkout</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Delivery Address */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Delivery Address</h3>
          </div>
          <div className="space-y-3">
            <div><Label>Full Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter your full address" /></div>
            <div><Label>Landmark</Label><Input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Near..." /></div>
            <div><Label>Contact Number</Label><Input value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="+91..." /></div>
            <Button variant="outline" size="sm" onClick={detectLocation} type="button">
              <MapPin className="w-4 h-4 mr-2" /> Detect My Location
            </Button>
            {latitude && longitude && <p className="text-xs text-success">📍 Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}</p>}
          </div>
        </section>

        {/* Delivery Date */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Delivery Date</h3>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deliveryDate ? format(deliveryDate, 'PPP') : <span>Select delivery date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {hasFoodItems && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>🌞 Lunch: order before 10:00 AM for same-day delivery</p>
              <p>🌙 Dinner: order before 5:00 PM for same-day delivery</p>
            </div>
          )}
        </section>

        {/* Food Preferences */}
        {hasFoodItems && (
          <section className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-foreground">Food Preferences</h3>
            </div>
            <Textarea value={foodPreferences} onChange={e => setFoodPreferences(e.target.value)} placeholder="Any special requests — e.g., less spicy, no onion..." rows={3} />
          </section>
        )}

        {/* Delivery Info */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Delivery</h3>
          </div>
          <p className="text-sm text-muted-foreground">The seller will arrange delivery. No delivery charges.</p>
        </section>

        {/* Order Summary */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Order Summary</h3>
          </div>

          {isMenuOrder && menuOrder ? (
            <div className="space-y-2">
              <div className="bg-muted/50 rounded-md p-3">
                <p className="font-medium text-foreground">{menuOrder.itemName}</p>
                <p className="text-xs text-muted-foreground">Seller: {menuOrder.sellerName} · {menuOrder.mealType === 'lunch' ? '🌞 Lunch' : '🌙 Dinner'}</p>
                {menuOrder.addons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {menuOrder.addons.map(a => (
                      <span key={a.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{a.name} +₹{a.price}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" /> : <Truck className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="font-heading font-bold text-sm text-foreground">₹{(item.product.price * item.quantity).toLocaleString()}</p>
              </div>
            ))
          )}

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span className="text-foreground">FREE</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform Fee</span><span className="text-foreground">₹{platformFee}</span></div>
            {deliveryDate && <div className="flex justify-between text-sm text-muted-foreground"><span>Delivery Date</span><span>{format(deliveryDate, 'dd MMM yyyy')}</span></div>}
            <div className="border-t border-border pt-3 flex justify-between font-heading font-bold text-lg">
              <span className="text-foreground">Total</span><span className="text-primary">₹{total.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Payment Method</h3>
          </div>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
            <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
              <RadioGroupItem value="cod" id="cod" />
              <Label htmlFor="cod" className="cursor-pointer">
                <span className="font-medium text-foreground">Cash on Delivery</span>
                <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
              <RadioGroupItem value="online" id="online" />
              <Label htmlFor="online" className="cursor-pointer">
                <span className="font-medium text-foreground">Online Payment</span>
                <p className="text-xs text-muted-foreground">UPI / Card / Net Banking</p>
              </Label>
            </div>
          </RadioGroup>
        </section>

        {/* 15-day billing note */}
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
          💡 This order will be added to your 15-day billing cycle. You can view and pay your accumulated bill from the <strong>15-Day Bill</strong> page.
        </div>

        <Button className="w-full" size="lg" onClick={placeOrder} disabled={submitting}>
          {submitting ? 'Placing Order...' : `Place Order · ₹${total.toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
}
