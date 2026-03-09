import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Package, ShoppingBag, BarChart3, Settings, Layers, Truck, Search, Shield, Ban, CheckCircle, X, Eye, Edit, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

const navItems = [
  { label: 'Overview', path: '/', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Users', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
  { label: 'Products', path: '/admin/products', icon: <Package className="w-4 h-4" /> },
  { label: 'Orders', path: '/admin/orders', icon: <ShoppingBag className="w-4 h-4" /> },
  { label: 'Categories', path: '/admin/categories', icon: <Layers className="w-4 h-4" /> },
  { label: 'Deliveries', path: '/admin/deliveries', icon: <Truck className="w-4 h-4" /> },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: <Shield className="w-4 h-4" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
];

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    const rolesMap = new Map<string, AppRole[]>();
    (rolesRes.data || []).forEach(r => {
      const existing = rolesMap.get(r.user_id) || [];
      existing.push(r.role);
      rolesMap.set(r.user_id, existing);
    });

    const enriched: UserWithRoles[] = (profilesRes.data || []).map(p => ({
      ...p,
      roles: rolesMap.get(p.user_id) || [],
    }));

    setUsers(enriched);
    setLoading(false);
  };

  const logAction = async (action: string, targetUserId: string, changes?: Record<string, unknown>) => {
    if (!user) return;
    await supabase.from('admin_audit_logs').insert([{
      admin_id: user.id,
      action,
      target_user_id: targetUserId,
      changes: changes || null,
    }]);
  };

  const toggleBlock = async (u: UserWithRoles) => {
    const newBlocked = !u.is_blocked;
    const { error } = await supabase.from('profiles').update({ is_blocked: newBlocked }).eq('user_id', u.user_id);
    if (error) toast.error(error.message);
    else {
      await logAction(newBlocked ? 'block_user' : 'unblock_user', u.user_id);
      toast.success(newBlocked ? 'User blocked' : 'User unblocked');
      fetchUsers();
    }
  };

  const toggleApproval = async (u: UserWithRoles) => {
    const newApproved = !u.is_approved;
    const { error } = await supabase.from('profiles').update({ is_approved: newApproved }).eq('user_id', u.user_id);
    if (error) toast.error(error.message);
    else {
      await logAction(newApproved ? 'approve_user' : 'unapprove_user', u.user_id);
      toast.success(newApproved ? 'User approved' : 'Approval revoked');
      fetchUsers();
    }
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    const update: Record<string, unknown> = {};
    if (editForm.full_name !== undefined) update.full_name = editForm.full_name;
    if (editForm.phone !== undefined) update.phone = editForm.phone;
    if (editForm.address !== undefined) update.address = editForm.address;
    if (editForm.store_name !== undefined) update.store_name = editForm.store_name;
    if (editForm.business_address !== undefined) update.business_address = editForm.business_address;
    if (editForm.gst_number !== undefined) update.gst_number = editForm.gst_number || null;

    const { error } = await supabase.from('profiles').update(update).eq('user_id', selectedUser.user_id);
    if (error) toast.error(error.message);
    else {
      await logAction('edit_profile', selectedUser.user_id, update);
      toast.success('Profile updated');
      setEditMode(false);
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const openUserDetail = (u: UserWithRoles, edit = false) => {
    setSelectedUser(u);
    setEditMode(edit);
    if (edit) {
      setEditForm({
        full_name: u.full_name || '',
        phone: u.phone || '',
        address: u.address || '',
        store_name: u.store_name || '',
        business_address: u.business_address || '',
        gst_number: u.gst_number || '',
      });
    }
  };

  const roleColorMap: Record<string, string> = {
    admin: 'bg-destructive/10 text-destructive',
    seller: 'bg-primary/10 text-primary',
    customer: 'bg-accent text-accent-foreground',
    delivery_boy: 'bg-orange-100 text-orange-800',
  };

  const filtered = users.filter(u => {
    const matchesSearch = !search ||
      (u.full_name?.toLowerCase().includes(search.toLowerCase())) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone?.includes(search)) ||
      (u.store_name?.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.roles.includes(roleFilter as AppRole);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'blocked' && u.is_blocked) ||
      (statusFilter === 'active' && !u.is_blocked) ||
      (statusFilter === 'unapproved' && !u.is_approved);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <DashboardLayout title="User Management" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Users', value: users.length },
            { label: 'Customers', value: users.filter(u => u.roles.includes('customer')).length },
            { label: 'Sellers', value: users.filter(u => u.roles.includes('seller')).length },
            { label: 'Delivery', value: users.filter(u => u.roles.includes('delivery_boy')).length },
            { label: 'Blocked', value: users.filter(u => u.is_blocked).length },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-heading font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="seller">Seller</SelectItem>
              <SelectItem value="delivery_boy">Delivery</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="unapproved">Unapproved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User list */}
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {u.full_name || u.store_name || 'Unknown'}
                    {u.is_blocked && <span className="ml-2 text-xs text-destructive">(Blocked)</span>}
                    {!u.is_approved && <span className="ml-2 text-xs text-warning">(Unapproved)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email} {u.phone ? `· ${u.phone}` : ''}</p>
                  <div className="flex gap-1 mt-1">
                    {u.roles.map(r => (
                      <Badge key={r} variant="outline" className={`text-[10px] px-1.5 py-0 ${roleColorMap[r] || ''}`}>
                        {r === 'delivery_boy' ? 'Delivery' : r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openUserDetail(u)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openUserDetail(u, true)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant={u.is_blocked ? 'default' : 'outline'} onClick={() => toggleBlock(u)}>
                    {u.is_blocked ? <Shield className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </Button>
                  {(u.roles.includes('seller') || u.roles.includes('delivery_boy')) && (
                    <Button size="icon" variant={u.is_approved ? 'outline' : 'default'} onClick={() => toggleApproval(u)}>
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Detail / Edit Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) { setSelectedUser(null); setEditMode(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit User' : 'User Details'}</DialogTitle>
          </DialogHeader>
          {selectedUser && !editMode && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedUser.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-1 mt-1">
                    {selectedUser.roles.map(r => (
                      <Badge key={r} variant="outline" className={`text-xs ${roleColorMap[r] || ''}`}>
                        {r === 'delivery_boy' ? 'Delivery' : r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{selectedUser.phone || '—'}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className={selectedUser.is_blocked ? 'text-destructive' : 'text-foreground'}>{selectedUser.is_blocked ? 'Blocked' : 'Active'}</span></div>
                <div><span className="text-muted-foreground">Approved:</span> <span className="text-foreground">{selectedUser.is_approved ? 'Yes' : 'No'}</span></div>
                <div><span className="text-muted-foreground">Joined:</span> <span className="text-foreground">{new Date(selectedUser.created_at).toLocaleDateString()}</span></div>
                {selectedUser.address && <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{selectedUser.address}</span></div>}
                {selectedUser.store_name && <div className="col-span-2"><span className="text-muted-foreground">Store:</span> <span className="text-foreground">{selectedUser.store_name}</span></div>}
                {selectedUser.business_address && <div className="col-span-2"><span className="text-muted-foreground">Business Addr:</span> <span className="text-foreground">{selectedUser.business_address}</span></div>}
                {selectedUser.gst_number && <div><span className="text-muted-foreground">GST:</span> <span className="text-foreground">{selectedUser.gst_number}</span></div>}
                {selectedUser.vehicle_type && <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground capitalize">{selectedUser.vehicle_type}</span></div>}
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setEditMode(true); setEditForm({ full_name: selectedUser.full_name || '', phone: selectedUser.phone || '', address: selectedUser.address || '', store_name: selectedUser.store_name || '', business_address: selectedUser.business_address || '', gst_number: selectedUser.gst_number || '' }); }}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
            </div>
          )}
          {selectedUser && editMode && (
            <div className="space-y-3">
              <div><Label>Full Name</Label><Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
              {selectedUser.roles.includes('seller') && (
                <>
                  <div><Label>Store Name</Label><Input value={editForm.store_name} onChange={e => setEditForm(f => ({ ...f, store_name: e.target.value }))} /></div>
                  <div><Label>Business Address</Label><Input value={editForm.business_address} onChange={e => setEditForm(f => ({ ...f, business_address: e.target.value }))} /></div>
                  <div><Label>GST Number</Label><Input value={editForm.gst_number} onChange={e => setEditForm(f => ({ ...f, gst_number: e.target.value }))} /></div>
                </>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveEdit}>Save</Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
