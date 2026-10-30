import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { formatAuthError, withRetry } from '@/lib/auth-errors';
import { withTimeout, TimeoutError } from '@/lib/with-timeout';

const LOGIN_TIMEOUT_MS = 15000;

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
  login: (email: string, password: string, slug?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// One in-flight load per user, shared by login() and onAuthStateChange.
const inflightUserLoads = new Map<string, Promise<AppUser | null>>();

function fetchAppUser(supaUser: SupabaseUser): Promise<AppUser | null> {
  const existing = inflightUserLoads.get(supaUser.id);
  if (existing) return existing;
  const p = loadAppUser(supaUser).finally(() => {
    setTimeout(() => inflightUserLoads.delete(supaUser.id), 2000);
  });
  inflightUserLoads.set(supaUser.id, p);
  return p;
}

async function loadAppUser(supaUser: SupabaseUser): Promise<AppUser | null> {
  try {
    return await withRetry(async () => {
      const [{ data: profile }, { data: rolesData }, { data: memberData }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', supaUser.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', supaUser.id),
        supabase
          .from('tenant_members')
          .select('tenant_id, role, tenants(id, name, slug)')
          .eq('user_id', supaUser.id)
          .limit(1)
          .maybeSingle(),
      ]);

      const roles = (rolesData || []).map(r => r.role as AppRole);
      const bestRole = roles.includes('superadmin') ? 'superadmin'
        : roles.includes('admin') ? 'admin'
        : roles[0] || 'atendente';

      let tenantId = '';
      let tenantSlug = '';
      let tenantName = '';

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
  const [user, setUserState] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      if (storedDemo) {
        try { return JSON.parse(storedDemo); } catch {}
      }
      const storedCached = localStorage.getItem('izyfood_cached_user');
      if (storedCached) {
        try { return JSON.parse(storedCached); } catch {}
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      const storedCached = localStorage.getItem('izyfood_cached_user');
      if (storedDemo || storedCached) return false;
    }
    return true;
  });

  const setUser = (newUser: AppUser | null) => {
    setUserState(newUser);
    if (typeof window !== 'undefined') {
      if (newUser) {
        localStorage.setItem('izyfood_cached_user', JSON.stringify(newUser));
      } else {
        localStorage.removeItem('izyfood_cached_user');
      }
    }
  };

  useEffect(() => {
    let active = true;

    // Safety timer: resolve loading quickly if session check takes time
    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 800);

    // Set up auth state listener.
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
          const storedDemo = localStorage.getItem('izyfood_demo_user');
          if (!storedDemo) {
            setUser(null);
          }
          setLoading(false);
        }
      }
    });

    // Check existing session (runs once on boot)
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
        const storedCached = localStorage.getItem('izyfood_cached_user');
        if (storedDemo && active) {
          try { setUser(JSON.parse(storedDemo)); } catch {}
        } else if (storedCached && active) {
          try { setUser(JSON.parse(storedCached)); } catch {}
        }
      }
      if (active) setLoading(false);
    }).catch(err => {
      console.error('[Auth] Erro ao obter sessão inicial:', err);
      const storedDemo = localStorage.getItem('izyfood_demo_user');
      const storedCached = localStorage.getItem('izyfood_cached_user');
      if (storedDemo && active) {
        try { setUser(JSON.parse(storedDemo)); } catch {}
      } else if (storedCached && active) {
        try { setUser(JSON.parse(storedCached)); } catch {}
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (emailStr: string, passwordStr: string, slug?: string) => {
    const cleanEmail = emailStr.trim();
    let authEmail = cleanEmail;
    const cleanPassword = passwordStr;

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Preencha o e-mail e a senha.' };
    }

    // Demo login fallback disabled: it masked real credential errors.
    const isDemo = false;

    try {
      const startedAt = Date.now();
      const remaining = () => Math.max(1000, LOGIN_TIMEOUT_MS - (Date.now() - startedAt));
      if (cleanEmail) {
        const { data: resolved } = await withTimeout<any>(
          slug
            ? supabase.rpc('resolve_tenant_login', { _slug: slug, _email: cleanEmail })
            : (supabase.rpc as any)('resolve_login_any', { _email: cleanEmail }),
          remaining(),
        );
        if (typeof resolved === 'string' && resolved) authEmail = resolved;
      }
      const res = await withTimeout(
        supabase.auth.signInWithPassword({ email: authEmail, password: cleanPassword }),
        remaining(),
      );

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
        const supaUser = res.data.user;
        localStorage.removeItem('izyfood_demo_user');
        const load = fetchAppUser(supaUser);
        try {
          const appUser = await withTimeout(load, Math.min(8000, remaining()));
          setUser(appUser);
        } catch {
          // Slow store data: enter with cached data if it is this user, finish in background.
          let cached: AppUser | null = null;
          try { cached = JSON.parse(localStorage.getItem('izyfood_cached_user') || 'null'); } catch {}
          if (cached && cached.id === supaUser.id) {
            setUser(cached);
            load.then(u => { if (u) setUser(u); }).catch(() => {});
          } else {
            const appUser = await withTimeout(load, 7000);
            setUser(appUser);
          }
        }
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
      if (err instanceof TimeoutError) return { success: false, error: err.message };
      return { success: false, error: formatAuthError(err) };
    }
  };

  const logout = async () => {
    localStorage.removeItem('izyfood_demo_user');
    localStorage.removeItem('izyfood_cached_user');
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
