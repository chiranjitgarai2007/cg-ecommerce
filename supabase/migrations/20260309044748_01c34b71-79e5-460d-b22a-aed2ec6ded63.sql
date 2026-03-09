
-- Create billing_cycles table for 15-day credit billing
CREATE TABLE public.billing_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add billing_cycle_id to orders
ALTER TABLE public.orders ADD COLUMN billing_cycle_id UUID REFERENCES public.billing_cycles(id);

-- Enable RLS
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

-- Customers can view their own billing cycles
CREATE POLICY "Customers can view own billing cycles"
ON public.billing_cycles FOR SELECT
USING (auth.uid() = customer_id);

-- Customers can insert their own billing cycles
CREATE POLICY "Customers can insert own billing cycles"
ON public.billing_cycles FOR INSERT
WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own billing cycles
CREATE POLICY "Customers can update own billing cycles"
ON public.billing_cycles FOR UPDATE
USING (auth.uid() = customer_id);

-- Admins can manage all billing cycles
CREATE POLICY "Admins can manage billing cycles"
ON public.billing_cycles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Sellers can view billing cycles for orders containing their products
CREATE POLICY "Sellers can view related billing cycles"
ON public.billing_cycles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.billing_cycle_id = billing_cycles.id
  AND oi.seller_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_billing_cycles_updated_at
BEFORE UPDATE ON public.billing_cycles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get or create current billing cycle for a customer
CREATE OR REPLACE FUNCTION public.get_or_create_billing_cycle(_customer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cycle_id UUID;
  _today DATE := CURRENT_DATE;
BEGIN
  -- Find active cycle
  SELECT id INTO _cycle_id
  FROM billing_cycles
  WHERE customer_id = _customer_id
    AND _today BETWEEN start_date AND end_date
    AND is_paid = false
  LIMIT 1;

  -- Create new cycle if none exists
  IF _cycle_id IS NULL THEN
    INSERT INTO billing_cycles (customer_id, start_date, end_date)
    VALUES (_customer_id, _today, _today + INTERVAL '14 days')
    RETURNING id INTO _cycle_id;
  END IF;

  RETURN _cycle_id;
END;
$$;
