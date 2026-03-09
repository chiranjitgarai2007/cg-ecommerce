import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, User, Camera, Lock, Calendar, Mail, Phone, MapPin, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type VehicleType = Database['public']['Enums']['vehicle_type'];

export default function ProfileSettings() {
  const { user, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '', phone: '', address: '',
    store_name: '', business_address: '', gst_number: '',
    vehicle_type: '' as VehicleType | '',
  });

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

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
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const isSeller = roles.includes('seller');
  const isDelivery = roles.includes('delivery_boy');
  const isAdmin = roles.includes('admin');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload image');
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
    setAvatarUrl(publicUrl);
    toast.success('Profile picture updated!');
    setUploadingAvatar(false);
  };

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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success('Password updated!');
      setPasswords({ newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    }
    setChangingPassword(false);
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

      <div className="max-w-lg mx-auto p-4 lg:p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div
            className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-2 cursor-pointer group overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-primary" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <p className="text-sm font-medium text-foreground">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
          <div className="flex gap-1 mt-1">
            {roles.map(r => (
              <span key={r} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full capitalize">
                {r === 'delivery_boy' ? 'Delivery' : r}
              </span>
            ))}
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-heading font-semibold text-foreground text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Account Information
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{profile.phone}</span>
              </div>
            )}
            {profile?.address && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{profile.address}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="font-heading font-semibold text-foreground text-sm">Edit Profile</h3>
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 ..." />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>

          {isSeller && (
            <>
              <Separator />
              <h3 className="font-heading font-semibold text-foreground text-sm">Business Details</h3>
              <div>
                <Label>Store / Restaurant Name</Label>
                <Input value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} />
              </div>
              <div>
                <Label>Business Address</Label>
                <Input value={form.business_address} onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))} />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="Optional" />
              </div>
            </>
          )}

          {isDelivery && (
            <>
              <Separator />
              <h3 className="font-heading font-semibold text-foreground text-sm">Delivery Details</h3>
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
            </>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>

        <Separator />

        {/* Password Change */}
        <div>
          <Button variant="outline" className="w-full" onClick={() => setShowPasswordForm(!showPasswordForm)}>
            <Lock className="w-4 h-4 mr-2" /> Change Password
          </Button>
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="mt-4 space-y-3">
              <div>
                <Label>New Password</Label>
                <Input type="password" value={passwords.newPassword} onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input type="password" value={passwords.confirmPassword} onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
              </div>
              <Button type="submit" size="sm" disabled={changingPassword}>
                {changingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
