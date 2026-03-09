import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CartItemWithProduct {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    image_url: string | null;
    seller_id: string;
  };
}

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchCart();
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, product:products(id, name, price, stock, image_url, seller_id)')
      .eq('user_id', user.id);

    const mapped = (data || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: item.product,
    }));
    setItems(mapped);
    setLoading(false);
  };

  const updateQuantity = async (id: string, newQty: number) => {
    if (newQty < 1) return removeItem(id);
    const { error } = await supabase.from('cart_items').update({ quantity: newQty }).eq('id', id);
    if (error) toast.error('Failed to update');
    else setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id);
    if (error) toast.error('Failed to remove');
    else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Removed from cart');
    }
  };

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const deliveryCharge = subtotal > 500 ? 0 : 40;
  const platformFee = Math.round(subtotal * 0.02);
  const total = subtotal + deliveryCharge + platformFee;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">My Cart</h1>
        <span className="text-sm text-muted-foreground ml-auto">{items.length} items</span>
      </header>

      <div className="max-w-2xl mx-auto p-4 lg:p-6">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mb-4">Browse products and add items to your cart</p>
            <Button onClick={() => navigate('/')}>Browse Products</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Items */}
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-md bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center cursor-pointer"
                    onClick={() => navigate(`/product/${item.product_id}`)}
                  >
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm truncate">{item.product.name}</h4>
                    <p className="text-primary font-heading font-bold text-sm">₹{item.product.price}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center text-foreground">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.product.stock))}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-foreground">₹{(item.product.price * item.quantity).toLocaleString()}</p>
                    <Button variant="ghost" size="icon" className="mt-1" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Price Summary */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-heading font-semibold text-foreground">Price Details</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Charge</span>
                <span className={deliveryCharge === 0 ? 'text-success' : 'text-foreground'}>
                  {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="text-foreground">₹{platformFee}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-heading font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">₹{total.toLocaleString()}</span>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={() => navigate('/checkout')}>
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
