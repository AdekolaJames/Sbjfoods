import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublicOrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  addons?: { addon_id: string; addon_name: string; quantity: number; unit_price: number }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Server misconfigured");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve authenticated customer (optional — guests allowed)
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Skip the publishable/anon key (used by guest requests) — only validate real user JWTs
      if (token !== anonKey) {
        try {
          const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data } = await userClient.auth.getClaims(token);
          if (data?.claims?.sub) authenticatedUserId = data.claims.sub as string;
        } catch (_) {
          // ignore — treat as guest
        }
      }
    }

    const {
      branch_code,
      order_type,
      customer_name,
      customer_phone,
      customer_address,
      items,
      subtotal,
      total,
    } = await req.json();

    if (!branch_code) throw new Error("branch_code required");
    if (!Array.isArray(items) || !items.length) throw new Error("items required");

    // Only takeaway / delivery accepted (kitchen + dine-in flow removed)
    const safeOrderType: "takeaway" | "delivery" =
      order_type === "delivery" ? "delivery" : "takeaway";

    if (safeOrderType === "delivery" && !customer_phone && !customer_address) {
      throw new Error("Delivery orders require a phone number or address");
    }

    // Resolve branch
    const { data: branch, error: brErr } = await admin
      .from("branches")
      .select("id, code, name")
      .eq("code", branch_code)
      .eq("is_active", true)
      .single();
    if (brErr || !branch) throw new Error("Invalid branch");

    // Resolve / create customer record (link to authenticated user when present)
    let customerId: string | null = null;
    if (authenticatedUserId) {
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();
      if (existing) {
        customerId = existing.id;
        // Update phone/address if newly provided
        await admin
          .from("customers")
          .update({
            phone: customer_phone || undefined,
            address: customer_address || undefined,
            branch_id: branch.id,
          })
          .eq("id", customerId);
      } else if (customer_phone && customer_name) {
        const { data: created } = await admin
          .from("customers")
          .insert({
            user_id: authenticatedUserId,
            name: customer_name,
            phone: customer_phone,
            address: customer_address || null,
            branch_id: branch.id,
          })
          .select("id")
          .single();
        customerId = created?.id || null;
      }
    } else if (customer_phone && customer_name) {
      // Guest customer — try to match existing record
      const { data: existing } = await admin
        .from("customers")
        .select("id")
        .eq("phone", customer_phone)
        .eq("branch_id", branch.id)
        .maybeSingle();
      customerId = existing?.id || null;
    }

    // Generate order number via RPC
    const { data: orderNum } = await admin.rpc("generate_order_number", {
      _branch_code: branch.code,
    });

    // Resolve a cashier_id (orders.cashier_id is NOT NULL). Use any admin.
    const { data: anyAdmin } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    const cashierId = anyAdmin?.user_id;
    if (!cashierId) throw new Error("No admin configured");

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        branch_id: branch.id,
        cashier_id: cashierId,
        order_number: orderNum || `WEB-${Date.now()}`,
        order_type: safeOrderType,
        table_id: null,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_address: customer_address || null,
        customer_id: customerId,
        subtotal: Number(subtotal),
        total: Number(total),
        // CRITICAL: shop orders MUST sit in pending_approval until a branch cashier approves them
        status: "pending_approval",
        payment_status: "unpaid",
        source: "shop",
        notes: "Customer self-order",
      } as any)
      .select()
      .single();
    if (oErr) throw oErr;

    for (const it of items as PublicOrderItem[]) {
      const { addons, ...itData } = it;
      const { data: oi, error: iErr } = await admin
        .from("order_items")
        .insert({ ...itData, order_id: order.id })
        .select()
        .single();
      if (iErr) throw iErr;
      if (addons?.length) {
        await admin
          .from("order_item_addons")
          .insert(addons.map((a) => ({ ...a, order_item_id: oi.id })));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_number: order.order_number,
        order_id: order.id,
        status: order.status,
        branch_name: branch.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
