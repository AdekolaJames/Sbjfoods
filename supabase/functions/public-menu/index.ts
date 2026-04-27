import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const branchCode = url.searchParams.get("branch");
    if (!branchCode) throw new Error("branch required");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: branch } = await admin.from("branches").select("id, name, code").eq("code", branchCode).single();
    if (!branch) throw new Error("Invalid branch");

    const [items, cats, addons] = await Promise.all([
      admin.from("menu_items").select("*, menu_categories(name)").eq("branch_id", branch.id).eq("is_available", true).order("display_order"),
      admin.from("menu_categories").select("*").eq("is_active", true).or(`branch_id.eq.${branch.id},branch_id.is.null`).order("sort_order"),
      admin.from("menu_item_addons").select("*").eq("branch_id", branch.id).eq("is_available", true),
    ]);

    return new Response(JSON.stringify({ branch, items: items.data || [], categories: cats.data || [], addons: addons.data || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
