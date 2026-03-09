
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS food_preferences text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_delivers boolean DEFAULT false;
