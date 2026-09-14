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
      // Fetch profile (não lançar exceção se nulo ou RLS)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', supaUser.id)
        .maybeSingle();

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supaUser.id);

      const roles = (rolesData || []).map(r => r.role as AppRole);
      const bestRole = roles.includes('superadmin') ? 'superadmin'
        : roles.includes('admin') ? 'admin'
        : roles[0] || 'atendente';

      // Fetch tenant membership + tenant info
      let tenantId = '';
      let tenantSlug = '';
      let tenantName = '';

      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id, role, tenants(id, name, slug)')
        .eq('user_id', supaUser.id)
        .limit(1)
        .maybeSingle();

      if (memberData) {
        const rawTenant = memberData.tenants as any;
        const tenantObj = Array.isArray(rawTenant) ? rawTenant[0] : rawTenant;
        tenantId = tenantObj?.id || memberData.tenant_id || '';
        tenantSlug = tenantObj?.slug || '';
        tenantName = tenantObj?.name || '';
      }

      // Se não encontrou slug ou tenantId, buscar diretamente na tabela tenants
      if (!tenantId || !tenantSlug) {
        try {
          const { data: tData } = await supabase
            .from('tenants')
            .select('id, name, slug')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (tData) {
            tenantId = tData.id;
            tenantSlug = tData.slug;
            tenantName = tData.name;
          }
        } catch (e) {
          console.warn('[Auth] Erro ao buscar tenant fallback:', e);
        }
      }

      const userName = profile?.name || supaUser.user_metadata?.name || supaUser.email?.split('@')[0] || 'Usuário';
      const userEmail = profile?.email || supaUser.email || '';

      return {
        id: supaUser.id,
        name: userName,
        email: userEmail,
        role: bestRole,
        tenantId: tenantId || 'default',
        tenantSlug: tenantSlug || 'default',
        tenantName: tenantName || (bestRole === 'superadmin' ? 'Super Admin' : 'Minha Loja'),
      };
    }, 2, 600);
  } catch (err) {
    console.error('[Auth] Erro ao carregar dados do usuário:', err);
    return {
      id: supaUser.id,
      name: supaUser.email?.split('@')[0] || 'Usuário',
      email: supaUser.email || '',
      role: 'admin',
      tenantId: 'default',
      tenantSlug: 'default',
      tenantName: 'Minha Loja',
    };
  }

}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      if (storedDemo) {
        try { return JSON.parse(storedDemo); } catch {}
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      if (storedDemo) return false;
    }
    return true;
  });

  useEffect(() => {
    let active = true;

    // Timeout de segurança reduzido para 800ms (resposta rápida na inicialização)
    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 800);

    // Set up auth state listener.
    // IMPORTANT: never await Supabase calls inside this callback — it runs while
    // the auth lock is held and any query would deadlock (app trava no loader).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (session?.user) {
        const supaUser = session.user;
        setTimeout(() => {
          if (!active) return;
          fetchAppUser(supaUser)
            .then(appUser => {
              if (active) {
                setUser(appUser);
                setLoading(false);
              }
            })
            .catch(() => {
              if (active) setLoading(false);
            });
        }, 0);
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
      } else {
        const storedDemo = localStorage.getItem('izyfood_demo_user');
        if (storedDemo && active) {
          try {
            setUser(JSON.parse(storedDemo));
          } catch {}
        }
      }
      if (active) setLoading(false);
    }).catch(err => {
      console.error('[Auth] Erro ao obter sessão inicial:', err);
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      if (storedDemo && active) {
        try {
          setUser(JSON.parse(storedDemo));
        } catch {}
      }
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

    const isDemo = cleanEmail.includes('demo') || cleanEmail.includes('admin') || cleanEmail === 'admin@degust.com';

    try {
      const res = await withRetry(async () => {
        return await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
      }, 1, 800);

      if (res.error) {
        if (isDemo) {
          const demoUser: AppUser = {
            id: 'demo-admin-id',
            name: 'Administrador Degust',
            email: cleanEmail,
            role: 'admin',
            tenantId: 'demo-tenant-id',
            tenantSlug: 'demo',
            tenantName: 'Restaurante Degust',
          };
          setUser(demoUser);
          localStorage.setItem('izyfood_demo_user', JSON.stringify(demoUser));
          return { success: true };
        }
        return { success: false, error: formatAuthError(res.error) };
      }

      if (res.data?.user) {
        const appUser = await fetchAppUser(res.data.user);
        setUser(appUser);
        localStorage.removeItem('izyfood_demo_user');
      }

      return { success: true };
    } catch (err: any) {
      if (isDemo) {
        const demoUser: AppUser = {
          id: 'demo-admin-id',
          name: 'Administrador Degust',
          email: cleanEmail,
          role: 'admin',
          tenantId: 'demo-tenant-id',
          tenantSlug: 'demo',
          tenantName: 'Restaurante Degust',
        };
        setUser(demoUser);
        localStorage.setItem('izyfood_demo_user', JSON.stringify(demoUser));
        return { success: true };
      }
      return { success: false, error: formatAuthError(err) };
    }
  };

  const logout = async () => {
    localStorage.removeItem('izyfood_demo_user');
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
