import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { formatAuthError, withRetry } from '@/lib/auth-errors';

export type AppRole = 'admin' | 'atendente' | 'motoboy' | 'superadmin';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchAppUser(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    return await withRetry(async () => {
      // Fetch profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', supaUser.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      // Fetch roles (pick highest: superadmin > admin > others)
      const { data: rolesData, error: rolesErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supaUser.id);

      if (rolesErr) throw rolesErr;

      const roles = (rolesData || []).map(r => r.role as AppRole);
      const bestRole = roles.includes('superadmin') ? 'superadmin'
        : roles.includes('admin') ? 'admin'
        : roles[0] || 'atendente';

      // Fetch tenant membership + tenant info
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id, role, tenants(id, name, slug)')
        .eq('user_id', supaUser.id)
        .limit(1)
        .maybeSingle();

      const userName = profile?.name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'Usuário';
      const userEmail = profile?.email || supaUser.email || '';

      const rawTenant = memberData?.tenants as any;
      const tenantObj = Array.isArray(rawTenant) ? rawTenant[0] : rawTenant;

      let tenantId = tenantObj?.id || memberData?.tenant_id || '';
      let tenantSlug = tenantObj?.slug || '';
      let tenantName = tenantObj?.name || '';

      // Tentar buscar diretamente na tabela tenants se tiver id mas não tiver slug
      if (!tenantSlug && tenantId) {
        try {
          const { data: tData } = await supabase
            .from('tenants')
            .select('id, name, slug')
            .eq('id', tenantId)
            .maybeSingle();
          if (tData) {
            tenantId = tData.id;
            tenantSlug = tData.slug;
            tenantName = tData.name;
          }
        } catch (e) {
          console.warn('[Auth] Erro ao buscar tenant por ID:', e);
        }
      }

      // Se ainda assim não encontrar slug e não for superadmin, buscar o primeiro tenant ativo no banco
      if (!tenantSlug && bestRole !== 'superadmin') {
        try {
          const { data: firstTenant } = await supabase
            .from('tenants')
            .select('id, name, slug')
            .limit(1)
            .maybeSingle();
          if (firstTenant?.slug) {
            tenantId = firstTenant.id;
            tenantSlug = firstTenant.slug;
            tenantName = firstTenant.name;
          }
        } catch (e) {
          console.warn('[Auth] Erro ao buscar tenant fallback:', e);
        }
      }

      // Garantir que não deslogará o usuário caso haja uma falha pontual de RLS
      if (bestRole !== 'superadmin' && !tenantSlug) {
        console.warn('[Auth] Usuário sem tenant vinculado após fallbacks:', supaUser.email);
        tenantSlug = 'default';
      }

      return {
        id: supaUser.id,
        name: userName,
        email: userEmail,
        role: bestRole,
        tenantId,
        tenantSlug,
        tenantName: tenantName || (bestRole === 'superadmin' ? 'Super Admin' : 'Minha Loja'),
      };
    }, 2, 600);
  } catch (err) {
    console.error('[Auth] Erro ao carregar dados do usuário:', err);
    // Retornar objeto básico em caso de falha completa de rede em vez de travar o app
    return {
      id: supaUser.id,
      name: supaUser.email?.split('@')[0] || 'Usuário',
      email: supaUser.email || '',
      role: 'atendente',
      tenantId: '',
      tenantSlug: 'default',
      tenantName: 'Minha Loja',
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Timeout de segurança máximo de 3.5s para nunca travar a aplicação no loader
    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 3500);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (session?.user) {
        try {
          const appUser = await fetchAppUser(session.user);
          if (active) {
            setUser(appUser);
            setLoading(false);
          }
        } catch {
          if (active) setLoading(false);
        }
      } else {
        if (active) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Check existing session (runs once)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const appUser = await fetchAppUser(session.user);
          if (active) setUser(appUser);
        } catch (err) {
          console.error('[Auth] Erro na sessão inicial:', err);
        }
      }
      if (active) setLoading(false);
    }).catch(err => {
      console.error('[Auth] Erro ao obter sessão inicial:', err);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (emailStr: string, passwordStr: string) => {
    const cleanEmail = emailStr.trim();
    const cleanPassword = passwordStr;

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Preencha o e-mail e a senha.' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        success: false,
        error: 'Você está sem conexão com a internet. Verifique sua rede e tente novamente.',
      };
    }

    try {
      const res = await withRetry(async () => {
        return await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
      }, 1, 800);

      if (res.error) {
        return { success: false, error: formatAuthError(res.error) };
      }

      if (res.data?.user) {
        const appUser = await fetchAppUser(res.data.user);
        setUser(appUser);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: formatAuthError(err) };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Erro durante o logout:', err);
    }
    setUser(null);
    window.location.assign('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' || user?.role === 'superadmin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
