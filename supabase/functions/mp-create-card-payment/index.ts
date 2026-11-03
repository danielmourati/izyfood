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
    max_installments: Number(row?.max_installments ?? meta?.max_installments ?? 10),
    current_period_end: row?.current_period_end ?? null,
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
    const {
      plan,
      card_token,
      installments = 1,
      issuer_id,
      payment_method_id,
      mode = 'transparent',
      return_url,
    } = body as {
      plan: 'pro_monthly' | 'pro_yearly';
      card_token?: string;
      installments?: number;
      issuer_id?: string;
      payment_method_id?: string;
      mode?: 'transparent' | 'preference';
      return_url?: string;
    };

    if (!plan || !(plan in DEFAULT_PRICES)) {
      return json({ error: 'Plano inválido' }, 400);
    }

    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id, role, tenants(name)')
      .eq('user_id', userId)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!member?.tenant_id) return json({ error: 'Not a tenant admin' }, 403);

    const { data: profile } = await admin
      .from('profiles').select('email, name').eq('id', userId).maybeSingle();

    // Ler precificação personalizada, descontos e cortesia do banco
    let { data: planRow, error: planErr } = await admin
      .from('tenant_plans')
      .select('mp_customer_id, monthly_price, yearly_price, monthly_discount_pct, yearly_discount_pct, courtesy_months, max_installments, current_period_end')
      .eq('tenant_id', member.tenant_id)
      .maybeSingle();

    if (planErr) {
      const fb = await admin
        .from('tenant_plans')
        .select('mp_customer_id, current_period_end')
        .eq('tenant_id', member.tenant_id)
        .maybeSingle();
      planRow = fb.data as any;
    }

    const parsedPricing = parsePlanPricingRow(planRow);
    const basePrice = plan === 'pro_monthly' ? parsedPricing.monthly_price : parsedPricing.yearly_price;
    const discountPct = plan === 'pro_monthly' ? parsedPricing.monthly_discount_pct : parsedPricing.yearly_discount_pct;
    const amount = Math.max(1, Math.round(basePrice * (1 - Math.min(100, Math.max(0, discountPct)) / 100) * 100) / 100);
    const maxInstallments = plan === 'pro_yearly' ? Math.min(12, Math.max(1, parsedPricing.max_installments)) : 1;
    const courtesyMonths = plan === 'pro_yearly' ? Math.max(0, parsedPricing.courtesy_months) : 0;

    if (installments < 1 || installments > maxInstallments) {
      return json({ error: `Número de parcelas deve ser entre 1 e ${maxInstallments}x` }, 400);
    }

    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpToken) return json({ error: 'MP not configured' }, 500);

    const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`;
    const tenantName = (member.tenants as any)?.name || 'Tenant';
    const description = `Assinatura ${plan === 'pro_monthly' ? 'PRO Mensal' : 'PRO Anual'} - ${tenantName}`;

    if (mode === 'preference' || !card_token) {
      const prefBody = {
        items: [
          {
            id: plan,
            title: description,
            description: courtesyMonths > 0
              ? `${description} (+${courtesyMonths} mês(es) de cortesia)`
              : description,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: amount,
          },
        ],
        payer: {
          email: profile?.email || 'cliente@degust.app',
          name: profile?.name || 'Cliente',
        },
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: maxInstallments,
          default_installments: installments,
        },
        notification_url: notifyUrl,
        back_urls: return_url
          ? { success: return_url, failure: return_url, pending: return_url }
          : undefined,
        auto_return: return_url ? 'approved' : undefined,
        metadata: {
          tenant_id: member.tenant_id,
          plan,
          user_id: userId,
          courtesy_months: courtesyMonths,
          installments,
        },
      };

      const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prefBody),
      });

      const prefJson = await prefRes.json();
      if (!prefRes.ok) {
        console.error('MP preference error', prefJson);
        return json({ error: 'Falha ao gerar checkout de cartão no Mercado Pago', details: prefJson }, 502);
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { data: intent, error: insErr } = await admin
        .from('payment_intents')
        .insert({
          tenant_id: member.tenant_id,
          user_id: userId,
          plan,
          amount,
          mp_payment_id: String(prefJson.id),
          status: 'pending',
          ticket_url: prefJson.init_point || prefJson.sandbox_init_point || null,
          expires_at: expiresAt.toISOString(),
          raw: prefJson,
        })
        .select()
        .single();

      if (insErr) {
        console.error('DB insert error', insErr);
        return json({ error: 'DB insert failed' }, 500);
      }

      return json({
        intent_id: intent.id,
        checkout_url: prefJson.init_point || prefJson.sandbox_init_point,
        amount,
        installments,
        max_installments: maxInstallments,
        status: 'pending',
      });
    }

    if (!payment_method_id) {
      return json({ error: 'Informe payment_method_id para pagamento com cartão' }, 400);
    }

    const idempotencyKey = crypto.randomUUID();
    const mpBody: Record<string, unknown> = {
      transaction_amount: amount,
      description,
      installments,
      token: card_token,
      payment_method_id,
      notification_url: notifyUrl,
      ...(issuer_id ? { issuer_id } : {}),
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
      console.error('MP card payment error', mpJson);
      return json({ error: 'Pagamento no cartão recusado ou inválido', details: mpJson }, 502);
    }

    const { data: intent, error: insErr } = await admin
      .from('payment_intents')
      .insert({
        tenant_id: member.tenant_id,
        user_id: userId,
        plan,
        amount,
        mp_payment_id: String(mpJson.id),
        status: mpJson.status || 'pending',
        qr_code: null,
        qr_code_base64: null,
        ticket_url: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        raw: mpJson,
      })
      .select()
      .single();

    if (insErr) {
      console.error('DB insert error', insErr);
      return json({ error: 'DB insert failed' }, 500);
    }

    if (mpJson.status === 'approved') {
      const now = new Date();
      const currentEnd = parsedPricing.current_period_end ? new Date(parsedPricing.current_period_end) : null;
      const baseDate = currentEnd && currentEnd > now ? currentEnd : now;
      const periodDays = (plan === 'pro_yearly' ? 365 : 30) + courtesyMonths * 30;
      const newEnd = new Date(baseDate.getTime() + periodDays * 24 * 60 * 60 * 1000);

      await admin.from('tenant_plans').update({
        plan,
        status: 'active',
        current_period_end: newEnd.toISOString(),
        last_payment_at: now.toISOString(),
        trial_ends_at: null,
      }).eq('tenant_id', member.tenant_id);

      await admin.from('payment_intents').update({
        status: 'approved',
        paid_at: mpJson.date_approved || now.toISOString(),
      }).eq('id', intent.id);
    }

    return json({
      intent_id: intent.id,
      mp_payment_id: intent.mp_payment_id,
      status: mpJson.status,
      status_detail: mpJson.status_detail,
      amount,
      installments,
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
