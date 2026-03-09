
-- Food menus table (seller's base meals)
CREATE TABLE public.food_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  meal_type TEXT NOT NULL DEFAULT 'lunch',
  rice_description TEXT NOT NULL DEFAULT 'Plain Rice',
  vegetable_details TEXT NOT NULL DEFAULT 'Mixed Vegetables',
  base_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Food add-ons table
CREATE TABLE public.food_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID NOT NULL REFERENCES public.food_menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments table for billing cycles
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  billing_cycle_id UUID NOT NULL REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Food menus policies
CREATE POLICY "Anyone can view active food menus" ON public.food_menus FOR SELECT USING (is_active = true);
CREATE POLICY "Sellers can manage own food menus" ON public.food_menus FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all food menus" ON public.food_menus FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Food addons policies
CREATE POLICY "Anyone can view available food addons" ON public.food_addons FOR SELECT USING (true);
CREATE POLICY "Sellers can manage addons for own menus" ON public.food_addons FOR ALL USING (menu_id IN (SELECT id FROM public.food_menus WHERE seller_id = auth.uid())) WITH CHECK (menu_id IN (SELECT id FROM public.food_menus WHERE seller_id = auth.uid()));
CREATE POLICY "Admins can manage all food addons" ON public.food_addons FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payments policies
CREATE POLICY "Customers can view own payments" ON public.payments FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers can update own payments" ON public.payments FOR UPDATE USING (auth.uid() = customer_id);
CREATE POLICY "Sellers can view related payments" ON public.payments FOR SELECT USING (
  billing_cycle_id IN (
    SELECT bc.id FROM billing_cycles bc
    JOIN orders o ON o.billing_cycle_id = bc.id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.seller_id = auth.uid()
  )
);
CREATE POLICY "Sellers can update related payments" ON public.payments FOR UPDATE USING (
  billing_cycle_id IN (
    SELECT bc.id FROM billing_cycles bc
    JOIN orders o ON o.billing_cycle_id = bc.id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.seller_id = auth.uid()
  )
);
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_food_menus_updated_at BEFORE UPDATE ON public.food_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
