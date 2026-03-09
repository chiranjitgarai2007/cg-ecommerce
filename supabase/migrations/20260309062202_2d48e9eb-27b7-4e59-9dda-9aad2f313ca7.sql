
-- Fix overly permissive INSERT policy - restrict to authenticated users only
DROP POLICY "System can insert logs" ON public.order_status_log;

-- The trigger uses SECURITY DEFINER so it bypasses RLS anyway.
-- For direct inserts, only authenticated users should be able to insert.
CREATE POLICY "Authenticated can insert order logs"
  ON public.order_status_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
