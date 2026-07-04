import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const seeds = [
      { email: "admin@carnauba.com", password: "123456", name: "Proprietário", role: "admin", tenant_slug: null },
      { email: "atendente@carnauba.com", password: "123456", name: "Atendente", role: "atendente", tenant_slug: null },
      { email: "fabiano@gmail.com", password: "xofome@123", name: "Fabiano", role: "admin", tenant_slug: "xofome" },
    ];

    const results: any[] = [];
    const { data: existingUsers } = await supabase.auth.admin.listUsers();

    for (const u of seeds) {
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
      let userId: string | null = null;

      if (existing) {
        userId = existing.id;
        // Always update password to keep seed idempotent
        await supabase.auth.admin.updateUser(userId, { password: u.password });
        results.push({ email: u.email, status: "updated_password", id: userId });
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email, password: u.password, email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error) { results.push({ email: u.email, status: "error", error: error.message }); continue; }
        userId = data.user!.id;
        results.push({ email: u.email, status: "created", id: userId });
      }

      // Ensure role
      await supabase.from("user_roles").upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });

      // Ensure profile
      await supabase.from("profiles").upsert({ id: userId, name: u.name, email: u.email }, { onConflict: "id" });

      // Ensure tenant membership when slug provided
      if (u.tenant_slug) {
        const { data: t } = await supabase.from("tenants").select("id").eq("slug", u.tenant_slug).maybeSingle();
        if (t?.id) {
          await supabase.from("tenant_members").upsert(
            { user_id: userId, tenant_id: t.id, role: u.role },
            { onConflict: "user_id,tenant_id" }
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
