import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TrialBanner() {
  const { user, isAdmin } = useAuth();
  const navigate = useTenantNavigate();
  const [plan, setPlan] = useState<{ plan: string; trial_ends_at: string | null; status: string } | null>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('trial-banner-dismissed') === '1');

  useEffect(() => {
    if (!user?.tenantId || !isAdmin) return;
    supabase
      .from('tenant_plans' as any)
      .select('plan, trial_ends_at, status')
      .eq('tenant_id', user.tenantId)
      .maybeSingle()
      .then(({ data }) => setPlan(data as any));
  }, [user?.tenantId, isAdmin]);

  if (!isAdmin || !plan || plan.plan !== 'trial' || dismissed) return null;

  const trialEnds = plan.trial_ends_at ? new Date(plan.trial_ends_at) : null;
  const daysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs text-foreground">
      <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="truncate">
        Você está no <strong>Trial</strong> — {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}.
      </span>
      <Button
        size="sm"
        variant="link"
        className="h-auto p-0 text-xs text-primary font-semibold"
        onClick={() => navigate('/configuracoes?tab=plano')}
      >
        Fazer upgrade
      </Button>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem('trial-banner-dismissed', '1'); }}
        className="ml-auto text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
