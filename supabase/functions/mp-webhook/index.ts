import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function verifySignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map(p => p.trim().split('=').map(s => s.trim()))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // GET is used for health checks / ping tests from MP dashboard
  if (req.method === 'GET') {
    await admin.from('webhook_events').insert({
      source: 'mercadopago',
      event_type: 'ping',
      processed: true,
      headers: Object.fromEntries(req.headers.entries()),
    });
    return new Response(JSON.stringify({ ok: true, service: 'mp-webhook' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const bodyText = await req.text();
  let body: any = {};
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { /* ignore */ }

  const dataId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  const type = body?.type || url.searchParams.get('type') || url.searchParams.get('topic');

  console.log('MP webhook', { type, dataId });

  let signatureValid: boolean | null = null;
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (webhookSecret && dataId) {
    signatureValid = await verifySignature(req, String(dataId), webhookSecret);
    if (!signatureValid) console.warn('MP webhook signature invalid (continuing)');
  }

  // Log event immediately so Super Admin sees connectivity
  const { data: logRow } = await admin.from('webhook_events').insert({
    source: 'mercadopago',
    event_type: type || 'unknown',
    event_id: dataId ? String(dataId) : null,
    signature_valid: signatureValid,
    processed: false,
    headers: Object.fromEntries(req.headers.entries()),
    payload: body,
  }).select().single();

  const markProcessed = async (error?: string) => {
    if (!logRow) return;
    await admin.from('webhook_events').update({
      processed: !error,
      error: error || null,
    }).eq('id', logRow.id);
  };

  try {
    if (!dataId) { await markProcessed(); return new Response('ok', { headers: corsHeaders }); }
    if (type && type !== 'payment') { await markProcessed(); return new Response('ok', { headers: corsHeaders }); }

    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpToken) { await markProcessed('missing token'); return new Response('missing token', { status: 500, headers: corsHeaders }); }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP fetch failed', payment);
      await markProcessed('mp fetch failed');
      return new Response('mp fetch failed', { status: 502, headers: corsHeaders });
    }

    const { data: intent } = await admin
      .from('payment_intents')
      .select('*')
      .eq('mp_payment_id', String(payment.id))
      .maybeSingle();

    if (!intent) {
      console.warn('No intent found for payment', payment.id);
      await markProcessed('intent not found');
      return new Response('ok', { headers: corsHeaders });
    }

    await admin.from('payment_intents').update({
      status: payment.status,
      paid_at: payment.status === 'approved' ? (payment.date_approved || new Date().toISOString()) : intent.paid_at,
      raw: payment,
    }).eq('id', intent.id);

    if (payment.status === 'approved' && intent.status !== 'approved') {
      const now = new Date();
      const periodDays = intent.plan === 'pro_yearly' ? 365 : 30;
      const newEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

      await admin.from('tenant_plans').update({
        plan: intent.plan,
        status: 'active',
        current_period_end: newEnd.toISOString(),
        last_payment_at: now.toISOString(),
        trial_ends_at: null,
      }).eq('tenant_id', intent.tenant_id);

      await admin.from('audit_logs').insert({
        tenant_id: intent.tenant_id,
        user_id: intent.user_id,
        action: 'plan_upgraded',
        entity_type: 'tenant_plan',
        entity_id: intent.tenant_id,
        details: { plan: intent.plan, amount: intent.amount, mp_payment_id: payment.id },
      });
    }

    await markProcessed();
    return new Response('ok', { headers: corsHeaders });
  } catch (e) {
    console.error(e);
    await markProcessed(String(e));
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
