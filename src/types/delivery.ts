import type { Database } from '@/integrations/supabase/types';

export type Delivery = Database['public']['Tables']['deliveries']['Row'];
export type DeliveryStatus = Database['public']['Enums']['delivery_status'];

export interface EnrichedDelivery extends Delivery {
  order?: {
    shipping_address: string;
    contact_number: string | null;
    landmark: string | null;
    total_amount: number;
    customer_name?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  seller_address?: string;
  seller_latitude?: number | null;
  seller_longitude?: number | null;
  products?: { name: string; quantity: number }[];
}
