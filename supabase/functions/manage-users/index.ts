const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { makeTenantLoginEmail } from '../_shared/tenant-login.ts'

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

    if (action === 'list') {
      if (!isSuperadmin) return json({ error: 'Apenas superadmin pode listar todos os usuários' }, 403)

      const { data: { users: authUsers }, error: authErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      if (authErr) return json({ error: authErr.message }, 400)

      const { data: profiles } = await adminClient.from('profiles').select('*')
      const { data: members } = await adminClient.from('tenant_members').select('user_id, tenant_id, role, tenants(name, slug)')
      const { data: roles } = await adminClient.from('user_roles').select('user_id, role')

      const combined = (authUsers || []).map((u: any) => {
        const prof = (profiles || []).find((p: any) => p.id === u.id)
        const mem = (members || []).find((m: any) => m.user_id === u.id)
        const rol = (roles || []).find((r: any) => r.user_id === u.id)
        const tenant = (mem?.tenants as any)
        return {
          id: u.id,
          name: prof?.name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário',
          email: u.email || prof?.email || '',
          phone: prof?.phone || u.user_metadata?.phone || '',
          role: rol?.role || mem?.role || u.user_metadata?.role || 'atendente',
          tenantId: mem?.tenant_id || u.user_metadata?.tenant_id || '',
          tenantName: tenant?.name || '—',
          tenantSlug: tenant?.slug || '',
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at,
        }
      })

      return json({ success: true, users: combined })
    }

    if (action === 'create') {
      const { email, password, name, phone, role, tenant_id, commission } = body
      if (!email || !password || !name || !role || !tenant_id) return json({ error: 'Campos obrigatórios: email, senha, nome, função e loja' }, 400)
      if (String(password).length < 6) return json({ error: 'A senha deve conter no mínimo 6 caracteres.' }, 400)

      const contact = String(email).trim().toLowerCase()
      const { data: dup } = await adminClient.from('tenant_members').select('id').eq('tenant_id', tenant_id).ilike('email', contact).maybeSingle()
      if (dup) return json({ error: 'Este e-mail já está cadastrado nesta loja.' }, 400)
      const { data: t } = await adminClient.from('tenants').select('slug').eq('id', tenant_id).maybeSingle()
      if (!t) return json({ error: 'Loja não encontrada' }, 400)
      const loginEmail = makeTenantLoginEmail(t.slug)
      const { data, error } = await adminClient.auth.admin.createUser({
        email: loginEmail, password, email_confirm: true,
        user_metadata: { name, role, tenant_id, phone: phone || null, contact_email: contact }
      })
      if (error) {
        const m = (error.message || '').toLowerCase()
        let msg = error.message
        if (m.includes('weak') || m.includes('pwned') || m.includes('known')) msg = 'Senha recusada por ser fraca ou já vazada na internet. Use uma senha mais forte.'
        else if (m.includes('already')) msg = 'Este e-mail já está cadastrado no sistema.'
        return json({ error: msg }, 400)
      }

      const uid = data.user!.id
      // Ensure profile has phone
      if (phone) await adminClient.from('profiles').update({ phone }).eq('id', uid)

      // Ensure role
      await adminClient.from('user_roles').upsert({ user_id: uid, role }, { onConflict: 'user_id,role' })

      // Ensure membership (trigger handles most cases, but be defensive)
      await adminClient.from('tenant_members').upsert(
        { user_id: uid, tenant_id, role, email: contact, login_email: loginEmail },
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

      // Real e-mail is per tenant; the sign-in address never changes.
      const contact = email ? String(email).trim().toLowerCase() : undefined
      const { data: mem } = await adminClient.from('tenant_members').select('tenant_id').eq('user_id', user_id).limit(1).maybeSingle()
      const targetTenant = tenant_id || mem?.tenant_id
      if (contact && targetTenant) {
        const { data: dup } = await adminClient.from('tenant_members').select('user_id').eq('tenant_id', targetTenant).ilike('email', contact).neq('user_id', user_id).maybeSingle()
        if (dup) return json({ error: 'Este e-mail já está cadastrado nesta loja.' }, 400)
      }

      // Update profile
      const profilePatch: any = {}
      if (name !== undefined) profilePatch.name = name
      if (contact !== undefined) profilePatch.email = contact
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
      const memberPatch: any = {}
      if (tenant_id) memberPatch.tenant_id = tenant_id
      if (role) memberPatch.role = role
      if (contact) memberPatch.email = contact
      if (Object.keys(memberPatch).length > 0) {
        if (mem) {
          const { error } = await adminClient.from('tenant_members').update(memberPatch).eq('user_id', user_id)
          if (error) return json({ error: error.message }, 400)
        } else if (tenant_id) {
          const { data: au } = await adminClient.auth.admin.getUserById(user_id)
          await adminClient.from('tenant_members').insert({ user_id, tenant_id, role: role || 'atendente', email: contact, login_email: au?.user?.email?.toLowerCase() })
        }
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
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password })
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    if (action === 'delete_tenant') {
      const { tenant_id } = body
      if (!tenant_id) return json({ error: 'tenant_id required' }, 400)

      const { data: members } = await adminClient.from('tenant_members').select('user_id').eq('tenant_id', tenant_id)
      if (members) {
        for (const m of members) {
          // Verify if they only belong to this tenant
          const { data: userTenants } = await adminClient.from('tenant_members').select('tenant_id').eq('user_id', m.user_id)
          if (userTenants && userTenants.length === 1) {
            await adminClient.auth.admin.deleteUser(m.user_id)
          } else {
            await adminClient.from('tenant_members').delete().eq('user_id', m.user_id).eq('tenant_id', tenant_id)
          }
        }
      }

      // Manual cascade delete
      const tables = [
        'audit_logs', 'cash_movements', 'commission_records', 'print_jobs', 'store_tables',
        'orders', 'product_note_options', 'products', 'categories', 'customers', 'suppliers',
        'printer_configs', 'cash_registers', 'store_settings', 'tenant_plans', 'attendant_permissions',
        'coupons'
      ];
      
      for (const table of tables) {
        await adminClient.from(table).delete().eq('tenant_id', tenant_id)
      }

      const { error } = await adminClient.from('tenants').delete().eq('id', tenant_id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})
