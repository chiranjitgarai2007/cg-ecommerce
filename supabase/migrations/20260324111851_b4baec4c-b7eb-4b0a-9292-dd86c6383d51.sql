
-- Drop the overly permissive insert policy
DROP POLICY "Authenticated can insert delivery OTPs" ON public.delivery_otps;

-- More restrictive: only allow insert if user is delivery boy for this delivery or seller for this order or admin
CREATE POLICY "Delivery boys and sellers can insert delivery OTPs"
ON public.delivery_otps FOR INSERT
TO authenticated
WITH CHECK (
  delivery_id IN (SELECT id FROM public.deliveries WHERE delivery_boy_id = auth.uid())
  OR order_id IN (SELECT get_seller_order_ids(auth.uid()))
  OR has_role(auth.uid(), 'admin')
);
