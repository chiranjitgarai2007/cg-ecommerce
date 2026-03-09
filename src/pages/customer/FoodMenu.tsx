import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { ShoppingBag, ShoppingCart, Clock, User, UtensilsCrossed, AlertTriangle, Receipt, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface FoodAddon {
  id: string;
  menu_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

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
  addons: FoodAddon[];
  seller_name: string;
}

const navItems = [
  { label: 'Browse Products', path: '/', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Food Menu', path: '/food-menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
  { label: 'My Cart', path: '/cart', icon: <ShoppingCart className="w-4 h-4" /> },
  { label: 'My Orders', path: '/my-orders', icon: <Clock className="w-4 h-4" /> },
  { label: '15-Day Bill', path: '/my-billing', icon: <Receipt className="w-4 h-4" /> },
  { label: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
];

function isMealAvailable(mealType: string): boolean {
  const now = new Date();
  const hours = now.getHours();
  if (mealType === 'lunch') return hours < 10;
  if (mealType === 'dinner') return hours < 17;
  return true;
}

function getCutoffText(mealType: string): string {
  if (mealType === 'lunch') return 'Same-day orders close at 10:00 AM';
  if (mealType === 'dinner') return 'Same-day orders close at 5:00 PM';
  return '';
}

export default function FoodMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<FoodMenu[]>([]);
  const [loading, setLoading] = useState(true);
  // Track selected addons per menu: { menuId: Set<addonId> }
  const [selectedAddons, setSelectedAddons] = useState<Record<string, Set<string>>>({});

  useEffect(() => { fetchMenus(); }, []);

  const fetchMenus = async () => {
    const { data: menuData } = await supabase
      .from('food_menus')
      .select('*')
      .eq('is_active', true);

    if (!menuData || menuData.length === 0) { setMenus([]); setLoading(false); return; }

    const menuIds = menuData.map(m => m.id);
    const sellerIds = [...new Set(menuData.map(m => m.seller_id))];

    const [addonsRes, sellersRes] = await Promise.all([
      supabase.from('food_addons').select('*').in('menu_id', menuIds).eq('is_available', true),
      supabase.from('profiles').select('user_id, store_name, full_name').in('user_id', sellerIds),
    ]);

    const addonsMap: Record<string, FoodAddon[]> = {};
    (addonsRes.data || []).forEach((a: any) => {
      if (!addonsMap[a.menu_id]) addonsMap[a.menu_id] = [];
      addonsMap[a.menu_id].push(a);
    });

    const sellerMap: Record<string, string> = {};
    (sellersRes.data || []).forEach((s: any) => { sellerMap[s.user_id] = s.store_name || s.full_name || 'Unknown'; });

    setMenus(menuData.map((m: any) => ({
      ...m,
      addons: addonsMap[m.id] || [],
      seller_name: sellerMap[m.seller_id] || 'Unknown',
    })));
    setLoading(false);
  };

  const toggleAddon = (menuId: string, addonId: string) => {
    setSelectedAddons(prev => {
      const current = new Set(prev[menuId] || []);
      if (current.has(addonId)) current.delete(addonId);
      else current.add(addonId);
      return { ...prev, [menuId]: current };
    });
  };

  const getMenuTotal = (menu: FoodMenu) => {
    const addonTotal = menu.addons
      .filter(a => selectedAddons[menu.id]?.has(a.id))
      .reduce((s, a) => s + a.price, 0);
    return menu.base_price + addonTotal;
  };

  const placeMenuOrder = async (menu: FoodMenu) => {
    if (!user) { toast.error('Please log in first'); return; }

    // Build a composite product name including selected addons
    const selected = menu.addons.filter(a => selectedAddons[menu.id]?.has(a.id));
    const itemName = `${menu.name} (${menu.rice_description}, ${menu.vegetable_details})${selected.length > 0 ? ' + ' + selected.map(a => a.name).join(', ') : ''}`;
    const totalPrice = getMenuTotal(menu);

    // We add to cart as a product - find or use the menu's base product representation
    // For simplicity, we'll navigate to checkout with menu order info stored in sessionStorage
    const menuOrder = {
      menuId: menu.id,
      sellerId: menu.seller_id,
      sellerName: menu.seller_name,
      itemName,
      mealType: menu.meal_type,
      basePrice: menu.base_price,
      addons: selected.map(a => ({ id: a.id, name: a.name, price: a.price })),
      totalPrice,
    };

    sessionStorage.setItem('pendingMenuOrder', JSON.stringify(menuOrder));
    navigate('/checkout?type=menu');
  };

  const lunchAvailable = isMealAvailable('lunch');
  const dinnerAvailable = isMealAvailable('dinner');

  const lunchMenus = menus.filter(m => m.meal_type === 'lunch');
  const dinnerMenus = menus.filter(m => m.meal_type === 'dinner');

  return (
    <DashboardLayout title="Food Menu" navItems={navItems}>
      <div className="space-y-8">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            🍽️ Select your base meal and choose optional add-ons. Price updates dynamically. Place your order directly from here.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : (
          <>
            {/* Lunch Section */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-heading font-semibold text-foreground">🌞 Lunch</h3>
                {lunchAvailable ? (
                  <Badge className="bg-success text-success-foreground">Same-day Open</Badge>
                ) : (
                  <Badge variant="destructive">Same-day Closed</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{getCutoffText('lunch')}</span>
              </div>
              {!lunchAvailable && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" /> Same-day lunch ordering is closed. You can still order for future dates.
                </div>
              )}
              {lunchMenus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 bg-card border border-border rounded-lg">No lunch menus available</p>
              ) : (
                <div className="space-y-4">
                  {lunchMenus.map(menu => (
                    <MenuCard key={menu.id} menu={menu} selectedAddons={selectedAddons[menu.id] || new Set()} onToggleAddon={toggleAddon} total={getMenuTotal(menu)} onOrder={placeMenuOrder} />
                  ))}
                </div>
              )}
            </section>

            {/* Dinner Section */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg font-heading font-semibold text-foreground">🌙 Dinner</h3>
                {dinnerAvailable ? (
                  <Badge className="bg-success text-success-foreground">Same-day Open</Badge>
                ) : (
                  <Badge variant="destructive">Same-day Closed</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{getCutoffText('dinner')}</span>
              </div>
              {!dinnerAvailable && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" /> Same-day dinner ordering is closed. You can still order for future dates.
                </div>
              )}
              {dinnerMenus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 bg-card border border-border rounded-lg">No dinner menus available</p>
              ) : (
                <div className="space-y-4">
                  {dinnerMenus.map(menu => (
                    <MenuCard key={menu.id} menu={menu} selectedAddons={selectedAddons[menu.id] || new Set()} onToggleAddon={toggleAddon} total={getMenuTotal(menu)} onOrder={placeMenuOrder} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function MenuCard({ menu, selectedAddons, onToggleAddon, total, onOrder }: {
  menu: FoodMenu;
  selectedAddons: Set<string>;
  onToggleAddon: (menuId: string, addonId: string) => void;
  total: number;
  onOrder: (menu: FoodMenu) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-heading font-semibold text-foreground">{menu.name}</h4>
          <p className="text-xs text-muted-foreground">by {menu.seller_name}</p>
          {menu.description && <p className="text-sm text-muted-foreground mt-1">{menu.description}</p>}
        </div>
      </div>

      {/* Base meal info */}
      <div className="bg-muted/50 rounded-md p-3 space-y-1">
        <p className="text-sm text-foreground">🍚 <strong>Rice:</strong> {menu.rice_description}</p>
        <p className="text-sm text-foreground">🥬 <strong>Vegetables:</strong> {menu.vegetable_details}</p>
        <p className="text-sm font-heading font-bold text-primary">Base: ₹{menu.base_price}</p>
      </div>

      {/* Add-ons checkboxes */}
      {menu.addons.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Choose Add-Ons:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {menu.addons.map(addon => (
              <label
                key={addon.id}
                className={`flex items-center gap-2 border rounded-md p-2.5 cursor-pointer transition-colors ${selectedAddons.has(addon.id) ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}
              >
                <Checkbox
                  checked={selectedAddons.has(addon.id)}
                  onCheckedChange={() => onToggleAddon(menu.id, addon.id)}
                />
                <div>
                  <span className="text-sm text-foreground">{addon.name}</span>
                  <span className="text-xs text-primary font-bold ml-1">+₹{addon.price}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Total and order button */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <span className="text-sm text-muted-foreground">Total: </span>
          <span className="text-lg font-heading font-bold text-primary">₹{total}</span>
        </div>
        <Button onClick={() => onOrder(menu)}>
          <ShoppingCart className="w-4 h-4 mr-2" /> Place Order
        </Button>
      </div>
    </div>
  );
}
