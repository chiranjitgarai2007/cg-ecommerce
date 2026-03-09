import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Package, ShoppingBag, BarChart3, Settings, Layers, Truck, Shield, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

const actionColors: Record<string, string> = {
  block_user: 'bg-destructive/10 text-destructive',
  unblock_user: 'bg-primary/10 text-primary',
  approve_user: 'bg-green-100 text-green-800',
  unapprove_user: 'bg-yellow-100 text-yellow-800',
  edit_profile: 'bg-accent text-accent-foreground',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data || []) as AuditLog[]);
    setLoading(false);
  };

  return (
    <DashboardLayout title="Audit Logs" navItems={navItems}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Recent admin actions</p>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No audit logs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={actionColors[log.action] || 'bg-muted text-muted-foreground'}>
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                    {log.target_user_id && (
                      <span className="text-xs text-muted-foreground font-mono">
                        User: {log.target_user_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {log.changes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Changed: {Object.keys(log.changes).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
