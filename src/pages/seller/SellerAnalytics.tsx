import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, TrendingUp, IndianRupee, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const navItems = [
  { label: 'My Products', path: '/', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/seller/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Analytics', path: '/seller/analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

interface OrderData {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface ProductPerf {
  name: string;
  sold: number;
  revenue: number;
}

const COLORS = ['hsl(25, 95%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(220, 14%, 80%)', 'hsl(0, 84%, 60%)', 'hsl(38, 92%, 50%)'];

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [productPerf, setProductPerf] = useState<ProductPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Get seller's order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, quantity, unit_price, product_id')
      .eq('seller_id', user.id);

    if (!orderItems?.length) { setLoading(false); return; }

    const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];
    const productIds = [...new Set(orderItems.map(oi => oi.product_id).filter(Boolean))] as string[];

    const [ordersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('id, status, total_amount, created_at').in('id', orderIds),
      supabase.from('products').select('id, name').in('id', productIds),
    ]);

    setOrders(ordersRes.data?.map(o => ({ ...o, total_amount: Number(o.total_amount) })) || []);

    // Product performance
    const prodMap = new Map((productsRes.data || []).map(p => [p.id, p.name]));
    const perfMap = new Map<string, ProductPerf>();
    orderItems.forEach(oi => {
      if (!oi.product_id) return;
      const name = prodMap.get(oi.product_id) || 'Unknown';
      const existing = perfMap.get(oi.product_id) || { name, sold: 0, revenue: 0 };
      existing.sold += oi.quantity;
      existing.revenue += oi.quantity * Number(oi.unit_price);
      perfMap.set(oi.product_id, existing);
    });
    setProductPerf(Array.from(perfMap.values()).sort((a, b) => b.revenue - a.revenue));
    setLoading(false);
  };

  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
  const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

  const today = new Date().toDateString();
  const todaysOrders = orders.filter(o => new Date(o.created_at).toDateString() === today).length;

  // Revenue by day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    const dayOrders = orders.filter(o => new Date(o.created_at).toDateString() === key);
    return {
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
      orders: dayOrders.length,
    };
  });

  // Status distribution for pie chart
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  if (loading) {
    return (
      <DashboardLayout title="Seller Analytics" navItems={navItems}>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Seller Analytics" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Orders', value: orders.length, icon: <ShoppingBag className="w-5 h-5" />, color: 'text-foreground' },
            { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: <IndianRupee className="w-5 h-5" />, color: 'text-primary' },
            { label: 'Pending', value: pendingOrders, icon: <Clock className="w-5 h-5" />, color: 'text-warning' },
            { label: 'Delivered', value: deliveredOrders, icon: <CheckCircle className="w-5 h-5" />, color: 'text-success' },
            { label: "Today's Orders", value: todaysOrders, icon: <TrendingUp className="w-5 h-5" />, color: 'text-primary' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1 text-muted-foreground">{stat.icon}<span className="text-xs">{stat.label}</span></div>
              <p className={`text-2xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-heading font-semibold text-foreground mb-4">Revenue (Last 7 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(220, 10%, 46%)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(220, 10%, 46%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 13%, 91%)', borderRadius: '8px', fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={{ fill: 'hsl(25, 95%, 53%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Order Status Pie */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-heading font-semibold text-foreground mb-4">Order Status Distribution</h3>
            <div className="h-64">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Orders Per Day Bar Chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-heading font-semibold text-foreground mb-4">Orders Per Day (Last 7 Days)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7}>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(220, 10%, 46%)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(220, 10%, 46%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 13%, 91%)', borderRadius: '8px', fontSize: 12 }} />
                <Bar dataKey="orders" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Performance */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-heading font-semibold text-foreground mb-4">Product Performance</h3>
          {productPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No product data yet</p>
          ) : (
            <div className="space-y-3">
              {productPerf.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-foreground w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sold} sold</p>
                  </div>
                  <p className="text-sm font-heading font-bold text-primary">₹{p.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
