import { ReactNode, useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isStoreAvailable, normalizeTenantStatus, TenantStatus } from '@/lib/tenant-status';

export function StoreNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <Store className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold text-foreground">Loja não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Esta loja não existe ou não está disponível no momento.</p>
    </div>
  );
}

/** Blocks a store page when the store is inactive or deleted; rechecks every 60s and on focus. */
export function TenantGate({ slug, children }: { slug?: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<TenantStatus | null>(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    const check = async () => {
      const { data, error } = await (supabase.rpc as any)('tenant_status', { _slug: slug });
      if (!alive || error) return; // keep previous state on network errors
      setStatus(normalizeTenantStatus(data));
    };
    check();
    const id = setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [slug]);

  const blocked = !!slug && status !== null && !isStoreAvailable(status);
  useEffect(() => {
    if (blocked && user && user.role !== 'superadmin') logout();
  }, [blocked, user, logout]);

  if (!slug) return <>{children}</>;
  if (blocked) return <StoreNotFound />;
  return <>{children}</>;
}
