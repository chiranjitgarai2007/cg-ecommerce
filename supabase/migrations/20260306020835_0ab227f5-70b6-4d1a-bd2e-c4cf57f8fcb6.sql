
-- Add meal_type and requires_delivery_boy to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS meal_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requires_delivery_boy boolean DEFAULT false;

-- Add COMMENT for clarity
COMMENT ON COLUMN public.products.meal_type IS 'lunch, dinner, or null for non-food';
COMMENT ON COLUMN public.products.requires_delivery_boy IS 'Whether seller requires a delivery boy for this product';
