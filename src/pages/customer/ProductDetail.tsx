import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, ShoppingCart, Zap, Package, Phone, Clock, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchProduct(id);
  }, [id]);

  const fetchProduct = async (productId: string) => {
    const { data } = await supabase.from('products').select('*').eq('id', productId).single();
    if (data) {
      setProduct(data);
      // Fetch seller profile
      const { data: sellerData } = await supabase.from('profiles').select('*').eq('user_id', data.seller_id).single();
      setSeller(sellerData);
    }
    setLoading(false);
  };

  const addToCart = async () => {
    if (!user || !product) return;
    const { error } = await supabase.from('cart_items').upsert(
      { user_id: user.id, product_id: product.id, quantity: 1 },
      { onConflict: 'user_id,product_id' }
    );
    if (error) toast.error('Failed to add to cart');
    else toast.success('Added to cart!');
  };

  const buyNow = async () => {
    if (!user || !product) return;
    await addToCart();
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground truncate">{product.name}</h1>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image */}
          <div className="aspect-square bg-muted rounded-xl overflow-hidden flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-20 h-20 text-muted-foreground" />
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground">{product.name}</h2>
              <p className="text-3xl font-heading font-bold text-primary mt-2">₹{product.price}</p>
            </div>

            {product.description && (
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className={`text-sm font-medium ${product.stock > 0 ? 'text-success' : 'text-destructive'}`}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>

            {/* Estimated Delivery */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Estimated delivery: 3-5 business days</span>
            </div>

            {/* Seller Info */}
            {seller && (
              <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">{seller.store_name || seller.full_name || 'Seller'}</span>
                </div>
                {seller.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{seller.phone}</span>
                    <a href={`tel:${seller.phone}`} className="text-primary text-sm font-medium ml-auto">Call</a>
                  </div>
                )}
                {seller.business_address && (
                  <p className="text-xs text-muted-foreground">{seller.business_address}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" disabled={product.stock === 0} onClick={addToCart}>
                <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
              </Button>
              <Button className="flex-1" disabled={product.stock === 0} onClick={buyNow}>
                <Zap className="w-4 h-4 mr-2" /> Buy Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
