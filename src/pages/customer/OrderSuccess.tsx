import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Package, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderSuccess() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
  }, [orderId]);

  const fetchOrder = async (id: string) => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setOrder(data);

    // Get first seller phone
    const { data: items } = await supabase.from('order_items').select('seller_id').eq('order_id', id).limit(1);
    if (items?.[0]?.seller_id) {
      const { data: seller } = await supabase.from('profiles').select('phone').eq('user_id', items[0].seller_id).single();
      setSellerPhone(seller?.phone || null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>

        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground mt-1">Your order has been placed successfully</p>
        </div>

        {order && (
          <div className="bg-card border border-border rounded-lg p-4 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono text-foreground text-xs">{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-heading font-bold text-primary">₹{order.total_amount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span className="text-foreground capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}</span>
            </div>
            {order.estimated_delivery_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Est. Delivery</span>
                <span className="text-foreground">{new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm pt-2 border-t border-border">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">{order.shipping_address}</span>
            </div>
            {sellerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Seller: {sellerPhone}</span>
                <a href={`tel:${sellerPhone}`} className="text-primary text-xs ml-auto">Call</a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/my-orders')}>
            <Package className="w-4 h-4 mr-2" /> My Orders
          </Button>
          <Button className="flex-1" onClick={() => navigate(`/track-order/${orderId}`)}>
            Track Order
          </Button>
        </div>

        <Button variant="link" onClick={() => navigate('/')}>Continue Shopping</Button>
      </div>
    </div>
  );
}
