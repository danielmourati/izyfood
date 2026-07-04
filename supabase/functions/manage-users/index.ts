const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No authorization' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    const { data: roles } = await anonClient.from('user_roles').select('role').eq('user_id', caller.id)
    const callerRoles = (roles || []).map((r: any) => r.role)
    const isSuperadmin = callerRoles.includes('superadmin')
    if (!callerRoles.includes('admin') && !isSuperadmin) return json({ error: 'Forbidden' }, 403)

    const body = await req.json()
    const { action } = body

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (action === 'create') {
      const { email, password, name, phone, role, tenant_id, commission } = body
      if (!email || !password || !name || !role || !tenant_id) return json({ error: 'Campos obrigatórios: email, senha, nome, role, tenant_id' }, 400)

      const { data, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name, role, tenant_id, phone: phone || null }
      })
      if (error) return json({ error: error.message }, 400)

      const uid = data.user!.id
      // Ensure profile has phone
      if (phone) await adminClient.from('profiles').update({ phone }).eq('id', uid)

      // Ensure role
      await adminClient.from('user_roles').upsert({ user_id: uid, role }, { onConflict: 'user_id,role' })

      // Ensure membership (trigger handles most cases, but be defensive)
      await adminClient.from('tenant_members').upsert(
        { user_id: uid, tenant_id, role },
        { onConflict: 'user_id,tenant_id' }
      )

      if (commission !== undefined && commission !== null) {
        const commissionVal = parseFloat(String(commission).replace(',', '.')) || 0
        await adminClient.from('tenant_members').update({ commission_percentage: commissionVal }).eq('user_id', uid)
      }

      return json({ success: true, user: data.user })
    }

    if (action === 'update') {
      const { user_id, name, email, phone, role, tenant_id } = body
      if (!user_id) return json({ error: 'user_id obrigatório' }, 400)

      // Update auth email if changed
      if (email) {
        const { error } = await adminClient.auth.admin.updateUser(user_id, { email })
        if (error) return json({ error: error.message }, 400)
      }

      // Update profile
      const profilePatch: any = {}
      if (name !== undefined) profilePatch.name = name
      if (email !== undefined) profilePatch.email = email
      if (phone !== undefined) profilePatch.phone = phone
      if (Object.keys(profilePatch).length > 0) {
        await adminClient.from('profiles').update(profilePatch).eq('id', user_id)
      }

      // Update role (replace all roles with the new one)
      if (role) {
        await adminClient.from('user_roles').delete().eq('user_id', user_id)
        await adminClient.from('user_roles').insert({ user_id, role })
      }

      // Update tenant membership (single tenant per user in this app)
      if (tenant_id) {
        await adminClient.from('tenant_members').delete().eq('user_id', user_id)
        await adminClient.from('tenant_members').insert({ user_id, tenant_id, role: role || 'atendente' })
      }

      return json({ success: true })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'user_id required' }, 400)
      await adminClient.from('user_roles').delete().eq('user_id', user_id)
      await adminClient.from('tenant_members').delete().eq('user_id', user_id)
      const { error } = await adminClient.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    if (action === 'reset_password') {
      const { user_id, new_password } = body
      if (!user_id || !new_password || new_password.length < 6) {
        return json({ error: 'user_id e nova senha (mínimo 6 caracteres) obrigatórios' }, 400)
      }
      const { error } = await adminClient.auth.admin.updateUser(user_id, { password: new_password })
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})
