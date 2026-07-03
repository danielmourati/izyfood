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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve tenant_id and tenant name
    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const tenantId = member?.tenant_id as string | undefined;
    if (!tenantId) return json({ error: 'Tenant não encontrado para este usuário.' }, 400);

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .maybeSingle();
    const tenantName = tenantRow?.name || 'Degust';

    // Existing cert?
    const { data: existing } = await admin
      .from('qz_tray_certs')
      .select('cert_pem')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing?.cert_pem) {
      return json({ cert_pem: existing.cert_pem, tenant_name: tenantName });
    }

    // Generate a self-signed RSA cert
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + Date.now().toString(16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    const attrs = [
      { name: 'commonName', value: `Degust · ${tenantName}` },
      { name: 'organizationName', value: 'Degust' },
      { name: 'organizationalUnitName', value: 'QZ Tray Signing' },
      { name: 'countryName', value: 'BR' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    await admin.from('qz_tray_certs').insert({
      tenant_id: tenantId,
      cert_pem: certPem,
      private_key_pem: privateKeyPem,
    });

    return json({ cert_pem: certPem, tenant_name: tenantName });
  } catch (err: any) {
    console.error('[qz-cert] error', err);
    return json({ error: err?.message || 'Erro ao gerar certificado.' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
