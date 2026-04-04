const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Try to sign in with provided credentials
    const tempClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({ email, password })

    if (signInError || !signInData.user) {
      return new Response(JSON.stringify({ error: 'Credenciais inválidas' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user has admin or superadmin role
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', signInData.user.id)
    const userRoles = (roles || []).map(r => r.role)

    // Sign out the temp session immediately
    await tempClient.auth.signOut()

    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return new Response(JSON.stringify({ error: 'Usuário não é administrador' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
