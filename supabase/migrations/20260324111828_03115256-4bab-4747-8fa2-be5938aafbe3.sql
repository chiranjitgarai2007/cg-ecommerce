
-- Create delivery OTPs table
CREATE TABLE public.delivery_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.delivery_otps ENABLE ROW LEVEL SECURITY;

-- Customers can view OTP for their own orders
CREATE POLICY "Customers can view own delivery OTPs"
ON public.delivery_otps FOR SELECT
TO authenticated
USING (order_id IN (SELECT get_customer_order_ids(auth.uid())));

-- Delivery boys can view OTP for their deliveries (to verify)
CREATE POLICY "Delivery boys can view assigned delivery OTPs"
ON public.delivery_otps FOR SELECT
TO authenticated
USING (delivery_id IN (
  SELECT id FROM public.deliveries WHERE delivery_boy_id = auth.uid()
));

-- Delivery boys can update (verify) OTPs for their deliveries
CREATE POLICY "Delivery boys can verify delivery OTPs"
ON public.delivery_otps FOR UPDATE
TO authenticated
USING (delivery_id IN (
  SELECT id FROM public.deliveries WHERE delivery_boy_id = auth.uid()
));

-- Sellers can view and verify OTPs for orders with their products
CREATE POLICY "Sellers can view delivery OTPs"
ON public.delivery_otps FOR SELECT
TO authenticated
USING (order_id IN (SELECT get_seller_order_ids(auth.uid())));

CREATE POLICY "Sellers can verify delivery OTPs"
ON public.delivery_otps FOR UPDATE
TO authenticated
USING (order_id IN (SELECT get_seller_order_ids(auth.uid())));

-- Admins can manage all OTPs
CREATE POLICY "Admins can manage delivery OTPs"
ON public.delivery_otps FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Allow authenticated users to insert OTPs (triggered during status change)
CREATE POLICY "Authenticated can insert delivery OTPs"
ON public.delivery_otps FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to generate a 6-digit OTP
CREATE OR REPLACE FUNCTION public.generate_delivery_otp(_order_id uuid, _delivery_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _otp text;
BEGIN
  _otp := lpad(floor(random() * 1000000)::text, 6, '0');
  
  INSERT INTO delivery_otps (order_id, delivery_id, otp_code)
  VALUES (_order_id, _delivery_id, _otp)
  ON CONFLICT (order_id) DO UPDATE SET
    otp_code = _otp,
    is_verified = false,
    verified_at = null,
    verified_by = null,
    created_at = now(),
    expires_at = now() + interval '24 hours';
  
  RETURN _otp;
END;
$$;
