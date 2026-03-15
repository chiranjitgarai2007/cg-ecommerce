import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type VehicleType = Database['public']['Enums']['vehicle_type'];

export default function Register() {
  const [searchParams] = useSearchParams();
  const role = (searchParams.get('role') || 'customer') as AppRole;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', address: '', password: '', confirmPassword: '',
    storeName: '', businessAddress: '', gst: '',
    vehicleType: '' as VehicleType | '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: role === 'seller' ? form.storeName : form.fullName },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Assign role
      await supabase.from('user_roles').insert({ user_id: data.user.id, role });

      // Update profile with extra fields
      const profileUpdate: Record<string, unknown> = {
        full_name: role === 'seller' ? form.storeName : form.fullName,
        phone: form.phone,
        address: form.address,
      };
      if (role === 'seller') {
        profileUpdate.store_name = form.storeName;
        profileUpdate.business_address = form.businessAddress;
        profileUpdate.gst_number = form.gst || null;
      }
      if (role === 'delivery_boy' && form.vehicleType) {
        profileUpdate.vehicle_type = form.vehicleType;
      }
      await supabase.from('profiles').update(profileUpdate).eq('user_id', data.user.id);
    }

    setLoading(false);
    toast.success('Account created! Please check your email to verify.');
    navigate('/auth/login?role=' + role);
  };

  const roleLabel = role === 'delivery_boy' ? 'Delivery Partner' : role === 'seller' ? 'Seller' : 'Customer';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <button onClick={() => navigate('/auth')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-heading font-bold text-foreground">Register as {roleLabel}</h2>
            <p className="text-sm text-muted-foreground mt-1">Fill in your details to get started</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {role === 'seller' ? (
              <>
                <div><Label>Store Name</Label><Input value={form.storeName} onChange={set('storeName')} required placeholder="My Awesome Store" /></div>
                <div><Label>Owner Name</Label><Input value={form.fullName} onChange={set('fullName')} required placeholder="John Doe" /></div>
              </>
            ) : (
              <div><Label>Full Name</Label><Input value={form.fullName} onChange={set('fullName')} required placeholder="John Doe" /></div>
            )}

            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" /></div>
            <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={set('phone')} required placeholder="+91 98765 43210" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={set('address')} required placeholder="Your full address" /></div>

            {role === 'seller' && (
              <>
                <div><Label>Business Address</Label><Input value={form.businessAddress} onChange={set('businessAddress')} required placeholder="Business address" /></div>
                <div><Label>GST Number (optional)</Label><Input value={form.gst} onChange={set('gst')} placeholder="GST number" /></div>
              </>
            )}

            {role === 'delivery_boy' && (
              <div>
                <Label>Vehicle Type</Label>
                <Select onValueChange={(v) => setForm(f => ({ ...f, vehicleType: v as VehicleType }))}>
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

            <div><Label>Password</Label><Input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" /></div>
            <div><Label>Confirm Password</Label><Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required placeholder="••••••••" /></div>

            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to={`/auth/login?role=${role}`} className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
