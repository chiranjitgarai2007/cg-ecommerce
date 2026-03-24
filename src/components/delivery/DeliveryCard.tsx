import { useState } from 'react';
import { CheckCircle, MapPin, Navigation, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnrichedDelivery, DeliveryStatus } from '@/types/delivery';
import OtpVerification from './OtpVerification';

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
  const [otpVerified, setOtpVerified] = useState(false);
  const customerLat = d.order?.latitude;
  const customerLng = d.order?.longitude;
  const hasCustomerLocation = customerLat && customerLng;

  const sellerLat = d.seller_latitude;
  const sellerLng = d.seller_longitude;
  const hasSellerLocation = sellerLat && sellerLng;

  const getNavigationUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  };

  const showPickupNav = ['assigned', 'accepted'].includes(d.status);
  const showDeliveryNav = ['picked_up', 'on_the_way'].includes(d.status);

  // For "on_the_way" status, require OTP before allowing "Mark Delivered"
  const needsOtpForDelivery = d.status === 'on_the_way';

  const handleOtpVerified = () => {
    setOtpVerified(true);
    onUpdateStatus(d.id, d.status);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-foreground">Order #{d.order_id.slice(0, 8)}</p>
          <Badge variant="outline" className="mt-1 capitalize">{d.status.replace('_', ' ')}</Badge>
        </div>
        {d.order && (
          <p className="text-sm font-semibold text-primary">₹{d.order.total_amount.toLocaleString()}</p>
        )}
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
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-foreground">{d.seller_address}</p>
          </div>
          {showPickupNav && hasSellerLocation && (
            <a href={getNavigationUrl(sellerLat, sellerLng)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                <Navigation className="w-3 h-3" /> Navigate
              </Button>
            </a>
          )}
        </div>

        {d.order && (
          <>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Delivery to {d.order.customer_name}</p>
                <p className="text-foreground">{d.order.shipping_address}</p>
                {d.order.landmark && <p className="text-xs text-muted-foreground">Landmark: {d.order.landmark}</p>}
              </div>
              {showDeliveryNav && hasCustomerLocation && (
                <a href={getNavigationUrl(customerLat, customerLng)} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                    <Navigation className="w-3 h-3" /> Navigate
                  </Button>
                </a>
              )}
            </div>

            {showDeliveryNav && hasCustomerLocation && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-medium text-foreground">Customer Location Available</span>
                </div>
                <a href={getNavigationUrl(customerLat, customerLng)} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="sm" className="w-full gap-2">
                    <Navigation className="w-4 h-4" /> Open in Google Maps
                  </Button>
                </a>
              </div>
            )}

            {showPickupNav && hasSellerLocation && (
              <div className="bg-accent/30 border border-accent rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Navigate to Pickup Location</span>
                </div>
                <a href={getNavigationUrl(sellerLat, sellerLng)} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="sm" variant="outline" className="w-full gap-2">
                    <Navigation className="w-4 h-4" /> Open Pickup in Maps
                  </Button>
                </a>
              </div>
            )}

            {d.order.contact_number && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${d.order.contact_number}`} className="text-primary text-sm">{d.order.contact_number}</a>
              </div>
            )}
          </>
        )}
      </div>

      {/* OTP Verification for delivery completion */}
      {needsOtpForDelivery && !otpVerified && (
        <OtpVerification
          orderId={d.order_id}
          deliveryId={d.id}
          onVerified={handleOtpVerified}
        />
      )}

      <div className="flex gap-2 pt-2">
        {statusFlow[d.status] && !needsOtpForDelivery && (
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
