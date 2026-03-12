
ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS current_latitude double precision,
  ADD COLUMN IF NOT EXISTS current_longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

-- Enable realtime for deliveries table
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
