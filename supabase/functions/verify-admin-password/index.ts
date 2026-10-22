const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, password } = await req.json()
    if (!password) return json({ error: 'Senha obrigatória' }, 400)

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let candidates: { id: string; email: string; name: string }[] = []
    if (email) {
      const authHeader = req.headers.get('Authorization') || ''
      const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
      const { data: u } = await caller.auth.getUser()
      let login = String(email).trim().toLowerCase()
      if (u?.user) {
        const { data: mine } = await admin.from('tenant_members').select('tenant_id').eq('user_id', u.user.id).order('created_at').limit(1).maybeSingle()
        if (mine) {
          const { data: m } = await admin.from('tenant_members').select('login_email').eq('tenant_id', mine.tenant_id).ilike('email', login).maybeSingle()
          if (m?.login_email) login = m.login_email
        }
      }
      candidates = [{ id: '', email: login, name: '' }]
    } else {
      // Password-only mode: check against admins of the caller's tenant
      const authHeader = req.headers.get('Authorization') || ''
      const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
      const { data: u } = await caller.auth.getUser()
      if (!u?.user) return json({ error: 'Não autenticado' }, 401)
      const { data: mem } = await admin.from('tenant_members').select('tenant_id').eq('user_id', u.user.id).order('created_at').limit(1).maybeSingle()
      if (!mem) return json({ error: 'Sem loja' }, 403)
      const { data: admins } = await admin.from('tenant_members').select('user_id, login_email').eq('tenant_id', mem.tenant_id).in('role', ['admin', 'superadmin'])
      const ids = (admins || []).map((a) => a.user_id)
      if (ids.length === 0) return json({ error: 'Nenhum administrador' }, 403)
      const { data: profs } = await admin.from('profiles').select('id, email, name').in('id', ids)
      candidates = (admins || []).map((a) => {
        const p = (profs || []).find((x) => x.id === a.user_id)
        return { id: a.user_id, email: a.login_email || p?.email || '', name: p?.name || '' }
      }).filter((c) => c.email)
    }

    for (const c of candidates) {
      const temp = createClient(url, anon, { auth: { persistSession: false } })
      const { data, error } = await temp.auth.signInWithPassword({ email: c.email, password })
      if (error || !data.user) continue
      await temp.auth.signOut()
      const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', data.user.id)
      const r = (roles || []).map((x) => x.role)
      if (r.includes('admin') || r.includes('superadmin')) {
        return json({ success: true, admin_id: data.user.id, admin_name: c.name || c.email })
      }
    }
    return json({ error: 'Senha de administrador incorreta' }, 401)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
