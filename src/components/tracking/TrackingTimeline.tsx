import { Package, CheckCircle, Truck, Clock, ChefHat, MapPin } from 'lucide-react';

const TRACKING_STEPS = [
  { key: 'pending', label: 'অর্ডার করা হয়েছে', icon: Package },
  { key: 'confirmed', label: 'কনফার্ম হয়েছে', icon: CheckCircle },
  { key: 'processing', label: 'রান্না হচ্ছে', icon: ChefHat },
  { key: 'shipped', label: 'রেডি / শিপড', icon: Truck },
  { key: 'picked_up', label: 'পিক আপ হয়েছে', icon: MapPin },
  { key: 'on_the_way', label: 'পথে আছে', icon: Truck },
  { key: 'delivered', label: 'ডেলিভারি সম্পন্ন', icon: CheckCircle },
];

interface StatusLog {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface TrackingTimelineProps {
  currentStatus: string;
  statusLogs: StatusLog[];
  isCancelled: boolean;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function TrackingTimeline({ currentStatus, statusLogs, isCancelled }: TrackingTimelineProps) {
  const currentIdx = TRACKING_STEPS.findIndex(s => s.key === currentStatus);

  const statusTimestamps: Record<string, string> = {};
  statusLogs.forEach(log => {
    if (!statusTimestamps[log.status]) {
      statusTimestamps[log.status] = log.created_at;
    }
  });

  if (isCancelled) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Package className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-lg font-heading font-bold text-destructive">অর্ডার বাতিল হয়েছে</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {TRACKING_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const Icon = step.icon;
        const timestamp = statusTimestamps[step.key];
        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                isCompleted ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
              } ${isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-card scale-110' : ''}`}>
                <Icon className="w-4 h-4" />
              </div>
              {idx < TRACKING_STEPS.length - 1 && (
                <div className={`w-0.5 h-8 transition-all duration-500 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
            <div className="pb-6">
              <p className={`text-sm font-medium transition-colors ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              {timestamp && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatTime(timestamp)}</p>
              )}
              {isCurrent && !timestamp && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <p className="text-xs text-primary font-medium">বর্তমান অবস্থা</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { TRACKING_STEPS };
export type { StatusLog };
