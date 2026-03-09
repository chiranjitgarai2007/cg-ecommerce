import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Package, ShoppingBag, BarChart3, User, Plus, Trash2, UtensilsCrossed, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface FoodMenu {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  meal_type: string;
  rice_description: string;
  vegetable_details: string;
  base_price: number;
  is_active: boolean;
  created_at: string;
  addons: FoodAddon[];
}

interface FoodAddon {
  id: string;
  menu_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

const navItems = [
  { label: 'My Products', path: '/', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/seller/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/seller/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'Customer Bills', path: '/seller/billing', icon: <Receipt className="w-4 h-4" /> },
  { label: 'Analytics', path: '/seller/analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

export default function SellerFoodMenu() {
  const { user } = useAuth();
  const [menus, setMenus] = useState<FoodMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', meal_type: 'lunch',
    rice_description: '', vegetable_details: '', base_price: '',
  });
  const [addonForm, setAddonForm] = useState<{ menuId: string; name: string; price: string } | null>(null);

  useEffect(() => { if (user) fetchMenus(); }, [user]);

  const fetchMenus = async () => {
    if (!user) return;
    const { data: menuData } = await supabase
      .from('food_menus')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    const menuIds = (menuData || []).map(m => m.id);
    let addonsMap: Record<string, FoodAddon[]> = {};
    if (menuIds.length > 0) {
      const { data: addonsData } = await supabase
        .from('food_addons')
        .select('*')
        .in('menu_id', menuIds);
      (addonsData || []).forEach((a: any) => {
        if (!addonsMap[a.menu_id]) addonsMap[a.menu_id] = [];
        addonsMap[a.menu_id].push(a);
      });
    }

    setMenus((menuData || []).map((m: any) => ({ ...m, addons: addonsMap[m.id] || [] })));
    setLoading(false);
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('food_menus').insert({
      seller_id: user.id,
      name: form.name,
      description: form.description || null,
      meal_type: form.meal_type,
      rice_description: form.rice_description,
      vegetable_details: form.vegetable_details,
      base_price: parseFloat(form.base_price),
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Menu created!');
      setForm({ name: '', description: '', meal_type: 'lunch', rice_description: '', vegetable_details: '', base_price: '' });
      setDialogOpen(false);
      fetchMenus();
    }
  };

  const addAddon = async () => {
    if (!addonForm) return;
    const { error } = await supabase.from('food_addons').insert({
      menu_id: addonForm.menuId,
      name: addonForm.name,
      price: parseFloat(addonForm.price),
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Add-on added!');
      setAddonForm(null);
      fetchMenus();
    }
  };

  const toggleAddon = async (id: string, current: boolean) => {
    await supabase.from('food_addons').update({ is_available: !current }).eq('id', id);
    fetchMenus();
  };

  const deleteAddon = async (id: string) => {
    await supabase.from('food_addons').delete().eq('id', id);
    toast.success('Add-on removed');
    fetchMenus();
  };

  const deleteMenu = async (id: string) => {
    await supabase.from('food_menus').delete().eq('id', id);
    toast.success('Menu deleted');
    fetchMenus();
  };

  const toggleMenu = async (id: string, current: boolean) => {
    await supabase.from('food_menus').update({ is_active: !current }).eq('id', id);
    fetchMenus();
  };

  const lunchMenus = menus.filter(m => m.meal_type === 'lunch');
  const dinnerMenus = menus.filter(m => m.meal_type === 'dinner');

  return (
    <DashboardLayout title="Food Menu Management" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-heading font-semibold text-foreground">Base Meal Menus</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create Menu</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Base Meal Menu</DialogTitle></DialogHeader>
              <form onSubmit={handleAddMenu} className="space-y-4">
                <div><Label>Menu Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g., Weekday Lunch Special" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." /></div>
                <div>
                  <Label>Meal Type</Label>
                  <Select value={form.meal_type} onValueChange={v => setForm(f => ({ ...f, meal_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Rice Description *</Label><Input value={form.rice_description} onChange={e => setForm(f => ({ ...f, rice_description: e.target.value }))} required placeholder="e.g., Jeera Rice, Veg Rice" /></div>
                <div><Label>Vegetable Details *</Label><Input value={form.vegetable_details} onChange={e => setForm(f => ({ ...f, vegetable_details: e.target.value }))} required placeholder="e.g., Mixed Vegetables, Dal" /></div>
                <div><Label>Base Price (₹)</Label><Input type="number" step="0.01" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} required placeholder="50" /></div>
                <Button type="submit" className="w-full">Create Menu</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : (
          <>
            <MenuSection title="🌞 Lunch Menus" cutoff="Order cutoff: 10:00 AM" menus={lunchMenus} onDelete={deleteMenu} onToggle={toggleMenu} onDeleteAddon={deleteAddon} onToggleAddon={toggleAddon} onAddAddon={(menuId) => setAddonForm({ menuId, name: '', price: '' })} />
            <MenuSection title="🌙 Dinner Menus" cutoff="Order cutoff: 5:00 PM" menus={dinnerMenus} onDelete={deleteMenu} onToggle={toggleMenu} onDeleteAddon={deleteAddon} onToggleAddon={toggleAddon} onAddAddon={(menuId) => setAddonForm({ menuId, name: '', price: '' })} />
          </>
        )}

        {/* Add Addon Dialog */}
        <Dialog open={!!addonForm} onOpenChange={(open) => !open && setAddonForm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Optional Add-On</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Add-On Name</Label><Input value={addonForm?.name || ''} onChange={e => setAddonForm(prev => prev ? { ...prev, name: e.target.value } : null)} placeholder="e.g., Fish, Chicken, Egg" /></div>
              <div><Label>Price (₹)</Label><Input type="number" step="0.01" value={addonForm?.price || ''} onChange={e => setAddonForm(prev => prev ? { ...prev, price: e.target.value } : null)} placeholder="40" /></div>
              <Button className="w-full" onClick={addAddon} disabled={!addonForm?.name || !addonForm?.price}>Add Add-On</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function MenuSection({ title, cutoff, menus, onDelete, onToggle, onDeleteAddon, onToggleAddon, onAddAddon }: {
  title: string; cutoff: string; menus: FoodMenu[];
  onDelete: (id: string) => void; onToggle: (id: string, current: boolean) => void;
  onDeleteAddon: (id: string) => void; onToggleAddon: (id: string, current: boolean) => void;
  onAddAddon: (menuId: string) => void;
}) {
  return (
    <div>
      <h4 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
        {title}
        <Badge variant="outline" className="text-xs">{cutoff}</Badge>
      </h4>
      {menus.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center bg-card border border-border rounded-lg">No menus added yet</p>
      ) : (
        <div className="space-y-4">
          {menus.map(menu => (
            <div key={menu.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-foreground">{menu.name}</h5>
                  {menu.description && <p className="text-xs text-muted-foreground">{menu.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={menu.is_active} onCheckedChange={() => onToggle(menu.id, menu.is_active)} />
                  <Button variant="ghost" size="icon" onClick={() => onDelete(menu.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-3 space-y-1">
                <p className="text-sm text-foreground">🍚 <strong>Rice:</strong> {menu.rice_description}</p>
                <p className="text-sm text-foreground">🥬 <strong>Vegetables:</strong> {menu.vegetable_details}</p>
                <p className="text-sm font-heading font-bold text-primary">Base Price: ₹{menu.base_price}</p>
              </div>
              {/* Add-ons */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Optional Add-Ons</p>
                  <Button variant="outline" size="sm" onClick={() => onAddAddon(menu.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add-On
                  </Button>
                </div>
                {menu.addons.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No add-ons yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {menu.addons.map(addon => (
                      <div key={addon.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-1.5">
                        <span className="text-sm text-foreground">{addon.name}</span>
                        <span className="text-xs text-primary font-bold">+₹{addon.price}</span>
                        <Switch checked={addon.is_available} onCheckedChange={() => onToggleAddon(addon.id, addon.is_available)} className="scale-75" />
                        <button onClick={() => onDeleteAddon(addon.id)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
