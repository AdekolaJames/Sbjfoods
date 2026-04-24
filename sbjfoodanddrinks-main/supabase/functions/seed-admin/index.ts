import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Create admin user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "admin@sbjfoods.com",
      password: "SBJFoods@2026",
      email_confirm: true,
      user_metadata: { full_name: "SBJ Admin" },
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw authError;
    }

    let userId = authData?.user?.id;

    // If user already exists, look up their ID
    if (!userId) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users?.find((u: any) => u.email === "admin@sbjfoods.com");
      userId = existing?.id;
    }

    if (!userId) throw new Error("Could not find or create admin user");

    // 2. Assign admin role (upsert)
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });
    if (roleError) console.error("Role error:", roleError);

    // 3. Create default branches
    const branches = [
      { name: "SBJ Foods and Drinks INDY", code: "INDY", address: "Ibadan", is_active: true },
      { name: "SBJ Foods and Drinks ITH", code: "ITH", address: "Ibadan", is_active: true },
    ];

    for (const branch of branches) {
      const { error } = await supabase
        .from("branches")
        .upsert(branch, { onConflict: "code" });
      if (error) console.error("Branch error:", error);
    }

    // 4. Update admin profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: "SBJ Admin" })
      .eq("user_id", userId);
    if (profileError) console.error("Profile error:", profileError);

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
