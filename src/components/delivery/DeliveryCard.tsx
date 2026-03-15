import { CheckCircle, MapPin, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnrichedDelivery, DeliveryStatus } from '@/types/delivery';

const statusFlow: Record<string, DeliveryStatus> = {
  assigned: 'accepted',
  accepted: 'picked_up',
  picked_up: 'on_the_way',
  on_the_way: 'delivered',
};

const statusLabels: Record<string, string> = {
  assigned: 'Accept Delivery',
  accepted: 'Mark Picked Up',
  picked_up: 'Start Delivery',
  on_the_way: 'Mark Delivered',
};

interface DeliveryCardProps {
  delivery: EnrichedDelivery;
  onUpdateStatus: (id: string, currentStatus: string) => void;
  onReject: (id: string) => void;
}

export default function DeliveryCard({ delivery: d, onUpdateStatus, onReject }: DeliveryCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-foreground">Order #{d.order_id.slice(0, 8)}</p>
          <Badge variant="outline" className="mt-1 capitalize">{d.status.replace('_', ' ')}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
      </div>

      {d.products && d.products.length > 0 && (
        <div className="bg-muted/50 rounded-md p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Items:</p>
          {d.products.map((p, i) => (
            <p key={i} className="text-sm text-foreground">{p.name} × {p.quantity}</p>
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-foreground">{d.seller_address}</p>
          </div>
        </div>
        {d.order && (
          <>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Delivery to {d.order.customer_name}</p>
                <p className="text-foreground">{d.order.shipping_address}</p>
                {d.order.landmark && <p className="text-xs text-muted-foreground">Landmark: {d.order.landmark}</p>}
              </div>
            </div>
            {d.order.contact_number && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${d.order.contact_number}`} className="text-primary text-sm">{d.order.contact_number}</a>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {statusFlow[d.status] && (
          <Button size="sm" onClick={() => onUpdateStatus(d.id, d.status)}>
            <CheckCircle className="w-3 h-3 mr-1" /> {statusLabels[d.status]}
          </Button>
        )}
        {d.status === 'assigned' && (
          <Button size="sm" variant="destructive" onClick={() => onReject(d.id)}>
            <XCircle className="w-3 h-3 mr-1" /> Reject
          </Button>
        )}
      </div>
    </div>
  );
}
