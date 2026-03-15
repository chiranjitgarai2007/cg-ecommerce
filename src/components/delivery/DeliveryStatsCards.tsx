import { EnrichedDelivery } from '@/types/delivery';

interface DeliveryStatsCardsProps {
  active: EnrichedDelivery[];
  completed: EnrichedDelivery[];
  total: number;
}

export default function DeliveryStatsCards({ active, completed, total }: DeliveryStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Active</p>
        <p className="text-2xl font-heading font-bold text-primary">{active.length}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Completed</p>
        <p className="text-2xl font-heading font-bold text-success">{completed.length}</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="text-2xl font-heading font-bold text-foreground">{total}</p>
      </div>
    </div>
  );
}
