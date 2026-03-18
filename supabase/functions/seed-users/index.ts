import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const users = [
      { email: "admin@carnauba.com", password: "123456", name: "Proprietário", role: "admin" },
      { email: "atendente@carnauba.com", password: "123456", name: "Atendente", role: "atendente" },
    ];

    const results = [];

    for (const u of users) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
      
      if (existing) {
        // Ensure role exists
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", existing.id)
          .single();
        
        if (!roleData) {
          await supabase.from("user_roles").insert({ user_id: existing.id, role: u.role });
        }
        results.push({ email: u.email, status: "already exists", id: existing.id });
        continue;
      }

      // Create user
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });

      if (error) {
        results.push({ email: u.email, status: "error", error: error.message });
        continue;
      }

      // Assign role
      if (data.user) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: u.role });
        results.push({ email: u.email, status: "created", id: data.user.id });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
