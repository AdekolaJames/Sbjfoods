import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      branch_code,
      items,
      subtotal,
      total,
    } = await req.json();

    if (!branch_code) throw new Error("branch_code required");
    if (!Array.isArray(items)) throw new Error("items required");

    const { data: branch } = await supabase
      .from("branches")
      .select("*")
      .eq("code", branch_code)
      .single();

    if (!branch) throw new Error("Invalid branch");

    const { data: order } = await supabase
      .from("orders")
      .insert({
        branch_id: branch.id,
        order_number: `WEB-${Date.now()}`,
        subtotal,
        total,
        status: "pending_approval",
      })
      .select()
      .single();

    for (const item of items) {
      await supabase.from("order_items").insert({
        ...item,
        order_id: order.id,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});