import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns a navigate function that auto-prefixes paths with the tenant slug.
 * Usage: const navigate = useTenantNavigate();
 *        navigate('/pdv?mesa=1');  // goes to /loja-padrao/pdv?mesa=1
 */
export function useTenantNavigate() {
  const { user } = useAuth();
  const nav = useNavigate();
  const slug = user?.tenantSlug || '';

  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      // If `to` starts with '/', prefix with slug
      if (to.startsWith('/')) {
        nav(`/${slug}${to}`, options);
      } else {
        nav(to, options);
      }
    },
    [nav, slug],
  );
}

/**
 * Returns the base path for the current tenant (e.g. "/loja-padrao")
 */
export function useTenantBasePath() {
  const { user } = useAuth();
  return `/${user?.tenantSlug || ''}`;
}
