import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, KeyRound, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserFormModal, type UserFormValue } from '@/components/UserFormModal';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
  superadmin: 'Super Admin',
};

interface UserWithTenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export function SuperAdminUsersTab() {
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('all');
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [resetModal, setResetModal] = useState<UserWithTenant | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<UserFormValue | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<UserWithTenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [profilesRes, rolesRes, membersRes, tenantsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, phone'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('tenant_members').select('user_id, tenant_id, tenants(name, slug)'),
      supabase.from('tenants').select('id, name, slug').order('name'),
    ]);

    setTenants(tenantsRes.data || []);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const members = membersRes.data || [];

    const userList: UserWithTenant[] = profiles.map(p => {
      const userRole = roles.find(r => r.user_id === p.id);
      const member = members.find(m => m.user_id === p.id);
      const tenant = member?.tenants as any;
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone || '',
        role: userRole?.role || 'atendente',
        tenantId: member?.tenant_id || '',
        tenantName: tenant?.name || '—',
        tenantSlug: tenant?.slug || '',
      };
    });

    setUsers(userList);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesTenant = filterTenant === 'all' || u.tenantSlug === filterTenant;
    return matchesSearch && matchesTenant;
  });

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'reset_password', user_id: resetModal.id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Senha de ${resetModal.name} redefinida!`);
      setResetModal(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: deleteTarget.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário excluído');
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
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      role: u.role, tenant_id: u.tenantId,
    });
    setFormOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Usuários por Tenant
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo usuário
              </Button>
            </TooltipTrigger>
            <TooltipContent>Criar usuário em qualquer tenant</TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.slug}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Telefone</th>
                    <th className="py-2 pr-4">Função</th>
                    <th className="py-2 pr-4">Tenant</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">{u.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{u.phone || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.role === 'admin' || u.role === 'superadmin' ? 'default' : 'secondary'}>
                          {roleLabels[u.role] || u.role}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="font-mono text-xs">{u.tenantName}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar usuário</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setResetModal(u)}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Redefinir senha</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} disabled={u.role === 'superadmin'}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir usuário</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetModal} onOpenChange={() => { setResetModal(null); setNewPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Usuário: <strong>{resetModal?.name}</strong> ({resetModal?.email})
          </p>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <Button onClick={handleResetPassword} disabled={resetting} className="w-full">
            {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redefinindo...</> : 'Redefinir Senha'}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) e todos os seus vínculos. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserFormModal
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        tenants={tenants}
        onClose={() => setFormOpen(false)}
        onSaved={() => { fetchUsers(); toast.success(formMode === 'create' ? 'Usuário criado!' : 'Usuário atualizado!'); }}
      />
    </>
  );
}
