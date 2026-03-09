import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, Plus, ShoppingBag, BarChart3, User, Trash2, Edit, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

const navItems = [
  { label: 'My Products', path: '/', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/seller/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/seller/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'Customer Bills', path: '/seller/billing', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Analytics', path: '/seller/analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

export default function SellerDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', image_url: '' });

  useEffect(() => { if (user) fetchProducts(); }, [user]);

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase.from('products').select('*').eq('seller_id', user.id).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('products').insert({
      seller_id: user.id,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      image_url: form.image_url || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Product added!');
      setForm({ name: '', description: '', price: '', stock: '', image_url: '' });
      setDialogOpen(false);
      fetchProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Product deleted'); fetchProducts(); }
  };

  return (
    <DashboardLayout title="Seller Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Products</p>
            <p className="text-2xl font-heading font-bold text-foreground">{products.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-heading font-bold text-success">{products.filter(p => p.is_active).length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="text-2xl font-heading font-bold text-destructive">{products.filter(p => p.stock === 0).length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-heading font-bold text-primary">₹{products.reduce((s, p) => s + p.price * p.stock, 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Add product */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-heading font-semibold text-foreground">My Products</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Price (₹)</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} required /></div>
                  <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} required /></div>
                </div>
                <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm(f => ({...f, image_url: e.target.value}))} placeholder="https://..." /></div>
                <Button type="submit" className="w-full">Add Product</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Product list */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-lg">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products yet</p>
            <p className="text-sm text-muted-foreground">Add your first product to start selling</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(product => (
              <div key={product.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{product.name}</h4>
                  <p className="text-sm text-muted-foreground">₹{product.price} · {product.stock} in stock</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteProduct(product.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
