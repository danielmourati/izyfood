export const DEFAULT_MONTHLY_PRICE = 157;
export const DEFAULT_YEARLY_PRICE = 1570;

export interface PlanPricingConfig {
  monthly_price: number;
  yearly_price: number;
  monthly_discount_pct: number;
  yearly_discount_pct: number;
  courtesy_months: number;
  max_installments: number;
  notes: string | null;
}

/**
 * Serializes custom pricing into `mp_customer_id` (a native TEXT column on `tenant_plans`)
 * so that pricing, discounts, and courtesy months are persisted in the database immediately,
 * even before the dedicated columns migration is applied on the remote DB.
 */
export function encodePlanPricingMeta(config: PlanPricingConfig, existingMpCustomerId?: string | null): string {
  let rawMpId: string | undefined = undefined;
  if (existingMpCustomerId) {
    try {
      const parsed = JSON.parse(existingMpCustomerId);
      if (parsed && typeof parsed === 'object' && parsed.mp_id) {
        rawMpId = parsed.mp_id;
      }
    } catch {
      rawMpId = existingMpCustomerId;
    }
  }

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
  });
}

/**
 * Extracts pricing config from a `tenant_plans` row, reading from dedicated columns first
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
  const notes = (row?.notes ?? meta?.notes ?? null) as string | null;

  return {
    monthly_price: monthly_price > 0 ? monthly_price : DEFAULT_MONTHLY_PRICE,
    yearly_price: yearly_price > 0 ? yearly_price : DEFAULT_YEARLY_PRICE,
    monthly_discount_pct,
    yearly_discount_pct,
    courtesy_months,
    max_installments,
    notes,
  };
}

