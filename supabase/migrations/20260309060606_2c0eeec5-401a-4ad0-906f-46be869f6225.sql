
-- Add 'scheduled' to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'scheduled' BEFORE 'pending';

-- Add scheduled_time and recurring_schedule_id to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_time timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurring_schedule_id uuid DEFAULT NULL;

-- Create recurring_schedules table
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  pattern text NOT NULL DEFAULT 'daily',
  custom_days jsonb DEFAULT NULL,
  scheduled_time time NOT NULL DEFAULT '13:00',
  start_date date NOT NULL,
  end_date date DEFAULT NULL,
  order_data jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_date date DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key from orders to recurring_schedules
ALTER TABLE public.orders
  ADD CONSTRAINT orders_recurring_schedule_id_fkey
  FOREIGN KEY (recurring_schedule_id) REFERENCES public.recurring_schedules(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for recurring_schedules
CREATE POLICY "Customers can view own recurring schedules"
  ON public.recurring_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert own recurring schedules"
  ON public.recurring_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update own recurring schedules"
  ON public.recurring_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete own recurring schedules"
  ON public.recurring_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Admins can manage all recurring schedules"
  ON public.recurring_schedules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
