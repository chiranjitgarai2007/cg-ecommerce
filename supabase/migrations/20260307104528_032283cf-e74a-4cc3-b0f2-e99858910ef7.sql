
-- Tighten notification insert: allow authenticated users to insert notifications for others (sellers notify delivery boys)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can insert for themselves OR sellers/admins can insert for others
  user_id = auth.uid()
  OR has_role(auth.uid(), 'seller')
  OR has_role(auth.uid(), 'admin')
);
