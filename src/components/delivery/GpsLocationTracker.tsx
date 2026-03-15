import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface GpsLocationTrackerProps {
  hasActiveDeliveries: boolean;
}

export default function GpsLocationTracker({ hasActiveDeliveries }: GpsLocationTrackerProps) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    setCoords({ lat, lng });
    const now = new Date();
    setLastUpdated(now);

    // Update all active deliveries with current location
    await supabase
      .from('deliveries')
      .update({
        current_latitude: lat,
        current_longitude: lng,
        location_updated_at: now.toISOString(),
      })
      .eq('delivery_boy_id', user.id)
      .in('status', ['accepted', 'picked_up', 'on_the_way']);
  }, [user]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        toast.error('Location access denied: ' + err.message);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    watchIdRef.current = id;
    setTracking(true);
    toast.success('GPS tracking started');
  }, [updateLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    toast.info('GPS tracking stopped');
  }, []);

  // Auto-stop when no active deliveries
  useEffect(() => {
    if (!hasActiveDeliveries && tracking) {
      stopTracking();
    }
  }, [hasActiveDeliveries, tracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          <h4 className="font-heading font-semibold text-foreground">GPS Location</h4>
        </div>
        <Badge variant={tracking ? 'default' : 'secondary'} className={tracking ? 'bg-success text-success-foreground' : ''}>
          {tracking ? 'Live' : 'Off'}
        </Badge>
      </div>

      {coords && (
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
          </div>
          {lastUpdated && (
            <p className="text-xs">Last updated: {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
      )}

      {hasActiveDeliveries ? (
        <Button
          size="sm"
          variant={tracking ? 'destructive' : 'default'}
          onClick={tracking ? stopTracking : startTracking}
          className="w-full"
        >
          {tracking ? (
            <>Stop Tracking</>
          ) : (
            <><Navigation className="w-3 h-3 mr-1" /> Start GPS Tracking</>
          )}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground text-center">No active deliveries to track</p>
      )}
    </div>
  );
}
