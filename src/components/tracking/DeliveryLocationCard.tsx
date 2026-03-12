import { MapPin, Navigation, Phone, Truck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeliveryLocationCardProps {
  deliveryBoy: { full_name: string; phone: string | null } | null;
  delivery: {
    status: string;
    current_latitude?: number | null;
    current_longitude?: number | null;
    location_updated_at?: string | null;
  } | null;
  orderStatus: string;
}

export default function DeliveryLocationCard({ deliveryBoy, delivery, orderStatus }: DeliveryLocationCardProps) {
  if (!deliveryBoy) return null;

  const isActiveDelivery = ['picked_up', 'on_the_way'].includes(orderStatus);
  const hasLocation = delivery?.current_latitude && delivery?.current_longitude;
  const locationAge = delivery?.location_updated_at
    ? Math.round((Date.now() - new Date(delivery.location_updated_at).getTime()) / 60000)
    : null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4">
        <h3 className="font-heading font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" />
          ডেলিভারি পার্টনার
        </h3>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{deliveryBoy.full_name}</p>
            {deliveryBoy.phone && (
              <p className="text-xs text-muted-foreground">{deliveryBoy.phone}</p>
            )}
            {delivery && (
              <p className="text-xs text-primary font-medium capitalize mt-0.5">
                {delivery.status.replace(/_/g, ' ')}
              </p>
            )}
          </div>
          {deliveryBoy.phone && (
            <a href={`tel:${deliveryBoy.phone}`}>
              <Button variant="outline" size="icon" className="rounded-full">
                <Phone className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Live Location Section */}
      {isActiveDelivery && (
        <div className="border-t border-border p-4 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-foreground">লাইভ ট্র্যাকিং চালু আছে</span>
          </div>

          {hasLocation ? (
            <div className="space-y-2">
              {/* Map placeholder with coordinates */}
              <div className="relative bg-muted rounded-lg h-32 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="w-full h-full" style={{
                    backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }} />
                </div>
                <div className="text-center z-10">
                  <Navigation className="w-8 h-8 text-primary mx-auto mb-1 animate-bounce" />
                  <p className="text-xs text-muted-foreground">
                    {delivery!.current_latitude!.toFixed(4)}°N, {delivery!.current_longitude!.toFixed(4)}°E
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>GPS লোকেশন</span>
                </div>
                {locationAge !== null && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{locationAge < 1 ? 'এইমাত্র' : `${locationAge} মিনিট আগে`}</span>
                  </div>
                )}
              </div>

              <a
                href={`https://www.google.com/maps?q=${delivery!.current_latitude},${delivery!.current_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full mt-1">
                  <Navigation className="w-3.5 h-3.5 mr-1.5" />
                  Google Maps-এ দেখুন
                </Button>
              </a>
            </div>
          ) : (
            <div className="bg-muted rounded-lg h-24 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">লোকেশন আপডেটের জন্য অপেক্ষা করা হচ্ছে...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
