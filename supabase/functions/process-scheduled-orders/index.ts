import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const activationWindow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour ahead

  try {
    // 1. Activate scheduled orders whose scheduled_time is within the next hour
    const { data: scheduledOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("id, customer_id, recurring_schedule_id, scheduled_time")
      .eq("status", "scheduled")
      .lte("scheduled_time", activationWindow.toISOString())
      .order("scheduled_time", { ascending: true });

    if (fetchErr) throw fetchErr;

    let activatedCount = 0;
    for (const order of scheduledOrders || []) {
      // Update status to pending
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ status: "pending" })
        .eq("id", order.id);

      if (updateErr) {
        console.error(`Failed to activate order ${order.id}:`, updateErr);
        continue;
      }
      activatedCount++;

      // Notify customer
      await supabase.from("notifications").insert({
        user_id: order.customer_id,
        title: "Scheduled Order Activated",
        message: `Your scheduled order #${order.id.slice(0, 8)} is now being processed.`,
        type: "order_update",
        related_order_id: order.id,
      });
    }

    // 2. Generate next occurrences for recurring schedules
    const today = now.toISOString().split("T")[0];
    const { data: activeSchedules, error: schedErr } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("is_active", true);

    if (schedErr) throw schedErr;

    let generatedCount = 0;
    for (const schedule of activeSchedules || []) {
      // Check if end_date passed
      if (schedule.end_date && schedule.end_date < today) {
        await supabase
          .from("recurring_schedules")
          .update({ is_active: false })
          .eq("id", schedule.id);
        continue;
      }

      // Determine next date to generate
      const lastGenerated = schedule.last_generated_date || schedule.start_date;
      const nextDate = getNextOccurrence(
        lastGenerated,
        schedule.pattern,
        schedule.custom_days,
        today
      );

      if (!nextDate) continue;
      if (schedule.end_date && nextDate > schedule.end_date) continue;

      // Check if we should generate (only if next date is within 2 days)
      const nextDateObj = new Date(nextDate + "T00:00:00Z");
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      if (nextDateObj > twoDaysFromNow) continue;

      // Check no existing order for this date & schedule
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("recurring_schedule_id", schedule.id)
        .eq("scheduled_date", nextDate)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already generated, update last_generated_date
        await supabase
          .from("recurring_schedules")
          .update({ last_generated_date: nextDate })
          .eq("id", schedule.id);
        continue;
      }

      const orderData = schedule.order_data as any;
      const scheduledTime = new Date(
        `${nextDate}T${schedule.scheduled_time}`
      );

      // Create the order
      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_id: schedule.customer_id,
          total_amount: orderData.total_amount,
          shipping_address: orderData.shipping_address,
          payment_method: orderData.payment_method || "cod",
          payment_status: "pending",
          delivery_type: orderData.delivery_type || "standard",
          latitude: orderData.latitude,
          longitude: orderData.longitude,
          landmark: orderData.landmark,
          contact_number: orderData.contact_number,
          scheduled_date: nextDate,
          scheduled_time: scheduledTime.toISOString(),
          food_preferences: orderData.food_preferences,
          seller_delivers: orderData.seller_delivers || false,
          recurring_schedule_id: schedule.id,
          status: "scheduled",
          billing_cycle_id: null,
        })
        .select()
        .single();

      if (orderErr) {
        console.error(`Failed to create recurring order:`, orderErr);
        continue;
      }

      // Insert order items
      if (orderData.items && newOrder) {
        const items = orderData.items.map((item: any) => ({
          order_id: newOrder.id,
          product_id: item.product_id || null,
          seller_id: item.seller_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }));
        await supabase.from("order_items").insert(items);
      }

      // Update last_generated_date
      await supabase
        .from("recurring_schedules")
        .update({ last_generated_date: nextDate })
        .eq("id", schedule.id);

      generatedCount++;

      // Notify customer
      await supabase.from("notifications").insert({
        user_id: schedule.customer_id,
        title: "Recurring Order Scheduled",
        message: `Your recurring order for ${nextDate} has been scheduled.`,
        type: "order_update",
        related_order_id: newOrder.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        activated: activatedCount,
        generated: generatedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing scheduled orders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getNextOccurrence(
  lastDate: string,
  pattern: string,
  customDays: any,
  today: string
): string | null {
  const last = new Date(lastDate + "T00:00:00Z");
  let next: Date;

  switch (pattern) {
    case "daily":
      next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "weekdays": {
      next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
        next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      }
      break;
    }
    case "weekly":
      next = new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case "custom": {
      if (!customDays || !Array.isArray(customDays)) return null;
      // customDays is array of day numbers (0=Sun, 1=Mon, etc.)
      next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
      let attempts = 0;
      while (!customDays.includes(next.getUTCDay()) && attempts < 14) {
        next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
        attempts++;
      }
      if (attempts >= 14) return null;
      break;
    }
    default:
      return null;
  }

  const nextStr = next.toISOString().split("T")[0];
  // Don't generate for past dates, but allow today
  if (nextStr < today) {
    // Recursively find next valid date
    return getNextOccurrence(nextStr, pattern, customDays, today);
  }
  return nextStr;
}
