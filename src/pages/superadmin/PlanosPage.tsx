import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRLInput, parseBRLInput } from '@/lib/utils';
import {
  DEFAULT_MONTHLY_PRICE,
  DEFAULT_YEARLY_PRICE,
  MANUAL_PAYMENT_METHOD_LABELS,
  ManualPaymentMethod,
  ManualPaymentRecord,
  decodePlanPricing,
  encodePlanPricingMeta,
} from '@/lib/plan-pricing';
import {
  CreditCard, Loader2, Ban, PlayCircle, Gift, Receipt, Search,
  SlidersHorizontal, AlertTriangle,
  Sparkles, RefreshCw, Infinity as InfinityIcon, DollarSign, Percent,
  Banknote, PlusCircle, Trash2, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment' | 'suspended';

interface TenantPlanRow {
  id: string;
  tenant_id: string;
  plan: PlanType;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  mp_customer_id?: string | null;
  monthly_price?: number | null;
  yearly_price?: number | null;
  monthly_discount_pct?: number | null;
  yearly_discount_pct?: number | null;
  courtesy_months?: number | null;
  max_installments?: number | null;
  notes?: string | null;
  last_payment_method?: ManualPaymentMethod | null;
  manual_payments?: ManualPaymentRecord[];
  tenants: { name: string; slug: string; active: boolean } | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  plan: string;
  mp_payment_id: string | null;
  raw?: any;
}

const planLabels: Record<PlanType, string> = {
  trial: 'Trial (Teste)',
  pro_monthly: 'PRO Mensal',
  pro_yearly: 'PRO Anual',
};

const statusLabel: Record<PlanStatus, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  canceled: 'Cancelado',
  pending_payment: 'Aguardando Pagamento',
  suspended: 'Suspenso',
};

function computeEffectivePrices(row: Partial<TenantPlanRow>) {
  const decoded = decodePlanPricing(row);
  const monthlyBase = decoded.monthly_price;
  const monthlyDisc = decoded.monthly_discount_pct;
  const monthlyFinal = Math.round(monthlyBase * (1 - monthlyDisc / 100) * 100) / 100;

  const yearlyBase = decoded.yearly_price;
  const yearlyDisc = decoded.yearly_discount_pct;
  const yearlyFinal = Math.round(yearlyBase * (1 - yearlyDisc / 100) * 100) / 100;

  return {
    monthlyBase,
    monthlyDisc,
    monthlyFinal,
    yearlyBase,
    yearlyDisc,
    yearlyFinal,
    courtesyMonths: decoded.courtesy_months,
    maxInstallments: decoded.max_installments,
    notes: decoded.notes,
    lastPaymentMethod: decoded.last_payment_method,
    manualPayments: decoded.manual_payments || [],
  };
}

function getExpirationInfo(row: TenantPlanRow): {
  daysLeft: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isLifetime: boolean;
  displayDate: string;
  badgeText: string;
} {
  const targetDateStr = row.plan === 'trial' ? row.trial_ends_at : row.current_period_end;
  if (!targetDateStr) {
    return {
      daysLeft: null,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: false,
      displayDate: 'Sem data',
      badgeText: 'Não definida',
    };
  }

  const targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) {
    return {
      daysLeft: null,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: false,
      displayDate: 'Data inválida',
      badgeText: 'Inválida',
    };
  }

  if (targetDate.getFullYear() >= 2090) {
    return {
      daysLeft: 99999,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: true,
      displayDate: 'Vitalício',
      badgeText: 'Vitalício',
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const daysLeft = Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft < 0;
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7;
  const displayDate = targetDate.toLocaleDateString('pt-BR');

  let badgeText = '';
  if (daysLeft === 0) badgeText = 'Vence HOJE';
  else if (daysLeft === 1) badgeText = 'Vence amanhã';
  else if (daysLeft > 1) badgeText = `em ${daysLeft} dias`;
  else badgeText = `Expirou há ${Math.abs(daysLeft)}d`;

  return { daysLeft, isExpired, isExpiringSoon, isLifetime: false, displayDate, badgeText };
}

function computeNextEndDate(
  baseDateStr: string | null | undefined,
  paymentDateStr: string,
  plan: 'pro_monthly' | 'pro_yearly',
  courtesyMonths: number
): string {
  const payDate = paymentDateStr ? new Date(`${paymentDateStr}T12:00:00Z`) : new Date();
  const currentEnd = baseDateStr ? new Date(baseDateStr) : null;
  const startBase =
    currentEnd && !isNaN(currentEnd.getTime()) && currentEnd.getTime() > payDate.getTime() && currentEnd.getFullYear() < 2090
      ? currentEnd
      : payDate;

  const daysToAdd = plan === 'pro_yearly' ? 365 + courtesyMonths * 30 : 30;
  return new Date(startBase.getTime() + daysToAdd * 864e5).toISOString().slice(0, 10);
}

export function PlanosPage() {
  const [rows, setRows] = useState<TenantPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');

  // Unified Plan & Billing Modal
  const [editRow, setEditRow] = useState<TenantPlanRow | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'assinatura' | 'valores' | 'cobrancas'>('assinatura');
  const [editForm, setEditForm] = useState<{
    plan: PlanType;
    status: PlanStatus;
    trial_ends_at: string;
    current_period_end: string;
    last_payment_at: string;
    last_payment_method: ManualPaymentMethod;
    monthly_price: string;
    yearly_price: string;
    monthly_discount_pct: string;
    yearly_discount_pct: string;
    courtesy_months: string;
    max_installments: string;
    notes: string;
  }>({
    plan: 'pro_monthly',
    status: 'active',
    trial_ends_at: '',
    current_period_end: '',
    last_payment_at: '',
    last_payment_method: 'pix',
    monthly_price: formatBRLInput(DEFAULT_MONTHLY_PRICE),
    yearly_price: formatBRLInput(DEFAULT_YEARLY_PRICE),
    monthly_discount_pct: '0',
    yearly_discount_pct: '0',
    courtesy_months: '2',
    max_installments: '10',
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Manual Payment Registration State
  const [manualForm, setManualForm] = useState<{
    plan: 'pro_monthly' | 'pro_yearly';
    amount: string;
    paid_at: string;
    payment_method: ManualPaymentMethod;
    renew_validity: boolean;
    new_period_end: string;
    notes: string;
  }>({
    plan: 'pro_monthly',
    amount: formatBRLInput(DEFAULT_MONTHLY_PRICE),
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: 'pix',
    renew_validity: true,
    new_period_end: '',
    notes: '',
  });
  const [savingManualPayment, setSavingManualPayment] = useState(false);

  // Payments cache inside unified modal
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [loadingPayments, setLoadingPayments] = useState(false);

  const normalizeRow = (raw: any): TenantPlanRow => {
    const decoded = decodePlanPricing(raw);
    return {
      ...raw,
      monthly_price: decoded.monthly_price,
      yearly_price: decoded.yearly_price,
      monthly_discount_pct: decoded.monthly_discount_pct,
      yearly_discount_pct: decoded.yearly_discount_pct,
      courtesy_months: decoded.courtesy_months,
      max_installments: decoded.max_installments,
      notes: decoded.notes,
      last_payment_method: decoded.last_payment_method,
      manual_payments: decoded.manual_payments || [],
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id, monthly_price, yearly_price, monthly_discount_pct, yearly_discount_pct, courtesy_months, max_installments, notes, tenants(name, slug, active)')
      .order('created_at', { ascending: false });

    if (error) {
      const fallback = await supabase
        .from('tenant_plans' as any)
        .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id, tenants(name, slug, active)')
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Erro ao buscar planos:', error);
      toast.error('Erro ao carregar planos');
    }
    setRows(((data as any[]) || []).map(normalizeRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadPaymentsForTenant = async (tenantId: string, force = false) => {
    if (payments[tenantId] && !force) return;
    setLoadingPayments(true);
    const { data } = await supabase
      .from('payment_intents' as any)
      .select('id, amount, status, paid_at, created_at, plan, mp_payment_id, raw')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30);
    setPayments(prev => ({ ...prev, [tenantId]: (data as any) || [] }));
    setLoadingPayments(false);
  };

  // Inline status update
  const updateStatus = async (id: string, status: PlanStatus) => {
    const { data, error } = await supabase
      .from('tenant_plans' as any)
      .update({ status })
      .eq('id', id)
      .select('id');
    if (error || !data || data.length === 0) {
      toast.error(error?.message || 'Erro ao atualizar status do plano no banco');
      return;
    }
    toast.success(`Status alterado para: ${statusLabel[status]}`);
    fetchData();
  };

  // Inline plan update
  const updatePlan = async (row: TenantPlanRow, plan: PlanType) => {
    const patch: any = { plan };
    const decoded = decodePlanPricing(row);
    const courtesy = decoded.courtesy_months;
    if (plan === 'pro_monthly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + 30 * 864e5).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else if (plan === 'pro_yearly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + (365 + courtesy * 30) * 864e5).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else {
      patch.status = 'active';
      patch.trial_ends_at = new Date(Date.now() + 14 * 864e5).toISOString();
      patch.current_period_end = null;
    }
    const { data, error } = await supabase
      .from('tenant_plans' as any)
      .update(patch)
      .eq('id', row.id)
      .select('id');
    if (error || !data || data.length === 0) {
      toast.error(error?.message || 'Erro ao atualizar plano no banco');
      return;
    }
    toast.success(`Plano atualizado para: ${planLabels[plan]}`);
    fetchData();
  };

  // Open unified management modal on desired tab
  const openManageModal = (row: TenantPlanRow, tab: 'assinatura' | 'valores' | 'cobrancas' = 'assinatura') => {
    const decoded = decodePlanPricing(row);
    const pricing = computeEffectivePrices(row);
    const defaultManualPlan: 'pro_monthly' | 'pro_yearly' =
      row.plan === 'pro_yearly' ? 'pro_yearly' : 'pro_monthly';
    const todayStr = new Date().toISOString().slice(0, 10);

    setEditRow(row);
    setActiveModalTab(tab);
    setEditForm({
      plan: row.plan,
      status: row.status,
      trial_ends_at: row.trial_ends_at ? row.trial_ends_at.slice(0, 10) : '',
      current_period_end: row.current_period_end ? row.current_period_end.slice(0, 10) : '',
      last_payment_at: row.last_payment_at ? row.last_payment_at.slice(0, 10) : '',
      last_payment_method: decoded.last_payment_method || 'pix',
      monthly_price: formatBRLInput(decoded.monthly_price),
      yearly_price: formatBRLInput(decoded.yearly_price),
      monthly_discount_pct: String(decoded.monthly_discount_pct),
      yearly_discount_pct: String(decoded.yearly_discount_pct),
      courtesy_months: String(decoded.courtesy_months),
      max_installments: String(decoded.max_installments),
      notes: decoded.notes || '',
    });
    setManualForm({
      plan: defaultManualPlan,
      amount: formatBRLInput(
        defaultManualPlan === 'pro_yearly' ? pricing.yearlyFinal : pricing.monthlyFinal
      ),
      paid_at: todayStr,
      payment_method: decoded.last_payment_method || 'pix',
      renew_validity: true,
      new_period_end: computeNextEndDate(
        row.current_period_end,
        todayStr,
        defaultManualPlan,
        decoded.courtesy_months
      ),
      notes: '',
    });
    if (tab === 'cobrancas') {
      void loadPaymentsForTenant(row.tenant_id);
    }
  };

  // Add days to current form date
  const addDaysToFormDate = (days: number) => {
    const isTrialPlan = editForm.plan === 'trial';
    const currentStr = isTrialPlan ? editForm.trial_ends_at : editForm.current_period_end;
    const base = currentStr && new Date(`${currentStr}T23:59:59Z`) > new Date()
      ? new Date(`${currentStr}T23:59:59Z`)
      : new Date();
    const nextDate = new Date(base.getTime() + days * 864e5).toISOString().slice(0, 10);
    setEditForm(f => ({
      ...f,
      status: 'active',
      ...(isTrialPlan ? { trial_ends_at: nextDate } : { current_period_end: nextDate }),
    }));
  };

  const setLifetimeInForm = () => {
    setEditForm(f => ({
      ...f,
      plan: f.plan === 'trial' ? 'pro_yearly' : f.plan,
      status: 'active',
      current_period_end: '2099-12-31',
      last_payment_at: new Date().toISOString().slice(0, 10),
    }));
  };

  const applyCourtesyMonthsDiscountAndValidity = (months: number) => {
    const mPrice = parseBRLInput(editForm.monthly_price) || DEFAULT_MONTHLY_PRICE;
    const full12Price = mPrice * 12;
    const chargedMonths = Math.max(1, 12 - months);
    const suggestedYearly = mPrice * chargedMonths;

    const base = editForm.current_period_end && new Date(`${editForm.current_period_end}T23:59:59Z`) > new Date()
      ? new Date(`${editForm.current_period_end}T23:59:59Z`)
      : new Date();
    const newEnd = new Date(base.getTime() + (365 + months * 30) * 864e5).toISOString().slice(0, 10);

    setEditForm(f => ({
      ...f,
      courtesy_months: String(months),
      yearly_price: formatBRLInput(suggestedYearly),
      yearly_discount_pct: '0',
      current_period_end: f.current_period_end || newEnd,
    }));
    toast.info(
      months > 0
        ? `Anual ajustado: paga ${chargedMonths} meses (${fmtBRL(suggestedYearly)} de ${fmtBRL(full12Price)}) com +${months} mês(es) de cortesia.`
        : `Anual ajustado para 12 meses cheios (${fmtBRL(full12Price)}).`
    );
  };

  const handleRegisterManualPayment = async () => {
    if (!editRow) return;
    const amountNum = parseBRLInput(manualForm.amount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error('Informe um valor válido para o pagamento.');
      return;
    }
    if (!manualForm.paid_at) {
      toast.error('Selecione a data do pagamento.');
      return;
    }

    setSavingManualPayment(true);
    try {
      const decoded = decodePlanPricing(editRow);
      const paymentIso = new Date(`${manualForm.paid_at}T12:00:00Z`).toISOString();
      const newRecord: ManualPaymentRecord = {
        id: crypto.randomUUID(),
        amount: amountNum,
        paid_at: paymentIso,
        payment_method: manualForm.payment_method,
        plan: manualForm.plan,
        notes: manualForm.notes.trim() || null,
        created_at: new Date().toISOString(),
      };

      const nextManualPayments = [newRecord, ...(decoded.manual_payments || [])];

      const encodedMeta = encodePlanPricingMeta(
        {
          ...decoded,
          last_payment_method: manualForm.payment_method,
          manual_payments: nextManualPayments,
        },
        editRow.mp_customer_id
      );

      const nextPeriodEndIso =
        manualForm.renew_validity && manualForm.new_period_end
          ? new Date(`${manualForm.new_period_end}T23:59:59Z`).toISOString()
          : editRow.current_period_end;

      const patch: any = {
        plan: manualForm.plan,
        status: 'active',
        last_payment_at: paymentIso,
        current_period_end: nextPeriodEndIso,
        mp_customer_id: encodedMeta,
      };

      const { data: updatedData, error } = await supabase
        .from('tenant_plans' as any)
        .update(patch)
        .eq('id', editRow.id)
        .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id');

      if (error) throw error;
      if (!updatedData || updatedData.length === 0) {
        throw new Error('Não foi possível gravar o pagamento no banco. Verifique as permissões de SuperAdmin.');
      }

      // Tenta também registrar em payment_intents caso a policy de SuperAdmin já esteja ativa
      try {
        await supabase.from('payment_intents' as any).insert({
          id: newRecord.id,
          tenant_id: editRow.tenant_id,
          plan: manualForm.plan,
          amount: amountNum,
          mp_payment_id: `MANUAL-${newRecord.id.slice(0, 8).toUpperCase()}`,
          status: 'approved',
          paid_at: paymentIso,
          raw: {
            manual: true,
            payment_method: manualForm.payment_method,
            notes: newRecord.notes,
          },
        });
      } catch {
        // Ignora caso RLS em payment_intents ainda seja somente leitura; o registro já está salvo em tenant_plans
      }

      const savedRow = normalizeRow({
        ...editRow,
        ...(updatedData[0] as any),
        tenants: editRow.tenants,
      });

      setEditRow(savedRow);
      setRows(prev => prev.map(r => (r.id === editRow.id ? savedRow : r)));
      setEditForm(f => ({
        ...f,
        plan: savedRow.plan,
        status: savedRow.status,
        last_payment_at: manualForm.paid_at,
        last_payment_method: manualForm.payment_method,
        current_period_end: savedRow.current_period_end ? savedRow.current_period_end.slice(0, 10) : f.current_period_end,
      }));
      setManualForm(f => ({
        ...f,
        notes: '',
        new_period_end: computeNextEndDate(
          savedRow.current_period_end,
          f.paid_at,
          f.plan,
          decoded.courtesy_months
        ),
      }));

      void loadPaymentsForTenant(editRow.tenant_id, true);
      toast.success(
        `Pagamento manual de ${fmtBRL(amountNum)} (${MANUAL_PAYMENT_METHOD_LABELS[manualForm.payment_method]}) registrado com sucesso!`
      );
    } catch (err: any) {
      console.error('Erro ao registrar pagamento manual:', err);
      toast.error(err.message || 'Erro ao registrar pagamento manual');
    } finally {
      setSavingManualPayment(false);
    }
  };

  const handleDeleteManualPayment = async (paymentId: string) => {
    if (!editRow) return;
    try {
      const decoded = decodePlanPricing(editRow);
      const nextManualPayments = (decoded.manual_payments || []).filter(p => p.id !== paymentId);
      const encodedMeta = encodePlanPricingMeta(
        {
          ...decoded,
          manual_payments: nextManualPayments,
        },
        editRow.mp_customer_id
      );

      const { data: updatedData, error } = await supabase
        .from('tenant_plans' as any)
        .update({ mp_customer_id: encodedMeta })
        .eq('id', editRow.id)
        .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id');

      if (error) throw error;

      try {
        await supabase.from('payment_intents' as any).delete().eq('id', paymentId);
      } catch {}

      if (updatedData && updatedData[0]) {
        const savedRow = normalizeRow({
          ...editRow,
          ...(updatedData[0] as any),
          tenants: editRow.tenants,
        });
        setEditRow(savedRow);
        setRows(prev => prev.map(r => (r.id === editRow.id ? savedRow : r)));
      }
      void loadPaymentsForTenant(editRow.tenant_id, true);
      toast.success('Registro de pagamento manual removido.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover pagamento manual');
    }
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSavingEdit(true);
    try {
      const parsedMonthly = parseBRLInput(editForm.monthly_price);
      const parsedYearly = parseBRLInput(editForm.yearly_price);
      const mPrice = !isNaN(parsedMonthly) && parsedMonthly > 0 ? parsedMonthly : DEFAULT_MONTHLY_PRICE;
      const yPrice = !isNaN(parsedYearly) && parsedYearly > 0 ? parsedYearly : DEFAULT_YEARLY_PRICE;
      const mDisc = Math.min(100, Math.max(0, Number(editForm.monthly_discount_pct) || 0));
      const yDisc = Math.min(100, Math.max(0, Number(editForm.yearly_discount_pct) || 0));
      const cMonths = Math.min(12, Math.max(0, parseInt(editForm.courtesy_months) || 0));
      const maxInst = Math.min(10, Math.max(1, parseInt(editForm.max_installments) || 10));
      const cleanNotes = editForm.notes.trim() || null;

      const decoded = decodePlanPricing(editRow);
      const encodedMeta = encodePlanPricingMeta(
        {
          monthly_price: mPrice,
          yearly_price: yPrice,
          monthly_discount_pct: mDisc,
          yearly_discount_pct: yDisc,
          courtesy_months: cMonths,
          max_installments: maxInst,
          notes: cleanNotes,
          last_payment_method: editForm.last_payment_method,
          manual_payments: decoded.manual_payments || [],
        },
        editRow.mp_customer_id
      );

      const basePatchWithMeta: any = {
        plan: editForm.plan,
        status: editForm.status,
        trial_ends_at: editForm.trial_ends_at ? new Date(`${editForm.trial_ends_at}T23:59:59Z`).toISOString() : null,
        current_period_end: editForm.current_period_end ? new Date(`${editForm.current_period_end}T23:59:59Z`).toISOString() : null,
        last_payment_at: editForm.last_payment_at ? new Date(`${editForm.last_payment_at}T12:00:00Z`).toISOString() : null,
        mp_customer_id: encodedMeta,
      };

      const fullPatch: any = {
        ...basePatchWithMeta,
        monthly_price: mPrice,
        yearly_price: yPrice,
        monthly_discount_pct: mDisc,
        yearly_discount_pct: yDisc,
        courtesy_months: cMonths,
        max_installments: maxInst,
        notes: cleanNotes,
      };

      let { data: updatedData, error } = await supabase
        .from('tenant_plans' as any)
        .update(fullPatch)
        .eq('id', editRow.id)
        .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id');

      if (error) {
        const retry = await supabase
          .from('tenant_plans' as any)
          .update(basePatchWithMeta)
          .eq('id', editRow.id)
          .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, mp_customer_id');
        updatedData = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (!updatedData || updatedData.length === 0) {
        throw new Error('Nenhuma linha foi gravada no banco. Verifique as permissões de SuperAdmin.');
      }

      const savedRow = normalizeRow({
        ...editRow,
        ...(updatedData[0] as any),
        tenants: editRow.tenants,
      });
      setRows(prev => prev.map(r => (r.id === editRow.id ? savedRow : r)));

      toast.success(`Assinatura e valores de ${editRow.tenants?.name} gravados no banco com sucesso!`);
      setEditRow(null);
      void fetchData();
    } catch (err: any) {
      console.error('Erro ao salvar assinatura:', err);
      toast.error(err.message || 'Erro ao salvar alterações da assinatura no banco');
    } finally {
      setSavingEdit(false);
    }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Filtered rows
  const filteredRows = rows.filter(r => {
    const q = search.trim().toLowerCase();
    const name = r.tenants?.name?.toLowerCase() || '';
    const slug = r.tenants?.slug?.toLowerCase() || '';
    const matchesSearch = !q || name.includes(q) || slug.includes(q);

    const matchesPlan = filterPlan === 'all' || r.plan === filterPlan;

    let matchesStatus = true;
    if (filterStatus !== 'all') {
      if (filterStatus === 'expiring_soon') {
        const info = getExpirationInfo(r);
        matchesStatus = info.isExpiringSoon && !info.isExpired;
      } else {
        matchesStatus = r.status === filterStatus;
      }
    }

    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Metric stats
  const totalLicencas = rows.length;
  const trialCount = rows.filter(r => r.plan === 'trial').length;
  const proAtivosCount = rows.filter(r => r.plan !== 'trial' && r.status === 'active').length;
  const expiringSoonCount = rows.filter(r => {
    const info = getExpirationInfo(r);
    return info.isExpiringSoon && !info.isExpired && r.status === 'active';
  }).length;
  const suspensosCount = rows.filter(r => r.status === 'suspended').length;
  const expiradosCount = rows.filter(r => r.status === 'expired').length;
  const mrrEstimado = rows
    .filter(r => r.plan !== 'trial' && r.status === 'active')
    .reduce((acc, r) => {
      const p = computeEffectivePrices(r);
      return acc + (r.plan === 'pro_monthly' ? p.monthlyFinal : p.yearlyFinal / 12);
    }, 0);

  // Live preview inside modal
  const modalPreview = (() => {
    const mBase = parseBRLInput(editForm.monthly_price) || DEFAULT_MONTHLY_PRICE;
    const mDisc = Math.min(100, Math.max(0, Number(editForm.monthly_discount_pct) || 0));
    const mFinal = Math.round(mBase * (1 - mDisc / 100) * 100) / 100;

    const yBase = parseBRLInput(editForm.yearly_price) || DEFAULT_YEARLY_PRICE;
    const yDisc = Math.min(100, Math.max(0, Number(editForm.yearly_discount_pct) || 0));
    const yFinal = Math.round(yBase * (1 - yDisc / 100) * 100) / 100;

    const cMonths = Math.max(0, parseInt(editForm.courtesy_months) || 0);
    const maxInst = Math.min(10, Math.max(1, parseInt(editForm.max_installments) || 10));

    return { mBase, mDisc, mFinal, yBase, yDisc, yFinal, cMonths, maxInst };
  })();

  // Combined payment list (Manual + Mercado Pago) for the active tenant in modal
  const combinedPayments = (() => {
    if (!editRow) return [];
    const manualList = decodePlanPricing(editRow).manual_payments || [];
    const mpList = payments[editRow.tenant_id] || [];
    const manualIds = new Set(manualList.map(m => m.id));

    const unified: {
      id: string;
      isManual: boolean;
      amount: number;
      plan: string;
      status: string;
      paid_at: string | null;
      created_at: string;
      paymentMethodLabel: string;
      reference: string;
    }[] = [
      ...manualList.map(m => ({
        id: m.id,
        isManual: true,
        amount: Number(m.amount),
        plan: m.plan,
        status: 'paid',
        paid_at: m.paid_at,
        created_at: m.created_at,
        paymentMethodLabel: MANUAL_PAYMENT_METHOD_LABELS[m.payment_method] || m.payment_method,
        reference: m.notes || 'Pagamento manual',
      })),
      ...mpList
        .filter(p => !manualIds.has(p.id))
        .map(p => {
          const isManualRaw = !!(p.raw && typeof p.raw === 'object' && p.raw.manual);
          const methodKey = p.raw?.payment_method as ManualPaymentMethod | undefined;
          return {
            id: p.id,
            isManual: isManualRaw,
            amount: Number(p.amount),
            plan: p.plan,
            status: p.status,
            paid_at: p.paid_at,
            created_at: p.created_at,
            paymentMethodLabel: methodKey
              ? MANUAL_PAYMENT_METHOD_LABELS[methodKey] || methodKey
              : 'Mercado Pago',
            reference: p.raw?.notes || p.mp_payment_id || '—',
          };
        }),
    ];

    return unified.sort(
      (a, b) =>
        new Date(b.paid_at || b.created_at).getTime() -
        new Date(a.paid_at || a.created_at).getTime()
    );
  })();

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Controle de Planos, Assinaturas & Cobranças</h1>
            <p className="text-xs text-muted-foreground">
              Gestão unificada de mensalidades, anuidades, descontos, meses de cortesia e pagamentos de cada tenant.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Estabelecimentos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalLicencas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Em Período de Teste</p>
          <p className="text-2xl font-bold text-primary mt-1">{trialCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Planos PRO Ativos</p>
          <p className="text-2xl font-bold text-success mt-1">{proAtivosCount}</p>
        </Card>
        <Card className="p-4 border-success/30 bg-success/5">
          <p className="text-xs text-success font-semibold">MRR Estimado</p>
          <p className="text-xl font-bold text-success mt-1">{fmtBRL(mrrEstimado)}</p>
        </Card>
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Vencendo em Breve</p>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{expiringSoonCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Suspensos / Expirados</p>
          <p className="text-2xl font-bold text-destructive mt-1">{suspensosCount + expiradosCount}</p>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">Todas as Assinaturas & Licenças</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Exibindo {filteredRows.length} de {rows.length}
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug do tenant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expiring_soon">⚠️ Vencendo em breve (&le; 7 dias)</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Tipo de Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                <SelectItem value="trial">Trial (Teste)</SelectItem>
                <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                <SelectItem value="pro_yearly">PRO Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3 py-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-medium">Nenhum plano encontrado com os filtros atuais.</p>
              <p className="text-xs mt-1">Tente remover os termos de busca ou mudar os filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2.5 pr-4">Estabelecimento</th>
                    <th className="py-2.5 pr-4">Plano Atual</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Valores & Benefícios</th>
                    <th className="py-2.5 pr-4">Renovação / Vigência</th>
                    <th className="py-2.5 text-right">Ações SuperAdmin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => {
                    const expInfo = getExpirationInfo(r);
                    const pricing = computeEffectivePrices(r);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        {/* Tenant */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-semibold text-foreground leading-tight">
                                {r.tenants?.name || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                /{r.tenants?.slug}
                              </p>
                            </div>
                            {r.tenants?.active === false && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Loja Desativada
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Plan selection */}
                        <td className="py-3 pr-4">
                          <Select value={r.plan} onValueChange={(v) => updatePlan(r, v as PlanType)}>
                            <SelectTrigger className="h-8 w-36 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">Trial</SelectItem>
                              <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                              <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Status selection */}
                        <td className="py-3 pr-4">
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as PlanStatus)}>
                            <SelectTrigger className="h-8 w-36 text-xs font-medium">
                              <SelectValue>
                                <span className="flex items-center gap-1.5">
                                  <span className={`h-2 w-2 rounded-full ${
                                    r.status === 'active' ? 'bg-success' :
                                    r.status === 'suspended' ? 'bg-destructive' :
                                    r.status === 'expired' ? 'bg-destructive' :
                                    r.status === 'pending_payment' ? 'bg-amber-500' : 'bg-muted-foreground'
                                  }`} />
                                  {statusLabel[r.status] || r.status}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="suspended">Suspenso</SelectItem>
                              <SelectItem value="expired">Expirado</SelectItem>
                              <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                              <SelectItem value="canceled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Pricing & discounts summary */}
                        <td className="py-3 pr-4 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground">
                                {r.plan === 'pro_yearly'
                                  ? `${fmtBRL(pricing.yearlyFinal)}/ano`
                                  : `${fmtBRL(pricing.monthlyFinal)}/mês`}
                              </span>
                              {r.plan !== 'pro_yearly' && pricing.monthlyDisc > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-success border-success/30">
                                  -{pricing.monthlyDisc}%
                                </Badge>
                              )}
                              {r.plan === 'pro_yearly' && pricing.yearlyDisc > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-success border-success/30">
                                  -{pricing.yearlyDisc}%
                                </Badge>
                              )}
                              {pricing.courtesyMonths > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                  +{pricing.courtesyMonths}m brinde
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Anual: {fmtBRL(pricing.yearlyFinal)} (até {pricing.maxInstallments}x)
                            </p>
                          </div>
                        </td>

                        {/* Renewal Date with countdown & last payment */}
                        <td className="py-3 pr-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-foreground">
                              {r.plan === 'trial' ? fmtDate(r.trial_ends_at) : fmtDate(r.current_period_end)}
                            </p>
                            {expInfo.isLifetime ? (
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 px-1.5 py-0">
                                <InfinityIcon className="h-3 w-3" /> Vitalício
                              </Badge>
                            ) : expInfo.isExpiringSoon && !expInfo.isExpired ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium px-1.5 py-0">
                                ⚠️ {expInfo.badgeText}
                              </Badge>
                            ) : expInfo.isExpired ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                {expInfo.badgeText}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {expInfo.badgeText}
                              </span>
                            )}
                            {r.last_payment_at && (
                              <p className="text-[10px] text-muted-foreground pt-0.5">
                                Últ. pagto: {fmtDate(r.last_payment_at)}
                                {pricing.lastPaymentMethod
                                  ? ` · ${MANUAL_PAYMENT_METHOD_LABELS[pricing.lastPaymentMethod] || pricing.lastPaymentMethod}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* SuperAdmin Actions (Unificadas) */}
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                                  onClick={() => openManageModal(r, 'assinatura')}
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5" />
                                  <span className="hidden lg:inline">Gerenciar Assinatura</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Gestão completa: vigência, valores, descontos, cortesias e cobranças</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                  onClick={() => openManageModal(r, 'cobrancas')}
                                >
                                  <Banknote className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Registrar pagamento avulso/manual (data e forma de pagamento)</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                  onClick={() => openManageModal(r, 'valores')}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Configurar mensalidade, anuidade, descontos e meses de brinde</TooltipContent>
                            </Tooltip>

                            {r.status === 'suspended' ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-success hover:bg-success/10"
                                    onClick={() => updateStatus(r.id, 'active')}
                                  >
                                    <PlayCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reativar estabelecimento</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => updateStatus(r.id, 'suspended')}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Suspender estabelecimento</TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => openManageModal(r, 'cobrancas')}
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Histórico de pagamentos (Manual & Mercado Pago)</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UNIFIED MODAL: Gestão Completa da Assinatura, Valores, Descontos, Cortesias & Pagamentos */}
      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Gestão Completa da Assinatura · {editRow?.tenants?.name}
            </DialogTitle>
            <DialogDescription>
              Configure vigência, cortesias, valores personalizados, descontos e registre pagamentos avulsos/manuais de <strong>/{editRow?.tenants?.slug}</strong>.
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <Tabs
              value={activeModalTab}
              onValueChange={(v) => {
                const next = v as 'assinatura' | 'valores' | 'cobrancas';
                setActiveModalTab(next);
                if (next === 'cobrancas') void loadPaymentsForTenant(editRow.tenant_id);
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="assinatura" className="text-xs gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Vigência & Cortesia
                </TabsTrigger>
                <TabsTrigger value="valores" className="text-xs gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Valores & Descontos
                </TabsTrigger>
                <TabsTrigger value="cobrancas" className="text-xs gap-1.5">
                  <Banknote className="h-3.5 w-3.5" /> Pagamentos & Cobranças
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: VIGÊNCIA, PLANO E EXTENSÕES RÁPIDAS */}
              <TabsContent value="assinatura" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de Plano</Label>
                    <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v as PlanType }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial (Teste)</SelectItem>
                        <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                        <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Status da Assinatura</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v as PlanStatus }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                        <SelectItem value="expired">Expirado</SelectItem>
                        <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                        <SelectItem value="canceled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quick Extension & Courtesy Buttons */}
                <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Gift className="h-4 w-4 text-amber-500" />
                      Extensão Rápida de Vigência / Cortesia
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Soma dias à data atual ou futura
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { label: '+7 dias', days: 7 },
                      { label: '+15 dias', days: 15 },
                      { label: '+1 mês', days: 30 },
                      { label: '+2 meses', days: 60 },
                      { label: '+3 meses', days: 90 },
                      { label: '+1 ano', days: 365 },
                    ].map(btn => (
                      <Button
                        key={btn.days}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => addDaysToFormDate(btn.days)}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-8 gap-1.5 text-xs border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary"
                    onClick={setLifetimeInForm}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Conceder Plano Vitalício (Ano 2099)
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="period-end" className="text-xs">Vencimento (PRO)</Label>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline"
                        onClick={() => addDaysToFormDate(30)}
                      >
                        +30d
                      </button>
                    </div>
                    <Input
                      id="period-end"
                      type="date"
                      value={editForm.current_period_end}
                      onChange={e => setEditForm(f => ({ ...f, current_period_end: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="trial-end" className="text-xs">Fim do Trial</Label>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          setEditForm(f => ({ ...f, trial_ends_at: d.toISOString().slice(0, 10) }));
                        }}
                      >
                        +14d
                      </button>
                    </div>
                    <Input
                      id="trial-end"
                      type="date"
                      value={editForm.trial_ends_at}
                      onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="last-pay" className="text-xs">Data Últ. Pagamento</Label>
                      <button
                        type="button"
                        className="text-[11px] text-primary hover:underline"
                        onClick={() => setEditForm(f => ({ ...f, last_payment_at: new Date().toISOString().slice(0, 10) }))}
                      >
                        Hoje
                      </button>
                    </div>
                    <Input
                      id="last-pay"
                      type="date"
                      value={editForm.last_payment_at}
                      onChange={e => setEditForm(f => ({ ...f, last_payment_at: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma do Pagamento</Label>
                    <Select
                      value={editForm.last_payment_method}
                      onValueChange={(v) => setEditForm(f => ({ ...f, last_payment_method: v as ManualPaymentMethod }))}
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(MANUAL_PAYMENT_METHOD_LABELS) as [ManualPaymentMethod, string][]).map(
                          ([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Deseja registrar um pagamento avulso/manual completo?</p>
                    <p className="text-[11px] text-muted-foreground">
                      Escolha valor, data do pagamento, forma de pagamento e renove a vigência com histórico.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                    onClick={() => {
                      setActiveModalTab('cobrancas');
                      void loadPaymentsForTenant(editRow.tenant_id);
                    }}
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Registrar Pagamento
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-notes" className="text-xs">Observações Internas da Assinatura</Label>
                  <Input
                    id="plan-notes"
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Ex: Condição comercial especial acordada na implantação..."
                    className="text-xs"
                  />
                </div>
              </TabsContent>

              {/* TAB 2: VALORES, DESCONTOS E MESES DE BRINDE/CORTESIA */}
              <TabsContent value="valores" className="space-y-4 pt-3">
                {/* Resumo calculado em tempo real */}
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">PRO Mensal (Final)</p>
                    <p className="text-lg font-bold text-foreground">
                      {fmtBRL(modalPreview.mFinal)}<span className="text-xs font-normal text-muted-foreground">/mês</span>
                    </p>
                    {modalPreview.mDisc > 0 && (
                      <p className="text-success text-[11px]">
                        Desconto de {modalPreview.mDisc}% sobre {fmtBRL(modalPreview.mBase)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">PRO Anual (Final)</p>
                    <p className="text-lg font-bold text-foreground">
                      {fmtBRL(modalPreview.yFinal)}<span className="text-xs font-normal text-muted-foreground">/ano</span>
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Até <strong>{modalPreview.maxInst}x de {fmtBRL(modalPreview.yFinal / modalPreview.maxInst)}</strong> no cartão
                      {modalPreview.cMonths > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1">
                          · +{modalPreview.cMonths} mês(es) brinde
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Configuração Plano Mensal */}
                <div className="p-3.5 rounded-xl border space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">Plano Mensal</h4>
                    <div className="flex gap-1">
                      {[0, 10, 15, 20].map(pct => (
                        <Button
                          key={pct}
                          type="button"
                          variant={Number(editForm.monthly_discount_pct) === pct ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setEditForm(f => ({ ...f, monthly_discount_pct: String(pct) }))}
                        >
                          {pct === 0 ? 'Sem desc.' : `-${pct}%`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor da Mensalidade (R$)</Label>
                      <CurrencyInput
                        value={editForm.monthly_price}
                        onValueChange={(v) => setEditForm(f => ({ ...f, monthly_price: v }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Percent className="h-3 w-3" /> Desconto no Mensal (%)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editForm.monthly_discount_pct}
                        onChange={e => setEditForm(f => ({ ...f, monthly_discount_pct: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Configuração Plano Anual + Meses de Cortesia */}
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Plano Anual & Meses de Brinde/Cortesia
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Defina a anuidade, desconto percentual e/ou meses de cortesia para o assinante anual.
                      </p>
                    </div>
                  </div>

                  {/* Atalhos de meses de brinde no plano anual */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Atalhos de Benefício (Meses de Cortesia no Anual):</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { months: 0, label: 'Sem brinde (12x)' },
                        { months: 1, label: '1 mês grátis (paga 11)' },
                        { months: 2, label: '2 meses grátis (paga 10)' },
                        { months: 3, label: '3 meses grátis (paga 9)' },
                      ].map(opt => (
                        <Button
                          key={opt.months}
                          type="button"
                          variant={parseInt(editForm.courtesy_months) === opt.months ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 text-[11px]"
                          onClick={() => applyCourtesyMonthsDiscountAndValidity(opt.months)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor da Anuidade (R$)</Label>
                      <CurrencyInput
                        value={editForm.yearly_price}
                        onValueChange={(v) => setEditForm(f => ({ ...f, yearly_price: v }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Desconto Anual (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={editForm.yearly_discount_pct}
                        onChange={e => setEditForm(f => ({ ...f, yearly_discount_pct: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Meses de Brinde</Label>
                      <Input
                        type="number"
                        min="0"
                        max="12"
                        step="1"
                        value={editForm.courtesy_months}
                        onChange={e => setEditForm(f => ({ ...f, courtesy_months: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Máx. Parcelas Cartão</Label>
                      <Select value={editForm.max_installments} onValueChange={v => setEditForm(f => ({ ...f, max_installments: v }))}>
                        <SelectTrigger className="font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <SelectItem key={n} value={String(n)}>Até {n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: REGISTRO DE PAGAMENTO AVULSO/MANUAL + HISTÓRICO DE PAGAMENTOS */}
              <TabsContent value="cobrancas" className="space-y-4 pt-3">
                {/* Formulário de Pagamento Avulso / Manual */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Registrar Pagamento Avulso / Manual
                      </h4>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      Ativa assinatura imediatamente
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Plano Referência</Label>
                      <Select
                        value={manualForm.plan}
                        onValueChange={(v) => {
                          const nextPlan = v as 'pro_monthly' | 'pro_yearly';
                          const suggestedAmount =
                            nextPlan === 'pro_yearly' ? modalPreview.yFinal : modalPreview.mFinal;
                          const nextEnd = computeNextEndDate(
                            editRow.current_period_end,
                            manualForm.paid_at,
                            nextPlan,
                            modalPreview.cMonths
                          );
                          setManualForm(f => ({
                            ...f,
                            plan: nextPlan,
                            amount: formatBRLInput(suggestedAmount),
                            new_period_end: nextEnd,
                          }));
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                          <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Pago (R$)</Label>
                      <CurrencyInput
                        value={manualForm.amount}
                        onValueChange={amount => setManualForm(f => ({ ...f, amount }))}
                        className="h-9 text-xs bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Data do Pagamento</Label>
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            setManualForm(f => ({
                              ...f,
                              paid_at: today,
                              new_period_end: computeNextEndDate(
                                editRow.current_period_end,
                                today,
                                f.plan,
                                modalPreview.cMonths
                              ),
                            }));
                          }}
                        >
                          Hoje
                        </button>
                      </div>
                      <Input
                        type="date"
                        value={manualForm.paid_at}
                        onChange={e => {
                          const nextPaidAt = e.target.value;
                          setManualForm(f => ({
                            ...f,
                            paid_at: nextPaidAt,
                            new_period_end: computeNextEndDate(
                              editRow.current_period_end,
                              nextPaidAt,
                              f.plan,
                              modalPreview.cMonths
                            ),
                          }));
                        }}
                        className="h-9 font-mono text-xs bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Forma de Pagamento</Label>
                      <Select
                        value={manualForm.payment_method}
                        onValueChange={v =>
                          setManualForm(f => ({ ...f, payment_method: v as ManualPaymentMethod }))
                        }
                      >
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(MANUAL_PAYMENT_METHOD_LABELS) as [ManualPaymentMethod, string][]).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={manualForm.renew_validity}
                          onChange={e => setManualForm(f => ({ ...f, renew_validity: e.target.checked }))}
                          className="rounded border-border text-primary"
                        />
                        <span>Novo Vencimento da Assinatura</span>
                      </label>
                      <Input
                        type="date"
                        disabled={!manualForm.renew_validity}
                        value={manualForm.new_period_end}
                        onChange={e => setManualForm(f => ({ ...f, new_period_end: e.target.value }))}
                        className="h-9 font-mono text-xs bg-background"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Observação / Comprovante (opcional)</Label>
                      <Input
                        value={manualForm.notes}
                        onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Ex: PIX direto no CNPJ, Cartão 3x..."
                        className="h-9 text-xs bg-background"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleRegisterManualPayment}
                      disabled={savingManualPayment}
                      className="h-9 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {savingManualPayment ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Registrando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Pagamento Manual
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Histórico Unificado de Pagamentos */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico de Pagamentos ({combinedPayments.length})
                  </h4>

                  {loadingPayments ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-xl">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="py-2.5 px-3">Data do Pagto</th>
                            <th className="py-2.5 px-3">Forma</th>
                            <th className="py-2.5 px-3">Plano</th>
                            <th className="py-2.5 px-3">Valor</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Obs / ID</th>
                            <th className="py-2.5 px-3 text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedPayments.map(p => (
                            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-2.5 px-3 text-xs font-medium text-foreground">
                                {fmtDate(p.paid_at || p.created_at)}
                              </td>
                              <td className="py-2.5 px-3 text-xs">
                                <Badge variant="outline" className="text-[10px]">
                                  {p.paymentMethodLabel}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-xs">
                                {planLabels[p.plan as PlanType] || p.plan}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-foreground text-xs">
                                {fmtBRL(p.amount)}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant={p.status === 'approved' || p.status === 'paid' ? 'default' : 'secondary'}
                                  className="text-[10px]"
                                >
                                  {p.isManual ? 'Manual · Pago' : p.status === 'approved' ? 'Aprovado' : p.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[180px] truncate" title={p.reference}>
                                {p.reference}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {p.isManual && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    title="Remover registro manual"
                                    onClick={() => handleDeleteManualPayment(p.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {combinedPayments.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                                Nenhum pagamento (manual ou Mercado Pago) registrado para este estabelecimento.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
