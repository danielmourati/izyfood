// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import forge from 'npm:node-forge@1.3.1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const request = typeof body?.request === 'string' ? body.request : '';
    if (!request) return json({ error: 'Missing request payload' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const tenantId = member?.tenant_id as string | undefined;
    if (!tenantId) return json({ error: 'Tenant não encontrado.' }, 400);

    const { data: certRow } = await admin
      .from('qz_tray_certs')
      .select('private_key_pem')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const privateKeyPem = certRow?.private_key_pem as string | undefined;
    if (!privateKeyPem) {
      return json({ error: 'Certificado não gerado. Chame qz-cert antes.' }, 404);
    }

    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const md = forge.md.sha512.create();
    md.update(request, 'utf8');
    const signature = forge.util.encode64(privateKey.sign(md));

    return json({ signature });
  } catch (err: any) {
    console.error('[qz-sign] error', err);
    return json({ error: err?.message || 'Erro ao assinar.' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
