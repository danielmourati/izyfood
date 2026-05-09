import React from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  className?: string;
  to?: string;
  label?: string;
}

/**
 * Small inline "back" button. By default goes to tenant home.
 * Hidden when already at tenant home or on /pdv (which has its own back UI).
 */
export const BackButton: React.FC<BackButtonProps> = ({ className, to = '/', label = 'Voltar' }) => {
  const navigate = useTenantNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const slug = user?.tenantSlug || '';
  const stripped = location.pathname.replace(new RegExp(`^/${slug}`), '') || '/';

  if (stripped === '/' || stripped === '' || stripped.startsWith('/pdv')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 -ml-2 hover:bg-muted/60 active:scale-95',
        className,
      )}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
};
