
-- Allow sellers to insert notifications for delivery boys
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow delivery boys to view and update deliveries with null delivery_boy_id (available tasks)
DROP POLICY IF EXISTS "Delivery boys can view assigned deliveries" ON public.deliveries;
CREATE POLICY "Delivery boys can view available and assigned deliveries"
ON public.deliveries
FOR SELECT
TO authenticated
USING (
  delivery_boy_id = auth.uid() 
  OR (delivery_boy_id IS NULL AND has_role(auth.uid(), 'delivery_boy'))
);

DROP POLICY IF EXISTS "Delivery boys can update own deliveries" ON public.deliveries;
CREATE POLICY "Delivery boys can update available and own deliveries"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (
  delivery_boy_id = auth.uid() 
  OR (delivery_boy_id IS NULL AND has_role(auth.uid(), 'delivery_boy'))
);

-- Allow sellers to insert deliveries for their orders
CREATE POLICY "Sellers can insert deliveries for their orders"
ON public.deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (SELECT get_seller_order_ids(auth.uid()))
);
