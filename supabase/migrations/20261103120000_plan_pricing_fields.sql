-- Adiciona campos de precificação personalizada, descontos e meses de cortesia por tenant ao tenant_plans
ALTER TABLE public.tenant_plans
  ADD COLUMN IF NOT EXISTS monthly_price        numeric(10,2) DEFAULT 157.00,
  ADD COLUMN IF NOT EXISTS yearly_price         numeric(10,2) DEFAULT 1570.00,
  ADD COLUMN IF NOT EXISTS monthly_discount_pct numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_discount_pct  numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courtesy_months      integer       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_installments     integer       DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notes                text;

COMMENT ON COLUMN public.tenant_plans.monthly_price        IS 'Valor mensal base personalizado para este tenant (padrão R$ 157,00)';
COMMENT ON COLUMN public.tenant_plans.yearly_price         IS 'Valor anual base personalizado para este tenant (padrão R$ 1.570,00)';
COMMENT ON COLUMN public.tenant_plans.monthly_discount_pct IS 'Percentual de desconto no plano mensal (0-100)';
COMMENT ON COLUMN public.tenant_plans.yearly_discount_pct  IS 'Percentual de desconto no plano anual (0-100)';
COMMENT ON COLUMN public.tenant_plans.courtesy_months      IS 'Meses de brinde/cortesia concedidos no plano anual';
COMMENT ON COLUMN public.tenant_plans.max_installments     IS 'Máximo de parcelas permitidas no cartão para o plano anual (padrão 10x)';
COMMENT ON COLUMN public.tenant_plans.notes                IS 'Observações internas do superadmin sobre esta assinatura';

