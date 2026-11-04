export const DEFAULT_MONTHLY_PRICE = 157;
export const DEFAULT_YEARLY_PRICE = 1570;

export type ManualPaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'transfer'
  | 'boleto'
  | 'mercado_pago'
  | 'courtesy';

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  transfer: 'Transferência / TED',
  boleto: 'Boleto',
  mercado_pago: 'Mercado Pago',
  courtesy: 'Cortesia',
};

export interface ManualPaymentRecord {
  id: string;
  amount: number;
  paid_at: string;
  payment_method: ManualPaymentMethod;
  plan: 'pro_monthly' | 'pro_yearly' | 'trial';
  notes?: string | null;
  created_at: string;
}

export interface PlanPricingConfig {
  monthly_price: number;
  yearly_price: number;
  monthly_discount_pct: number;
  yearly_discount_pct: number;
  courtesy_months: number;
  max_installments: number;
  notes: string | null;
  last_payment_method?: ManualPaymentMethod | null;
  manual_payments?: ManualPaymentRecord[];
}

export function resolvePaymentMethodLabel(value: unknown, fallback = 'Mercado Pago'): string {
  if (!value) return fallback;
  if (typeof value === 'string') {
    return Object.prototype.hasOwnProperty.call(MANUAL_PAYMENT_METHOD_LABELS, value)
      ? MANUAL_PAYMENT_METHOD_LABELS[value as ManualPaymentMethod]
      : value;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.type === 'string') {
      const mpTypeMap: Record<string, string> = {
        bank_transfer: 'PIX',
        pix: 'PIX',
        credit_card: 'Cartão de Crédito',
        debit_card: 'Cartão de Débito',
        ticket: 'Boleto',
        account_money: 'Mercado Pago',
      };
      return Object.prototype.hasOwnProperty.call(mpTypeMap, obj.type)
        ? mpTypeMap[obj.type]
        : obj.type;
    }
    if (typeof obj.id === 'string') {
      return obj.id === 'pix' ? 'PIX' : obj.id;
    }
  }
  return fallback;
}

/**
 * Serializes custom pricing and manual payments into `mp_customer_id` (a native TEXT column on `tenant_plans`)
 * so that pricing, discounts, courtesy months, and manual payments are persisted in the database immediately,
 * even before dedicated column migrations are applied on the remote DB.
 */
export function encodePlanPricingMeta(config: PlanPricingConfig, existingMpCustomerId?: string | null): string {
  let rawMpId: string | undefined = undefined;
  let existingParsed: any = null;
  if (existingMpCustomerId) {
    try {
      const parsed = JSON.parse(existingMpCustomerId);
      if (parsed && typeof parsed === 'object') {
        existingParsed = parsed;
        if (parsed.mp_id) {
          rawMpId = parsed.mp_id;
        }
      }
    } catch {
      rawMpId = existingMpCustomerId;
    }
  }

  const manualPayments = Array.isArray(config.manual_payments)
    ? config.manual_payments
    : Array.isArray(existingParsed?.manual_payments)
    ? existingParsed.manual_payments
    : [];

  const lastPaymentMethod =
    config.last_payment_method !== undefined
      ? config.last_payment_method
      : typeof existingParsed?.last_payment_method === 'string'
      ? existingParsed.last_payment_method
      : null;

  return JSON.stringify({
    __v: 1,
    mp_id: rawMpId || null,
    monthly_price: Number(config.monthly_price) || DEFAULT_MONTHLY_PRICE,
    yearly_price: Number(config.yearly_price) || DEFAULT_YEARLY_PRICE,
    monthly_discount_pct: Math.min(100, Math.max(0, Number(config.monthly_discount_pct) || 0)),
    yearly_discount_pct: Math.min(100, Math.max(0, Number(config.yearly_discount_pct) || 0)),
    courtesy_months: Math.min(12, Math.max(0, Math.round(Number(config.courtesy_months) || 0))),
    max_installments: Math.min(10, Math.max(1, Math.round(Number(config.max_installments) || 10))),
    notes: config.notes?.trim() || null,
    last_payment_method: lastPaymentMethod,
    manual_payments: manualPayments,
  });
}

/**
 * Extracts pricing config and manual payments from a `tenant_plans` row, reading from dedicated columns first
 * and falling back to the JSON stored in `mp_customer_id`.
 */
export function decodePlanPricing(row: any): PlanPricingConfig {
  let meta: any = null;
  if (row?.mp_customer_id && typeof row.mp_customer_id === 'string' && row.mp_customer_id.startsWith('{')) {
    try {
      meta = JSON.parse(row.mp_customer_id);
    } catch {
      meta = null;
    }
  }

  const monthly_price = Number(
    row?.monthly_price ?? meta?.monthly_price ?? DEFAULT_MONTHLY_PRICE
  );
  const yearly_price = Number(
    row?.yearly_price ?? meta?.yearly_price ?? DEFAULT_YEARLY_PRICE
  );
  const monthly_discount_pct = Math.min(
    100,
    Math.max(0, Number(row?.monthly_discount_pct ?? meta?.monthly_discount_pct ?? 0))
  );
  const yearly_discount_pct = Math.min(
    100,
    Math.max(0, Number(row?.yearly_discount_pct ?? meta?.yearly_discount_pct ?? 0))
  );
  const courtesy_months = Math.min(
    12,
    Math.max(0, Number(row?.courtesy_months ?? meta?.courtesy_months ?? 2))
  );
  const max_installments = Math.min(
    10,
    Math.max(1, Number(row?.max_installments ?? meta?.max_installments ?? 10))
  );
  const rawNotes = row?.notes ?? meta?.notes;
  const notes = typeof rawNotes === 'string' ? rawNotes : null;

  const rawMethod = row?.last_payment_method ?? meta?.last_payment_method;
  const last_payment_method =
    typeof rawMethod === 'string' ? (rawMethod as ManualPaymentMethod) : null;

  const manual_payments = Array.isArray(meta?.manual_payments)
    ? (meta.manual_payments as ManualPaymentRecord[]).map(m => ({
        ...m,
        payment_method: (typeof m.payment_method === 'string' ? m.payment_method : 'pix') as ManualPaymentMethod,
        notes: typeof m.notes === 'string' ? m.notes : null,
      }))
    : [];

  return {
    monthly_price: monthly_price > 0 ? monthly_price : DEFAULT_MONTHLY_PRICE,
    yearly_price: yearly_price > 0 ? yearly_price : DEFAULT_YEARLY_PRICE,
    monthly_discount_pct,
    yearly_discount_pct,
    courtesy_months,
    max_installments,
    notes,
    last_payment_method,
    manual_payments,
  };
}
