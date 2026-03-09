
-- Order status log for audit trail
CREATE TABLE public.order_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;

-- Customers can view logs for their orders
CREATE POLICY "Customers can view own order logs"
  ON public.order_status_log FOR SELECT
  USING (order_id IN (SELECT get_customer_order_ids(auth.uid())));

-- Sellers can view logs for their orders
CREATE POLICY "Sellers can view order logs"
  ON public.order_status_log FOR SELECT
  USING (order_id IN (SELECT get_seller_order_ids(auth.uid())));

-- Admins full access
CREATE POLICY "Admins can manage order logs"
  ON public.order_status_log FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Delivery boys can view logs for their deliveries
CREATE POLICY "Delivery boys can view order logs"
  ON public.order_status_log FOR SELECT
  USING (order_id IN (SELECT get_delivery_boy_order_ids(auth.uid())));

-- Allow insert from triggers (service role)
CREATE POLICY "System can insert logs"
  ON public.order_status_log FOR INSERT
  WITH CHECK (true);

-- Add estimated_preparation_time to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_preparation_time integer;

-- Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_status_log (order_id, status, note)
    VALUES (NEW.id, NEW.status::text, 'Order placed');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_log (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_order_status
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- Enable realtime for status log
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_log;
