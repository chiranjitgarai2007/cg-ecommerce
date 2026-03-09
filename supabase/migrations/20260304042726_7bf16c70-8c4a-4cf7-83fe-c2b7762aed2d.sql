
-- Add new columns to orders for checkout details
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS landmark text,
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_slot text;

-- Create addresses table for saved user addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Home',
  full_address text NOT NULL,
  landmark text,
  latitude double precision,
  longitude double precision,
  contact_number text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Sellers need to see orders for their products
CREATE POLICY "Sellers can view orders with their products" ON public.orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM order_items WHERE order_items.order_id = orders.id AND order_items.seller_id = auth.uid()
  )
);

-- Sellers can update order status
CREATE POLICY "Sellers can update orders with their products" ON public.orders FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM order_items WHERE order_items.order_id = orders.id AND order_items.seller_id = auth.uid()
  )
);
