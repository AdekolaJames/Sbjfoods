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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL missing");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!anonKey) throw new Error("Anon key missing");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();
    if (callerRole?.role !== "admin") throw new Error("Only admins can manage staff");

    const body = await req.json();
    const action = body.action || "create";

    // ---------- DELETE (soft) ----------
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id required");
      if (user_id === caller.id) throw new Error("You cannot delete your own account");

      // Safety: ensure at least one admin remains
      const { data: targetRole } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      if (targetRole?.role === "admin") {
        const { count } = await adminClient.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if ((count || 0) <= 1) throw new Error("Cannot delete the last admin account");
      }

      await adminClient.from("profiles")
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq("user_id", user_id);
      await adminClient.from("staff_branch_assignments").delete().eq("user_id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      try {
        await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876000h" } as any);
      } catch (_) { /* ignore */ }

      await adminClient.from("audit_logs").insert({
        user_id: caller.id, user_name: caller.email,
        action: "staff.delete", entity_type: "staff", entity_id: user_id,
      });
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- UPDATE STAFF DETAILS + BRANCHES + ROLE ----------
    if (action === "update") {
      const { user_id, full_name, email, role, branch_ids } = body;
      if (!user_id) throw new Error("user_id required");

      // Safety: don't allow demoting the last admin
      if (role && role !== "admin") {
        const { data: targetRole } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
        if (targetRole?.role === "admin") {
          const { count } = await adminClient.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
          if ((count || 0) <= 1) throw new Error("Cannot demote the last admin account");
        }
      }

      const profileUpdate: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (email !== undefined) profileUpdate.email = email;
      if (Array.isArray(branch_ids) && branch_ids.length > 0) profileUpdate.branch_id = branch_ids[0];
      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }

      if (email !== undefined) {
        try { await adminClient.auth.admin.updateUserById(user_id, { email }); } catch (e) {
          console.warn("Failed to update auth email", e);
        }
      }
      if (full_name !== undefined) {
        try { await adminClient.auth.admin.updateUserById(user_id, { user_metadata: { full_name } }); } catch (_) {}
      }

      if (role) {
        await adminClient.from("user_roles").upsert({ user_id, role }, { onConflict: "user_id" });
      }

      if (Array.isArray(branch_ids)) {
        await adminClient.from("staff_branch_assignments").delete().eq("user_id", user_id);
        if (branch_ids.length > 0) {
          await adminClient.from("staff_branch_assignments").insert(
            branch_ids.map((bid: string) => ({ user_id, branch_id: bid }))
          );
        }
      }

      await adminClient.from("audit_logs").insert({
        user_id: caller.id, user_name: caller.email,
        action: "staff.update", entity_type: "staff", entity_id: user_id,
        details: { full_name, email, role, branch_ids },
      });

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- RESET PASSWORD ----------
    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) throw new Error("user_id and new_password required");
      if (String(new_password).length < 6) throw new Error("Password must be at least 6 characters");

      const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (updErr) throw updErr;

      await adminClient.from("audit_logs").insert({
        user_id: caller.id, user_name: caller.email,
        action: "staff.reset_password", entity_type: "staff", entity_id: user_id,
      });

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- CREATE ----------
    const { full_name, email, password, role, branch_id, branch_ids } = body;
    if (!full_name || !email || !password || !role) {
      throw new Error("Name, email, password, and role are required");
    }
    const effectiveBranchIds: string[] = branch_ids?.length ? branch_ids : (branch_id ? [branch_id] : []);
    if (!effectiveBranchIds.length) throw new Error("At least one branch is required");

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (authError) throw authError;
    const userId = authData.user.id;

    await adminClient.from("profiles")
      .update({ full_name, branch_id: effectiveBranchIds[0] })
      .eq("user_id", userId);

    await adminClient.from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id" });

    const assignments = effectiveBranchIds.map(bid => ({ user_id: userId, branch_id: bid }));
    await adminClient.from("staff_branch_assignments").insert(assignments);

    await adminClient.from("audit_logs").insert({
      user_id: caller.id, user_name: caller.email,
      action: "staff.create", entity_type: "staff", entity_id: userId,
      details: { full_name, email, role, branch_ids: effectiveBranchIds },
    });

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
