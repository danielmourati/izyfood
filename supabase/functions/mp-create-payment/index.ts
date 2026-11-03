import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_PRICES: Record<string, number> = {
  pro_monthly: 157.0,
  pro_yearly: 1570.0,
};

function parsePlanPricingRow(row: any) {
  let meta: any = null;
  if (row?.mp_customer_id && typeof row.mp_customer_id === 'string' && row.mp_customer_id.startsWith('{')) {
    try { meta = JSON.parse(row.mp_customer_id); } catch { meta = null; }
  }
  return {
    monthly_price: Number(row?.monthly_price ?? meta?.monthly_price ?? DEFAULT_PRICES.pro_monthly),
    yearly_price: Number(row?.yearly_price ?? meta?.yearly_price ?? DEFAULT_PRICES.pro_yearly),
    monthly_discount_pct: Number(row?.monthly_discount_pct ?? meta?.monthly_discount_pct ?? 0),
    yearly_discount_pct: Number(row?.yearly_discount_pct ?? meta?.yearly_discount_pct ?? 0),
    courtesy_months: Number(row?.courtesy_months ?? meta?.courtesy_months ?? 2),
  };
}

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
    const userId = claims.claims.sub;

    const body = await req.json();
    const plan = body?.plan as 'pro_monthly' | 'pro_yearly';
    if (!plan || !(plan in DEFAULT_PRICES)) return json({ error: 'Invalid plan' }, 400);

    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id, role, tenants(name)')
      .eq('user_id', userId)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!member?.tenant_id) return json({ error: 'Not a tenant admin' }, 403);

    const { data: profile } = await admin
      .from('profiles').select('email, name').eq('id', userId).maybeSingle();

    // Ler precificação personalizada e descontos configurados para o tenant
    let { data: planRow, error: planErr } = await admin
      .from('tenant_plans')
      .select('mp_customer_id, monthly_price, yearly_price, monthly_discount_pct, yearly_discount_pct, courtesy_months')
      .eq('tenant_id', member.tenant_id)
      .maybeSingle();

    if (planErr) {
      const fb = await admin
        .from('tenant_plans')
        .select('mp_customer_id')
        .eq('tenant_id', member.tenant_id)
        .maybeSingle();
      planRow = fb.data as any;
    }

    const parsedPricing = parsePlanPricingRow(planRow);
    const basePrice = plan === 'pro_monthly' ? parsedPricing.monthly_price : parsedPricing.yearly_price;
    const discountPct = plan === 'pro_monthly' ? parsedPricing.monthly_discount_pct : parsedPricing.yearly_discount_pct;
    const amount = Math.max(1, Math.round(basePrice * (1 - Math.min(100, Math.max(0, discountPct)) / 100) * 100) / 100);
    const courtesyMonths = plan === 'pro_yearly' ? Math.max(0, parsedPricing.courtesy_months) : 0;

    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpToken) return json({ error: 'MP not configured' }, 500);

    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`;

    const mpBody = {
      transaction_amount: amount,
      description: `Assinatura ${plan === 'pro_monthly' ? 'PRO Mensal' : 'PRO Anual'} - ${(member.tenants as any)?.name || 'Tenant'}`,
      payment_method_id: 'pix',
      notification_url: notifyUrl,
      date_of_expiration: expiresAt.toISOString().replace('Z', '-00:00'),
      payer: {
        email: profile?.email || 'cliente@degust.app',
        first_name: profile?.name?.split(' ')[0] || 'Cliente',
      },
      metadata: {
        tenant_id: member.tenant_id,
        plan,
        user_id: userId,
        courtesy_months: courtesyMonths,
      },
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(mpBody),
    });

    const mpJson = await mpRes.json();
    if (!mpRes.ok) {
      console.error('MP error', mpJson);
      return json({ error: 'MP payment failed', details: mpJson }, 502);
    }

    const qr = mpJson?.point_of_interaction?.transaction_data;

    const { data: intent, error: insErr } = await admin
      .from('payment_intents')
      .insert({
        tenant_id: member.tenant_id,
        user_id: userId,
        plan,
        amount,
        mp_payment_id: String(mpJson.id),
        status: mpJson.status || 'pending',
        qr_code: qr?.qr_code || null,
        qr_code_base64: qr?.qr_code_base64 || null,
        ticket_url: qr?.ticket_url || null,
        expires_at: expiresAt.toISOString(),
        raw: mpJson,
      })
      .select()
      .single();

    if (insErr) {
      console.error(insErr);
      return json({ error: 'DB insert failed' }, 500);
    }

    return json({
      intent_id: intent.id,
      mp_payment_id: intent.mp_payment_id,
      qr_code: intent.qr_code,
      qr_code_base64: intent.qr_code_base64,
      ticket_url: intent.ticket_url,
      amount: intent.amount,
      expires_at: intent.expires_at,
    });
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
