import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);

    const { intent_id } = await req.json();
    if (!intent_id) return json({ error: 'intent_id required' }, 400);

    const { data: intent } = await admin
      .from('payment_intents').select('*').eq('id', intent_id).maybeSingle();
    if (!intent) return json({ error: 'not found' }, 404);

    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (mpToken && intent.mp_payment_id) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${intent.mp_payment_id}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` },
      });
      if (mpRes.ok) {
        const payment = await mpRes.json();
        if (payment.status && payment.status !== intent.status) {
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
          }
          intent.status = payment.status;
        }
      }
    }

    return json({ status: intent.status, paid_at: intent.paid_at });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
