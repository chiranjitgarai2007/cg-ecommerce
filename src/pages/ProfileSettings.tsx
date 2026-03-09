import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type VehicleType = Database['public']['Enums']['vehicle_type'];

export default function ProfileSettings() {
  const { user, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', address: '',
    store_name: '', business_address: '', gst_number: '',
    vehicle_type: '' as VehicleType | '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        store_name: profile.store_name || '',
        business_address: profile.business_address || '',
        gst_number: profile.gst_number || '',
        vehicle_type: profile.vehicle_type || '',
      });
    }
  }, [profile]);

  const isSeller = roles.includes('seller');
  const isDelivery = roles.includes('delivery_boy');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const update: Record<string, unknown> = {
      full_name: form.full_name,
      phone: form.phone,
      address: form.address,
    };
    if (isSeller) {
      update.store_name = form.store_name;
      update.business_address = form.business_address;
      update.gst_number = form.gst_number || null;
    }
    if (isDelivery && form.vehicle_type) {
      update.vehicle_type = form.vehicle_type;
    }

    const { error } = await supabase.from('profiles').update(update).eq('user_id', user.id);
    if (error) toast.error(error.message);
    else toast.success('Profile updated!');
    setSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading font-semibold text-foreground">Profile Settings</h1>
      </header>

      <div className="max-w-lg mx-auto p-4 lg:p-6">
        {/* Avatar placeholder */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <User className="w-10 h-10 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {roles.map(r => r === 'delivery_boy' ? 'Delivery Partner' : r).join(', ')}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>

          {isSeller && (
            <>
              <div>
                <Label>Store Name</Label>
                <Input value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} />
              </div>
              <div>
                <Label>Business Address</Label>
                <Input value={form.business_address} onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))} />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} />
              </div>
            </>
          )}

          {isDelivery && (
            <div>
              <Label>Vehicle Type</Label>
              <Select value={form.vehicle_type} onValueChange={v => setForm(f => ({ ...f, vehicle_type: v as VehicleType }))}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="scooter">Scooter</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>

        <Button variant="outline" className="w-full mt-4" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
