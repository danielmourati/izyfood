import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, Search, KeyRound, Loader2, Plus, Pencil, Trash2,
  Eye, EyeOff, Copy, Check, RefreshCw, ShieldCheck, Store, UserCheck, Layers
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserFormModal, type UserFormValue } from '@/components/UserFormModal';

const roleLabels: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
};

const rolePluralLabels: Record<string, string> = {
  superadmin: 'Super Administradores',
  admin: 'Administradores',
  atendente: 'Atendentes',
  motoboy: 'Motoboys',
};

const roleOrder: Record<string, number> = {
  superadmin: 0,
  admin: 1,
  atendente: 2,
  motoboy: 3,
};

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  superadmin: 'destructive',
  admin: 'default',
  atendente: 'secondary',
  motoboy: 'outline',
};

export interface UserWithTenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  createdAt?: string;
}

type GroupMode = 'tenant_and_role' | 'tenant' | 'role';

function generateRandomPassword(length = 10): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%&*';
  let pass = '';
  pass += letters[Math.floor(Math.random() * letters.length)];
  pass += letters[Math.floor(Math.random() * letters.length)].toLowerCase();
  pass += numbers[Math.floor(Math.random() * numbers.length)];
  pass += specials[Math.floor(Math.random() * specials.length)];
  const allChars = letters + numbers + specials;
  for (let i = pass.length; i < length; i++) {
    pass += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return pass.split('').sort(() => 0.5 - Math.random()).join('');
}

function hasValidTenantLink(
  u: UserWithTenant,
  validTenantIds: Set<string>,
  validTenantSlugs: Set<string>
): boolean {
  const hasName = Boolean(u.tenantName && u.tenantName.trim() !== '' && u.tenantName.trim() !== '—');
  if (!hasName) return false;
  if (validTenantIds.size > 0 || validTenantSlugs.size > 0) {
    const matchesId = Boolean(u.tenantId && validTenantIds.has(u.tenantId));
    const matchesSlug = Boolean(u.tenantSlug && validTenantSlugs.has(u.tenantSlug));
    return matchesId || matchesSlug;
  }
  return Boolean(u.tenantId || u.tenantSlug);
}

export function SuperAdminUsersTab() {
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('tenant_and_role');
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);

  // Password reset modal
  const [resetModal, setResetModal] = useState<UserWithTenant | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [resetting, setResetting] = useState(false);

  // User form modal (create/edit)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<UserFormValue | undefined>();

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<UserWithTenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sanitizeAndCleanOrphans = useCallback(
    (
      rawList: UserWithTenant[],
      allTenants: { id: string; name: string; slug: string }[]
    ): UserWithTenant[] => {
      const validIds = new Set(allTenants.map(t => t.id));
      const validSlugs = new Set(allTenants.map(t => t.slug));

      const validUsers: UserWithTenant[] = [];
      const orphanUsers: UserWithTenant[] = [];

      for (const u of rawList) {
        if (u.role === 'superadmin') {
          validUsers.push(u);
          continue;
        }
        if (hasValidTenantLink(u, validIds, validSlugs)) {
          validUsers.push(u);
        } else {
          orphanUsers.push(u);
        }
      }

      // Remove orphan users without tenant from backend asynchronously
      if (orphanUsers.length > 0) {
        (async () => {
          for (const orphan of orphanUsers) {
            try {
              await supabase.functions.invoke('manage-users', {
                body: { action: 'delete', user_id: orphan.id },
              });
            } catch {
              // Ignore individual cleanup errors
            }
          }
        })();
      }

      // Sort by role priority then name
      return validUsers.sort((a, b) => {
        const rA = roleOrder[a.role] ?? 99;
        const rB = roleOrder[b.role] ?? 99;
        if (rA !== rB) return rA - rB;
        return (a.name || '').localeCompare(b.name || '', 'pt-BR');
      });
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch tenants list
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      const allTenants = tenantsData || [];
      setTenants(allTenants);

      // 2. Try Edge Function `manage-users` (service_role: lists all auth users + metadata)
      let loadedFromEdge = false;
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('manage-users', {
          body: { action: 'list' }
        });
        if (!edgeErr && edgeData?.users && Array.isArray(edgeData.users) && edgeData.users.length > 0) {
          setUsers(sanitizeAndCleanOrphans(edgeData.users, allTenants));
          loadedFromEdge = true;
        }
      } catch (err) {
        // Fall through to database queries
      }

      if (loadedFromEdge) {
        setLoading(false);
        return;
      }

      // 3. Try RPC function `get_all_superadmin_users` if available
      try {
        const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_all_superadmin_users');
        if (!rpcErr && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const mapped: UserWithTenant[] = rpcData.map((r: any) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone || '',
            role: r.role || 'atendente',
            tenantId: r.tenant_id || '',
            tenantName: r.tenant_name || '—',
            tenantSlug: r.tenant_slug || '',
            createdAt: r.created_at,
          }));
          setUsers(sanitizeAndCleanOrphans(mapped, allTenants));
          setLoading(false);
          return;
        }
      } catch (err) {
        // Fall through to multi-table resolution
      }

      // 4. Multi-table resolution (tenant_members + user_roles + profiles + audit_logs)
      const [membersRes, rolesRes, profilesRes, auditRes] = await Promise.all([
        supabase.from('tenant_members').select('user_id, tenant_id, role, email, tenants(name, slug)'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('profiles').select('id, name, email, phone'),
        supabase.from('audit_logs')
          .select('user_id, user_name, details')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const members = (membersRes.data || []) as any[];
      const roles = rolesRes.data || [];
      const profiles = profilesRes.data || [];
      const auditLogs = auditRes.data || [];

      const userIds = new Set<string>();
      members.forEach(m => userIds.add(m.user_id));
      roles.forEach(r => userIds.add(r.user_id));
      profiles.forEach(p => userIds.add(p.id));

      const userList: UserWithTenant[] = [];

      userIds.forEach(uid => {
        const prof = profiles.find(p => p.id === uid);
        const member = members.find(m => m.user_id === uid);
        const userRole = roles.find(r => r.user_id === uid);
        const tenant = (member?.tenants as any) || allTenants.find(t => t.id === member?.tenant_id);

        const auditLog = auditLogs.find(a => a.user_id === uid);
        const details = (auditLog?.details as any) || {};

        const name = prof?.name
          || auditLog?.user_name
          || details?.owner_name
          || details?.admin_name
          || details?.name
          || (userRole?.role === 'admin' ? `Admin (${tenant?.name || 'Loja'})` : 'Usuário');

        const email = member?.email
          || prof?.email
          || details?.owner_email
          || details?.admin_email
          || details?.email
          || '';

        const phone = prof?.phone || details?.phone || '';
        const role = userRole?.role || member?.role || 'atendente';

        userList.push({
          id: uid,
          name,
          email,
          phone,
          role,
          tenantId: tenant ? (member?.tenant_id || tenant.id || '') : '',
          tenantName: tenant?.name || '—',
          tenantSlug: tenant?.slug || '',
        });
      });

      setUsers(sanitizeAndCleanOrphans(userList, allTenants));
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  }, [sanitizeAndCleanOrphans]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtered list
  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q
        || (u.name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.phone || '').includes(q)
        || (u.tenantName || '').toLowerCase().includes(q);

      const matchesTenant =
        filterTenant === 'all' ||
        u.tenantSlug === filterTenant ||
        (u.role === 'superadmin' && filterTenant === 'all');

      const matchesRole = filterRole === 'all' || u.role === filterRole;

      return matchesSearch && matchesTenant && matchesRole;
    });
  }, [users, search, filterTenant, filterRole]);

  // Separate Super Admins from Tenant Users
  const superAdminUsers = useMemo(
    () =>
      filtered
        .filter(u => u.role === 'superadmin' && (filterTenant === 'all' || u.tenantSlug === filterTenant))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
    [filtered, filterTenant]
  );

  const tenantUsers = useMemo(
    () => filtered.filter(u => u.role !== 'superadmin'),
    [filtered]
  );

  // Group tenant users by Tenant and by Role
  const tenantGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        tenantKey: string;
        tenantName: string;
        tenantSlug: string;
        users: UserWithTenant[];
        byRole: { role: string; label: string; users: UserWithTenant[] }[];
      }
    >();

    for (const u of tenantUsers) {
      const key = u.tenantSlug || u.tenantId || u.tenantName;
      if (!map.has(key)) {
        map.set(key, {
          tenantKey: key,
          tenantName: u.tenantName,
          tenantSlug: u.tenantSlug,
          users: [],
          byRole: [],
        });
      }
      map.get(key)!.users.push(u);
    }

    const groups = Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, 'pt-BR')
    );

    for (const g of groups) {
      g.users.sort((a, b) => {
        const rA = roleOrder[a.role] ?? 99;
        const rB = roleOrder[b.role] ?? 99;
        if (rA !== rB) return rA - rB;
        return (a.name || '').localeCompare(b.name || '', 'pt-BR');
      });

      const roleMap = new Map<string, UserWithTenant[]>();
      for (const u of g.users) {
        if (!roleMap.has(u.role)) roleMap.set(u.role, []);
        roleMap.get(u.role)!.push(u);
      }

      g.byRole = Array.from(roleMap.entries())
        .sort(([rA], [rB]) => (roleOrder[rA] ?? 99) - (roleOrder[rB] ?? 99))
        .map(([role, list]) => ({
          role,
          label: rolePluralLabels[role] || roleLabels[role] || role,
          users: list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
        }));
    }

    return groups;
  }, [tenantUsers]);

  // Group tenant users by Role first (when groupMode === 'role')
  const roleGroups = useMemo(() => {
    const roleMap = new Map<string, UserWithTenant[]>();
    for (const u of tenantUsers) {
      if (!roleMap.has(u.role)) roleMap.set(u.role, []);
      roleMap.get(u.role)!.push(u);
    }
    return Array.from(roleMap.entries())
      .sort(([rA], [rB]) => (roleOrder[rA] ?? 99) - (roleOrder[rB] ?? 99))
      .map(([role, list]) => ({
        role,
        label: rolePluralLabels[role] || roleLabels[role] || role,
        users: list.sort((a, b) => {
          const tCmp = (a.tenantName || '').localeCompare(b.tenantName || '', 'pt-BR');
          if (tCmp !== 0) return tCmp;
          return (a.name || '').localeCompare(b.name || '', 'pt-BR');
        }),
      }));
  }, [tenantUsers]);

  // Reset password handler
  const handleOpenReset = (u: UserWithTenant) => {
    setResetModal(u);
    const pass = generateRandomPassword(10);
    setNewPassword(pass);
    setShowPassword(true);
    setCopiedPass(false);
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopiedPass(true);
    toast.success('Senha copiada para a área de transferência!');
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setResetting(true);
    try {
      let resetOk = false;

      try {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset_password', user_id: resetModal.id, new_password: newPassword },
        });
        if (!error && !data?.error) {
          resetOk = true;
        }
      } catch (e) {
        // Fall through
      }

      if (!resetOk) {
        const { data, error } = await supabase.functions.invoke('reset-user-password', {
          body: { user_id: resetModal.id, new_password: newPassword },
        });
        if (error || data?.error) {
          throw error || new Error(data?.error || 'Falha ao redefinir senha');
        }
        resetOk = true;
      }

      try {
        await supabase.rpc('log_audit_event' as any, {
          p_action: 'user.password_reset',
          p_entity_type: 'user',
          p_entity_id: resetModal.id,
          p_details: {
            user_name: resetModal.name,
            user_email: resetModal.email,
            tenant_name: resetModal.tenantName,
          } as any,
        });
      } catch {}

      toast.success(`Senha de ${resetModal.name} redefinida com sucesso!`);
      setResetModal(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha');
    } finally {
      setResetting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: deleteTarget.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário excluído com sucesso');
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setFormMode('create');
    setFormInitial(undefined);
    setFormOpen(true);
  };

  const openEdit = (u: UserWithTenant) => {
    setFormMode('edit');
    setFormInitial({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      tenant_id: u.tenantId,
    });
    setFormOpen(true);
  };

  // Metric counts
  const superAdminTotal = users.filter(u => u.role === 'superadmin').length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const atendenteCount = users.filter(u => u.role === 'atendente' || u.role === 'motoboy').length;
  const storeUsersCount = users.filter(u => u.role !== 'superadmin').length;

  const renderUserRow = (u: UserWithTenant, showTenantCol = true) => (
    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
      <td className="py-3 pl-4 pr-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
            {(u.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground leading-tight">{u.name}</p>
            <p className="text-xs text-muted-foreground font-mono">ID: {u.id.slice(0, 8)}…</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">
            {u.email || <span className="text-muted-foreground italic">Sem email</span>}
          </span>
          {u.email && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(u.email);
                toast.success('Email copiado!');
              }}
              className="text-muted-foreground hover:text-foreground"
              title="Copiar email"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-muted-foreground">{u.phone || '—'}</td>
      <td className="py-3 pr-4">
        <Badge variant={roleBadgeVariant[u.role] || 'secondary'}>
          {roleLabels[u.role] || u.role}
        </Badge>
      </td>
      {showTenantCol && (
        <td className="py-3 pr-4">
          <Badge variant="outline" className="font-medium">
            {u.tenantName && u.tenantName !== '—' ? u.tenantName : 'Sistema Global'}
          </Badge>
        </td>
      )}
      <td className="py-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                onClick={() => handleOpenReset(u)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Reset Senha</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redefinir senha de acesso deste usuário</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar dados do usuário</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(u)}
                disabled={u.role === 'superadmin'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {u.role === 'superadmin' ? 'Superadmin não pode ser excluído' : 'Excluir usuário'}
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Top summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Super Admins</p>
            <p className="text-xl font-bold text-foreground">{loading ? '…' : superAdminTotal}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Usuários de Lojas</p>
            <p className="text-xl font-bold text-foreground">{loading ? '…' : storeUsersCount}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Administradores</p>
            <p className="text-xl font-bold text-foreground">{loading ? '…' : adminCount}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Atendentes / Equipe</p>
            <p className="text-xl font-bold text-foreground">{loading ? '…' : atendenteCount}</p>
          </div>
        </Card>
      </div>

      {/* Filters & Toolbar Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Usuários de Todos os Tenants
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerencie contas de acesso agrupadas por estabelecimento e função (usuários sem vínculo são removidos automaticamente).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={fetchUsers} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={openCreate} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Usuário
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar novo usuário em qualquer tenant</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou loja..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Estabelecimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estabelecimentos ({tenants.length})</SelectItem>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="atendente">Atendente</SelectItem>
                <SelectItem value="motoboy">Motoboy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grouping Mode Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Visualização de Agrupamento:</span>
            </div>
            <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setGroupMode('tenant_and_role')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  groupMode === 'tenant_and_role'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Por Tenant e Função
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('tenant')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  groupMode === 'tenant'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Por Tenant
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('role')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  groupMode === 'role'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Por Função
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. SEPARATED SUPER ADMIN SECTION */}
          {superAdminUsers.length > 0 && (
            <Card className="border-destructive/30 shadow-xs overflow-hidden">
              <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-destructive text-destructive-foreground">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Super Administradores do Sistema
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {superAdminUsers.length}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Contas com permissão administrativa global (separadas das equipes dos estabelecimentos)
                    </p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2.5 pl-4 pr-4">Nome / Usuário</th>
                      <th className="py-2.5 pr-4">Email de Acesso</th>
                      <th className="py-2.5 pr-4">Telefone</th>
                      <th className="py-2.5 pr-4">Função</th>
                      <th className="py-2.5 pr-4">Vínculo Principal</th>
                      <th className="py-2.5 pr-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {superAdminUsers.map(u => renderUserRow(u, true))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 2. TENANT USERS GROUPED BY TENANT & ROLE */}
          {filterRole !== 'superadmin' && (
            <>
              {groupMode === 'role' ? (
                /* Grouped by Role at top level */
                <div className="space-y-4">
                  {roleGroups.map(rg => (
                    <Card key={rg.role} className="overflow-hidden">
                      <div className="bg-muted/40 border-b px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={roleBadgeVariant[rg.role] || 'secondary'}>
                            {rg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-medium">
                            {rg.users.length} {rg.users.length === 1 ? 'usuário' : 'usuários'}
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/15 text-left text-muted-foreground text-xs uppercase tracking-wider">
                              <th className="py-2.5 pl-4 pr-4">Nome / Usuário</th>
                              <th className="py-2.5 pr-4">Email de Acesso</th>
                              <th className="py-2.5 pr-4">Telefone</th>
                              <th className="py-2.5 pr-4">Função</th>
                              <th className="py-2.5 pr-4">Estabelecimento</th>
                              <th className="py-2.5 pr-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rg.users.map(u => renderUserRow(u, true))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                /* Grouped by Tenant (with Role subgroups when groupMode === 'tenant_and_role') */
                <div className="space-y-4">
                  {tenantGroups.map(tg => (
                    <Card key={tg.tenantKey} className="overflow-hidden border-border">
                      {/* Tenant Header */}
                      <div className="bg-muted/40 border-b px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-foreground">{tg.tenantName}</h3>
                              {tg.tenantSlug && (
                                <span className="text-xs font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
                                  /{tg.tenantSlug}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tg.byRole.map(r => (
                            <Badge
                              key={r.role}
                              variant={roleBadgeVariant[r.role] || 'secondary'}
                              className="text-[10px]"
                            >
                              {r.label}: {r.users.length}
                            </Badge>
                          ))}
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            Total: {tg.users.length}
                          </Badge>
                        </div>
                      </div>

                      {groupMode === 'tenant_and_role' ? (
                        <div className="divide-y divide-border">
                          {tg.byRole.map(roleGroup => (
                            <div key={roleGroup.role}>
                              <div className="bg-muted/15 px-4 py-1.5 flex items-center justify-between border-b border-border/50">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={roleBadgeVariant[roleGroup.role] || 'secondary'}
                                    className="text-[10px] px-2 py-0"
                                  >
                                    {roleGroup.label}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">
                                    {roleGroup.users.length}{' '}
                                    {roleGroup.users.length === 1 ? 'membro' : 'membros'}
                                  </span>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b text-left text-muted-foreground text-[11px] uppercase tracking-wider">
                                      <th className="py-2 pl-4 pr-4">Nome / Usuário</th>
                                      <th className="py-2 pr-4">Email de Acesso</th>
                                      <th className="py-2 pr-4">Telefone</th>
                                      <th className="py-2 pr-4">Função</th>
                                      <th className="py-2 pr-4 text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {roleGroup.users.map(u => renderUserRow(u, false))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/15 text-left text-muted-foreground text-xs uppercase tracking-wider">
                                <th className="py-2.5 pl-4 pr-4">Nome / Usuário</th>
                                <th className="py-2.5 pr-4">Email de Acesso</th>
                                <th className="py-2.5 pr-4">Telefone</th>
                                <th className="py-2.5 pr-4">Função</th>
                                <th className="py-2.5 pr-4 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tg.users.map(u => renderUserRow(u, false))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {superAdminUsers.length === 0 && tenantUsers.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="font-medium">Nenhum usuário encontrado</p>
              <p className="text-xs mt-1">Verifique os filtros selecionados ou crie um novo usuário.</p>
            </Card>
          )}
        </div>
      )}

      {/* Password Reset Modal */}
      <Dialog open={!!resetModal} onOpenChange={(open) => { if (!open) { setResetModal(null); setNewPassword(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Redefinir Senha de Acesso
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha de acesso para o usuário selecionado. O usuário poderá fazer login imediatamente com a nova credencial.
            </DialogDescription>
          </DialogHeader>

          {resetModal && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuário / Nome:</span>
                  <span className="font-semibold text-foreground">{resetModal.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email de login:</span>
                  <span className="font-mono text-foreground">{resetModal.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estabelecimento:</span>
                  <span className="font-medium text-foreground">{resetModal.tenantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Função:</span>
                  <Badge variant={roleBadgeVariant[resetModal.role] || 'secondary'} className="text-[10px] px-1.5 py-0">
                    {roleLabels[resetModal.role] || resetModal.role}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-pass">Nova Senha</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2"
                    onClick={() => setNewPassword(generateRandomPassword(10))}
                  >
                    Gerar outra senha
                  </Button>
                </div>

                <div className="relative">
                  <Input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-20 font-mono"
                    autoFocus
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setShowPassword(p => !p)}
                      title={showPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={handleCopyPassword}
                      title="Copiar senha"
                    >
                      {copiedPass ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dica: Você pode copiar a senha gerada acima e enviá-la ao usuário.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetModal(null)} disabled={resetting}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || !newPassword || newPassword.length < 6}>
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" /> Redefinir Senha
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) do estabelecimento <strong>{deleteTarget?.tenantName}</strong>?
              Esta ação removerá todos os vínculos de acesso e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir Usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / Edit User Modal */}
      <UserFormModal
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        tenants={tenants}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          fetchUsers();
          toast.success(formMode === 'create' ? 'Usuário criado com sucesso!' : 'Usuário atualizado!');
        }}
      />
    </div>
  );
}
