import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

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
  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', supaUser.id)
    .single();

  // Fetch roles (pick highest: superadmin > admin > others)
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', supaUser.id);

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
    .single();

  if (!profile) return null;

  const tenant = memberData?.tenants as any;

  return {
    id: supaUser.id,
    name: profile.name,
    email: profile.email,
    role: (roleData?.role as AppRole) || 'atendente',
    tenantId: tenant?.id || '',
    tenantSlug: tenant?.slug || 'loja-padrao',
    tenantName: tenant?.name || 'Loja',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = React.useRef(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Handled by getSession below
        return;
      }
      if (session?.user) {
        setTimeout(async () => {
          const appUser = await fetchAppUser(session.user);
          setUser(appUser);
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Check existing session (runs once)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      if (session?.user) {
        const appUser = await fetchAppUser(session.user);
        setUser(appUser);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
