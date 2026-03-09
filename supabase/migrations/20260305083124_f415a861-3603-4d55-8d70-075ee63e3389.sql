
-- =====================================================
-- 1. SECURITY DEFINER helper functions to avoid RLS recursion
-- =====================================================

-- Get order IDs for a customer
CREATE OR REPLACE FUNCTION public.get_customer_order_ids(_user_id uuid)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM orders WHERE customer_id = _user_id;
$$;

-- Get order IDs for a seller (via order_items)
CREATE OR REPLACE FUNCTION public.get_seller_order_ids(_user_id uuid)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT oi.order_id FROM order_items oi WHERE oi.seller_id = _user_id;
$$;

-- Get order IDs for a delivery boy (via deliveries table)
CREATE OR REPLACE FUNCTION public.get_delivery_boy_order_ids(_user_id uuid)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.order_id FROM deliveries d WHERE d.delivery_boy_id = _user_id;
$$;

-- =====================================================
-- 2. Drop ALL existing orders policies
-- =====================================================
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;

-- =====================================================
-- 3. Recreate orders policies using helper functions (NO recursion)
-- =====================================================

-- Customers can INSERT their own orders
CREATE POLICY "Customers can create orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = customer_id);

-- Customers can SELECT their own orders
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = customer_id);

-- Customers can UPDATE their own orders (e.g. cancel)
CREATE POLICY "Customers can update own orders"
ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() = customer_id);

-- Sellers can view orders containing their products
CREATE POLICY "Sellers can view orders with their products"
ON public.orders FOR SELECT TO authenticated
USING (id IN (SELECT get_seller_order_ids(auth.uid())));

-- Sellers can update orders containing their products
CREATE POLICY "Sellers can update orders with their products"
ON public.orders FOR UPDATE TO authenticated
USING (id IN (SELECT get_seller_order_ids(auth.uid())));

-- Delivery boys can view orders assigned to them
CREATE POLICY "Delivery boys can view assigned orders"
ON public.orders FOR SELECT TO authenticated
USING (id IN (SELECT get_delivery_boy_order_ids(auth.uid())));

-- Admins can do everything on orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- 4. Fix order_items policies (also had recursion via orders subquery)
-- =====================================================
DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Customers can view own order items"
ON public.order_items FOR SELECT TO authenticated
USING (order_id IN (SELECT get_customer_order_ids(auth.uid())));

CREATE POLICY "Customers can insert order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (order_id IN (SELECT get_customer_order_ids(auth.uid())));

CREATE POLICY "Sellers can view their order items"
ON public.order_items FOR SELECT TO authenticated
USING (seller_id = auth.uid());

CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- 5. Fix deliveries - allow customers to view their order deliveries
-- =====================================================
CREATE POLICY "Customers can view own deliveries"
ON public.deliveries FOR SELECT TO authenticated
USING (order_id IN (SELECT get_customer_order_ids(auth.uid())));

-- =====================================================
-- 6. Fix profiles - allow delivery boy profiles to be read by customers (for tracking)
-- =====================================================
DROP POLICY IF EXISTS "Public profiles for sellers" ON public.profiles;

CREATE POLICY "Public profiles for sellers and delivery boys"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = profiles.user_id
    AND user_roles.role IN ('seller', 'delivery_boy')
  )
);

-- =====================================================
-- 7. Create notifications table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Allow system (service role) or authenticated users to insert
CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =====================================================
-- 8. Create order notification trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller_id uuid;
  _delivery_boy_id uuid;
  _customer_id uuid;
BEGIN
  _customer_id := NEW.customer_id;

  -- New order placed → notify sellers
  IF TG_OP = 'INSERT' THEN
    FOR _seller_id IN
      SELECT DISTINCT oi.seller_id FROM order_items oi WHERE oi.order_id = NEW.id AND oi.seller_id IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, title, message, type, related_order_id)
      VALUES (_seller_id, 'New Order Received', 'You have a new order #' || LEFT(NEW.id::text, 8), 'new_order', NEW.id);
    END LOOP;
  END IF;

  -- Status changed
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify customer on every status change
    INSERT INTO notifications (user_id, title, message, type, related_order_id)
    VALUES (_customer_id, 'Order Update', 'Your order #' || LEFT(NEW.id::text, 8) || ' is now ' || REPLACE(NEW.status::text, '_', ' '), 'order_update', NEW.id);

    -- If order is confirmed/processing → notify delivery boys via admin assignment (handled elsewhere)
    -- If shipped → notify customer specifically
    IF NEW.status = 'shipped' THEN
      -- Find assigned delivery boy
      SELECT d.delivery_boy_id INTO _delivery_boy_id FROM deliveries d WHERE d.order_id = NEW.id LIMIT 1;
      IF _delivery_boy_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (_delivery_boy_id, 'New Delivery Assigned', 'Pickup order #' || LEFT(NEW.id::text, 8), 'delivery_assigned', NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_order_change ON public.orders;
CREATE TRIGGER on_order_change
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_order_change();
