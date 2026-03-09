import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Calendar, Clock, Repeat, Pause, Play, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ScheduledOrder {
  id: string;
  status: string;
  total_amount: number;
  shipping_address: string;
  scheduled_time: string | null;
  scheduled_date: string | null;
  recurring_schedule_id: string | null;
  created_at: string;
  food_preferences: string | null;
}

interface RecurringSchedule {
  id: string;
  pattern: string;
  custom_days: number[] | null;
  scheduled_time: string;
  start_date: string;
  end_date: string | null;
  order_data: any;
  is_active: boolean;
  last_generated_date: string | null;
  created_at: string;
}

const PATTERN_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays (Mon-Fri)',
  weekly: 'Weekly',
  custom: 'Custom Days',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduledOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scheduledOrders, setScheduledOrders] = useState<ScheduledOrder[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [ordersRes, schedulesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, total_amount, shipping_address, scheduled_time, scheduled_date, recurring_schedule_id, created_at, food_preferences')
        .eq('customer_id', user.id)
        .eq('status', 'scheduled')
        .order('scheduled_time', { ascending: true }),
      supabase
        .from('recurring_schedules')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setScheduledOrders((ordersRes.data as ScheduledOrder[]) || []);
    setRecurringSchedules((schedulesRes.data as RecurringSchedule[]) || []);
    setLoading(false);
  };

  const cancelScheduledOrder = async (orderId: string) => {
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (error) toast.error('Failed to cancel');
    else { toast.success('Scheduled order cancelled'); fetchData(); }
  };

  const toggleRecurring = async (scheduleId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('recurring_schedules')
      .update({ is_active: !isActive })
      .eq('id', scheduleId);
    if (error) toast.error('Failed to update');
    else { toast.success(isActive ? 'Recurring order paused' : 'Recurring order resumed'); fetchData(); }
  };

  const deleteRecurring = async (scheduleId: string) => {
    // Cancel all future scheduled orders for this series
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('recurring_schedule_id', scheduleId)
      .eq('status', 'scheduled');

    const { error } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', scheduleId);

    if (error) toast.error('Failed to delete');
    else { toast.success('Recurring order series deleted'); fetchData(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">Scheduled & Recurring Orders</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-8">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : (
          <>
            {/* Upcoming Scheduled Orders */}
            <section>
              <h2 className="font-heading font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Upcoming Scheduled Orders
              </h2>
              {scheduledOrders.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No upcoming scheduled orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledOrders.map(order => (
                    <div key={order.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="font-heading font-bold text-primary">₹{order.total_amount}</p>
                        </div>
                        <Badge className="bg-violet-100 text-violet-800">Scheduled</Badge>
                      </div>
                      {order.scheduled_time && (
                        <p className="text-sm text-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(order.scheduled_time), 'PPP p')}
                        </p>
                      )}
                      {order.food_preferences && (
                        <p className="text-xs text-muted-foreground">🍽️ {order.food_preferences}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">{order.shipping_address}</p>
                      {order.recurring_schedule_id && (
                        <Badge variant="outline" className="text-xs"><Repeat className="w-3 h-3 mr-1" />Part of recurring series</Badge>
                      )}
                      <div className="flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">Cancel</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel scheduled order?</AlertDialogTitle>
                              <AlertDialogDescription>This will cancel this specific scheduled order. Recurring series will continue generating future orders.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancelScheduledOrder(order.id)}>Cancel Order</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recurring Schedules */}
            <section>
              <h2 className="font-heading font-bold text-lg text-foreground mb-4 flex items-center gap-2">
                <Repeat className="w-5 h-5 text-primary" /> Recurring Order Series
              </h2>
              {recurringSchedules.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                  <Repeat className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No recurring orders set up</p>
                  <p className="text-xs text-muted-foreground mt-1">Set up recurring orders from the checkout page</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recurringSchedules.map(schedule => {
                    const orderData = schedule.order_data as any;
                    return (
                      <div key={schedule.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-heading font-semibold text-foreground">
                              {orderData?.food_preferences || orderData?.shipping_address?.slice(0, 30) || 'Order'}
                            </p>
                            <p className="text-sm text-primary font-bold">₹{orderData?.total_amount || 0}</p>
                          </div>
                          <Badge className={schedule.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                            {schedule.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <p className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> {PATTERN_LABELS[schedule.pattern] || schedule.pattern}</p>
                          <p className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {schedule.scheduled_time?.slice(0, 5)}</p>
                          <p>From: {format(new Date(schedule.start_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                          <p>{schedule.end_date ? `Until: ${format(new Date(schedule.end_date + 'T00:00:00'), 'dd MMM yyyy')}` : 'No end date'}</p>
                        </div>

                        {schedule.pattern === 'custom' && schedule.custom_days && (
                          <div className="flex gap-1 flex-wrap">
                            {(schedule.custom_days as number[]).map(day => (
                              <span key={day} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{DAY_NAMES[day]}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-2 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleRecurring(schedule.id, schedule.is_active)}
                          >
                            {schedule.is_active ? <><Pause className="w-3 h-3 mr-1" /> Pause</> : <><Play className="w-3 h-3 mr-1" /> Resume</>}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm"><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete recurring series?</AlertDialogTitle>
                                <AlertDialogDescription>This will cancel all future scheduled orders in this series and delete the recurring schedule permanently.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteRecurring(schedule.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
