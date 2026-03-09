import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, MapPin, Clock, CreditCard, Truck, CalendarIcon, UtensilsCrossed, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
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

type ScheduleMode = 'now' | 'later' | 'recurring';
type RecurringPattern = 'daily' | 'weekdays' | 'weekly' | 'custom';

const DAY_OPTIONS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const TIME_SLOTS = Array.from({ length: 24 }, (_, h) =>
  [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]
).flat();

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

  // Scheduling state
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
  const [scheduledTime, setScheduledTime] = useState('13:00');
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (isMenuOrder) {
      const stored = sessionStorage.getItem('pendingMenuOrder');
      if (stored) setMenuOrder(JSON.parse(stored));
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
    if (scheduleMode !== 'now') return true; // Scheduled orders bypass cutoff
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

  const buildOrderItems = () => {
    if (isMenuOrder && menuOrder) {
      return [{
        product_id: null,
        seller_id: menuOrder.sellerId,
        quantity: 1,
        unit_price: menuOrder.totalPrice,
      }];
    }
    return items.map(item => ({
      product_id: item.product_id,
      seller_id: item.product.seller_id,
      quantity: item.quantity,
      unit_price: item.product.price,
    }));
  };

  const placeOrder = async () => {
    if (!user) return;
    if (!isMenuOrder && items.length === 0) return;
    if (isMenuOrder && !menuOrder) return;
    if (!address.trim()) { toast.error('Please enter delivery address'); return; }
    if (!contactNumber.trim()) { toast.error('Please enter contact number'); return; }
    if (scheduleMode === 'now' && hasFoodItems && !deliveryDate) { toast.error('Please select a delivery date'); return; }
    if (scheduleMode === 'later' && !deliveryDate) { toast.error('Please select a scheduled date'); return; }
    if (scheduleMode === 'recurring' && !deliveryDate) { toast.error('Please select a start date'); return; }
    if (!validateFoodCutoff()) return;

    setSubmitting(true);
    try {
      const foodPrefText = isMenuOrder
        ? `${menuOrder!.itemName}${foodPreferences ? ' | Preferences: ' + foodPreferences : ''}`
        : (foodPreferences || null);

      // For recurring orders, create a recurring schedule
      if (scheduleMode === 'recurring') {
        const orderItemsData = buildOrderItems();
        const { data: schedule, error: schedErr } = await supabase
          .from('recurring_schedules')
          .insert({
            customer_id: user.id,
            pattern: recurringPattern,
            custom_days: recurringPattern === 'custom' ? customDays : null,
            scheduled_time: scheduledTime,
            start_date: format(deliveryDate!, 'yyyy-MM-dd'),
            end_date: recurringEndDate ? format(recurringEndDate, 'yyyy-MM-dd') : null,
            order_data: {
              total_amount: total,
              shipping_address: `${address}${landmark ? ', ' + landmark : ''}`,
              payment_method: paymentMethod,
              delivery_type: 'standard',
              latitude, longitude, landmark,
              contact_number: contactNumber,
              food_preferences: foodPrefText,
              seller_delivers: false,
              items: orderItemsData,
            },
          } as any)
          .select()
          .single();

        if (schedErr) throw schedErr;

        // Create the first occurrence as a scheduled order
        const scheduledDateTime = new Date(`${format(deliveryDate!, 'yyyy-MM-dd')}T${scheduledTime}:00`);

        let billingCycleId: string | null = null;
        const { data: cycleData } = await supabase.rpc('get_or_create_billing_cycle', { _customer_id: user.id });
        if (cycleData) billingCycleId = cycleData as string;

        const { data: order, error: orderError } = await supabase.from('orders').insert({
          customer_id: user.id,
          total_amount: total,
          shipping_address: `${address}${landmark ? ', ' + landmark : ''}`,
          payment_method: paymentMethod,
          payment_status: 'pending',
          delivery_type: 'standard',
          latitude, longitude, landmark,
          contact_number: contactNumber,
          scheduled_date: format(deliveryDate!, 'yyyy-MM-dd'),
          scheduled_time: scheduledDateTime.toISOString(),
          food_preferences: foodPrefText,
          seller_delivers: false,
          estimated_delivery_date: deliveryDate!.toISOString(),
          billing_cycle_id: billingCycleId,
          recurring_schedule_id: schedule.id,
          status: 'scheduled',
        } as any).select().single();

        if (orderError) throw orderError;

        const orderItems = orderItemsData.map(item => ({ ...item, order_id: order.id }));
        await supabase.from('order_items').insert(orderItems);

        if (isMenuOrder) sessionStorage.removeItem('pendingMenuOrder');
        else await supabase.from('cart_items').delete().eq('user_id', user.id);

        toast.success('Recurring order series created!');
        navigate('/scheduled-orders');
        return;
      }

      // One-time scheduled or immediate order
      let billingCycleId: string | null = null;
      const { data: cycleData } = await supabase.rpc('get_or_create_billing_cycle', { _customer_id: user.id });
      if (cycleData) billingCycleId = cycleData as string;

      const isScheduled = scheduleMode === 'later';
      let scheduledDateTime: string | null = null;
      if (isScheduled && deliveryDate) {
        scheduledDateTime = new Date(`${format(deliveryDate, 'yyyy-MM-dd')}T${scheduledTime}:00`).toISOString();
      }

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
        scheduled_time: scheduledDateTime,
        food_preferences: foodPrefText,
        seller_delivers: false,
        estimated_delivery_date: deliveryDate ? deliveryDate.toISOString() : new Date(Date.now() + 5 * 86400000).toISOString(),
        billing_cycle_id: isScheduled ? null : billingCycleId,
        status: isScheduled ? 'scheduled' : 'pending',
      } as any).select().single();

      if (orderError) throw orderError;

      if (isMenuOrder && menuOrder) {
        const orderItems = [{
          order_id: order.id,
          product_id: null,
          seller_id: menuOrder.sellerId,
          quantity: 1,
          unit_price: menuOrder.totalPrice,
        }];
        await supabase.from('order_items').insert(orderItems);
        sessionStorage.removeItem('pendingMenuOrder');
      } else {
        const orderItems = items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          seller_id: item.product.seller_id,
          quantity: item.quantity,
          unit_price: item.product.price,
        }));
        await supabase.from('order_items').insert(orderItems);

        if (!isScheduled) {
          for (const item of items) {
            await supabase.from('products').update({ stock: item.product.stock - item.quantity }).eq('id', item.product_id);
          }
        }
        await supabase.from('cart_items').delete().eq('user_id', user.id);
      }

      // Update billing cycle total (only for immediate orders)
      if (!isScheduled && billingCycleId) {
        const { data: cycleRow } = await supabase.from('billing_cycles').select('total_amount').eq('id', billingCycleId).single();
        if (cycleRow) {
          await supabase.from('billing_cycles').update({ total_amount: (cycleRow.total_amount || 0) + total }).eq('id', billingCycleId);
        }
      }

      if (isScheduled) {
        toast.success('Order scheduled successfully!');
        navigate('/scheduled-orders');
      } else {
        navigate(`/order-success/${order.id}`);
      }
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

        {/* Order Scheduling */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">Order Timing</h3>
          </div>

          <RadioGroup value={scheduleMode} onValueChange={(v) => setScheduleMode(v as ScheduleMode)} className="space-y-2">
            <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
              <RadioGroupItem value="now" id="schedule-now" />
              <Label htmlFor="schedule-now" className="cursor-pointer flex-1">
                <span className="font-medium text-foreground">Order Now</span>
                <p className="text-xs text-muted-foreground">Place order immediately</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
              <RadioGroupItem value="later" id="schedule-later" />
              <Label htmlFor="schedule-later" className="cursor-pointer flex-1">
                <span className="font-medium text-foreground">Schedule for Later</span>
                <p className="text-xs text-muted-foreground">Pick a specific date and time</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 bg-background border border-border rounded-lg p-3">
              <RadioGroupItem value="recurring" id="schedule-recurring" />
              <Label htmlFor="schedule-recurring" className="cursor-pointer flex-1">
                <span className="font-medium text-foreground flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Recurring Order</span>
                <p className="text-xs text-muted-foreground">Set up daily, weekly, or custom schedule</p>
              </Label>
            </div>
          </RadioGroup>
        </section>

        {/* Date & Time Selection — shown for 'now' (date only), 'later', and 'recurring' */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-foreground">
              {scheduleMode === 'now' ? 'Delivery Date' : scheduleMode === 'later' ? 'Scheduled Date & Time' : 'Start Date & Schedule'}
            </h3>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deliveryDate ? format(deliveryDate, 'PPP') : <span>{scheduleMode === 'recurring' ? 'Select start date' : 'Select date'}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deliveryDate}
                onSelect={setDeliveryDate}
                disabled={(date) => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const maxDate = addDays(today, 30);
                  return date < today || date > maxDate;
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Time picker for scheduled/recurring */}
          {(scheduleMode === 'later' || scheduleMode === 'recurring') && (
            <div>
              <Label>Time</Label>
              <Select value={scheduledTime} onValueChange={setScheduledTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_SLOTS.map(slot => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurring options */}
          {scheduleMode === 'recurring' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <Label>Frequency</Label>
                <Select value={recurringPattern} onValueChange={(v) => setRecurringPattern(v as RecurringPattern)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurringPattern === 'custom' && (
                <div>
                  <Label className="mb-2 block">Select Days</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_OPTIONS.map(day => (
                      <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={customDays.includes(day.value)}
                          onCheckedChange={(checked) => {
                            setCustomDays(prev =>
                              checked ? [...prev, day.value] : prev.filter(d => d !== day.value)
                            );
                          }}
                        />
                        <span className="text-sm text-foreground">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>End Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !recurringEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurringEndDate ? format(recurringEndDate, 'PPP') : <span>No end date (runs indefinitely)</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={recurringEndDate}
                      onSelect={setRecurringEndDate}
                      disabled={(date) => {
                        const startDate = deliveryDate || new Date();
                        return date <= startDate;
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {scheduleMode === 'now' && hasFoodItems && (
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
            {deliveryDate && <div className="flex justify-between text-sm text-muted-foreground"><span>{scheduleMode === 'recurring' ? 'Starts' : 'Delivery Date'}</span><span>{format(deliveryDate, 'dd MMM yyyy')}</span></div>}
            {(scheduleMode === 'later' || scheduleMode === 'recurring') && (
              <div className="flex justify-between text-sm text-muted-foreground"><span>Time</span><span>{scheduledTime}</span></div>
            )}
            {scheduleMode === 'recurring' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pattern</span>
                <span className="capitalize">{recurringPattern === 'custom' ? `Custom (${customDays.map(d => DAY_OPTIONS.find(o => o.value === d)?.label).join(', ')})` : recurringPattern}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between font-heading font-bold text-lg">
              <span className="text-foreground">
                {scheduleMode === 'recurring' ? 'Per Order' : 'Total'}
              </span>
              <span className="text-primary">₹{total.toLocaleString()}</span>
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

        {/* Billing note */}
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
          {scheduleMode === 'recurring'
            ? '🔁 Each recurring order will be added to your 15-day billing cycle when it becomes active.'
            : scheduleMode === 'later'
            ? '⏰ This scheduled order will be added to your billing cycle when it activates.'
            : '💡 This order will be added to your 15-day billing cycle. You can view and pay your accumulated bill from the 15-Day Bill page.'
          }
        </div>

        <Button className="w-full" size="lg" onClick={placeOrder} disabled={submitting}>
          {submitting ? 'Processing...' :
            scheduleMode === 'recurring' ? `Set Up Recurring Order · ₹${total.toLocaleString()}/order` :
            scheduleMode === 'later' ? `Schedule Order · ₹${total.toLocaleString()}` :
            `Place Order · ₹${total.toLocaleString()}`
          }
        </Button>
      </div>
    </div>
  );
}
