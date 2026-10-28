import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  LayoutDashboard, Building2, Plus, Store, Users, DollarSign, TrendingUp,
  Loader2, Pencil, Check, X, Trash2, KeyRound, Eye, EyeOff, Copy,
  ExternalLink, ShieldCheck, CreditCard, Sparkles, Search, UserCheck
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SuperAdminUsersTab } from '@/components/SuperAdminUsersTab';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['login', 'superadmin', 'admin', 'api', 'auth', 'loja-padrao', 'pdv', 'home']);

function validateSlugFormat(slug: string): string | null {
  if (!slug) return 'Informe um slug';
  if (slug.length < 3 || slug.length > 40) return 'Slug deve ter entre 3 e 40 caracteres';
  if (!SLUG_RE.test(slug)) return 'Use apenas letras minúsculas, números e hífens (sem hífens no início/fim)';
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" é reservado. Escolha outro.`;
  return null;
}

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

type Tab = 'dashboard' | 'tenants' | 'usuarios' | 'criar';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'usuarios', label: 'Usuários', icon: Users },
  { key: 'criar', label: 'Novo Tenant', icon: Plus },
];

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  logo: string | null;
  login_icon: string | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerUserId?: string;
  initialPassword?: string;
  planName?: string;
  planStatus?: string;
  planEnd?: string | null;
}

interface Metrics {
  totalTenants: number;
  totalUsers: number;
  totalSales: number;
  totalRevenue: number;
}

/* ─────────── Dashboard Tab ─────────── */
function DashboardTab({ metrics, loading }: { metrics: Metrics; loading: boolean }) {
  const cards = [
    { label: 'Tenants Ativos', value: metrics.totalTenants, icon: Store, color: 'text-accent' },
    { label: 'Usuários', value: metrics.totalUsers, icon: Users, color: 'text-success' },
    { label: 'Vendas Totais', value: metrics.totalSales, icon: TrendingUp, color: 'text-warning-foreground' },
    {
      label: 'Receita Total',
      value: `R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-muted ${c.color}`}>
              <c.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground">
                {loading ? '…' : c.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─────────── Tenants Tab ─────────── */
function TenantsTab({
  tenants,
  onToggle,
  onUpdated,
  onDeleted
}: {
  tenants: Tenant[];
  onToggle: (id: string, active: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState<Tenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');

  // Quick reset password modal from tenant list
  const [quickResetTenant, setQuickResetTenant] = useState<Tenant | null>(null);
  const [quickPassword, setQuickPassword] = useState('');
  const [showQuickPass, setShowQuickPass] = useState(false);
  const [copiedQuickPass, setCopiedQuickPass] = useState(false);
  const [resettingQuick, setResettingQuick] = useState(false);

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete_tenant', tenant_id: deleting.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Tenant excluído com sucesso');
      onDeleted();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir tenant');
    } finally {
      setIsDeleting(false);
      setDeleting(null);
    }
  };

  const handleOpenQuickReset = (t: Tenant) => {
    setQuickResetTenant(t);
    setQuickPassword(generateRandomPassword(10));
    setShowQuickPass(true);
    setCopiedQuickPass(false);
  };

  const handleExecuteQuickReset = async () => {
    if (!quickResetTenant) return;
    if (!quickPassword || quickPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setResettingQuick(true);
    try {
      let targetUserId = quickResetTenant.ownerUserId;

      // If user ID was not preloaded, fetch admin of this tenant
      if (!targetUserId) {
        const { data: mem } = await supabase
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', quickResetTenant.id)
          .eq('role', 'admin')
          .maybeSingle();
        targetUserId = mem?.user_id;
      }

      if (!targetUserId) {
        throw new Error('Nenhum usuário administrador encontrado para este estabelecimento.');
      }

      // Invoke password reset
      let resetOk = false;
      try {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset_password', user_id: targetUserId, new_password: quickPassword },
        });
        if (!error && !data?.error) resetOk = true;
      } catch {}

      if (!resetOk) {
        const { data, error } = await supabase.functions.invoke('reset-user-password', {
          body: { user_id: targetUserId, new_password: quickPassword },
        });
        if (error || data?.error) throw error || new Error(data?.error || 'Erro ao redefinir');
      }

      // Audit password reset
      try {
        await supabase.rpc('log_audit_event' as any, {
          p_action: 'tenant.owner_password_reset',
          p_entity_type: 'tenant',
          p_entity_id: quickResetTenant.id,
          p_details: {
            tenant_name: quickResetTenant.name,
            owner_email: quickResetTenant.ownerEmail,
            new_password_set: quickPassword,
          } as any,
        });
      } catch {}

      toast.success(`Senha do administrador de "${quickResetTenant.name}" redefinida!`);
      setQuickResetTenant(null);
      setQuickPassword('');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha do administrador');
    } finally {
      setResettingQuick(false);
    }
  };

  // Filtered tenants
  const filtered = tenants.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.name || '').toLowerCase().includes(q)
      || (t.slug || '').toLowerCase().includes(q)
      || (t.ownerName || '').toLowerCase().includes(q)
      || (t.ownerEmail || '').toLowerCase().includes(q);
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Todos os Estabelecimentos (Tenants)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visualize dados completos da loja, proprietário, credenciais e execute resets de senha.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por loja, slug ou proprietário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm font-medium">Nenhum estabelecimento encontrado.</p>
              <p className="text-xs mt-1">Verifique o termo buscado ou crie um novo tenant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2.5 pr-4">Estabelecimento</th>
                    <th className="py-2.5 pr-4">Proprietário / Acesso</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Criado em</th>
                    <th className="py-2.5 pr-4">Ativo</th>
                    <th className="py-2.5 text-right">Ações SuperAdmin</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      {/* Store name & slug */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {t.logo ? (
                            <img src={t.logo} alt={t.name} className="h-9 w-9 rounded-lg object-contain border bg-background shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground leading-tight">{t.name}</p>
                            <a
                              href={`/${t.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline font-mono inline-flex items-center gap-1 mt-0.5"
                            >
                              /{t.slug} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Owner / Admin */}
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-foreground text-xs">
                            {t.ownerName && t.ownerName !== '—' ? t.ownerName : (
                              <span className="text-muted-foreground italic">Admin Cadastrado</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">
                              {t.ownerEmail && t.ownerEmail !== '—' ? t.ownerEmail : '—'}
                            </span>
                            {t.ownerEmail && t.ownerEmail !== '—' && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(t.ownerEmail!);
                                  toast.success('Email copiado!');
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copiar email de acesso"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Store active badge */}
                      <td className="py-3 pr-4">
                        <Badge variant={t.active ? 'default' : 'destructive'} className="text-xs">
                          {t.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>

                      {/* Created at */}
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Active toggle */}
                      <td className="py-3 pr-4">
                        <Switch checked={t.active} onCheckedChange={(v) => onToggle(t.id, v)} />
                      </td>

                      {/* Actions */}
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => setEditing(t)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Ver / Editar</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver todos os dados informados (loja, dono, senha) e editar</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                onClick={() => handleOpenQuickReset(t)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Resetar senha do administrador deste tenant</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleting(t)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir estabelecimento</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comprehensive Edit / View Tenant Dialog */}
      <EditTenantDialog
        tenant={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onUpdated(); }}
      />

      {/* Quick Password Reset Dialog */}
      <Dialog open={!!quickResetTenant} onOpenChange={(o) => { if (!o) { setQuickResetTenant(null); setQuickPassword(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Redefinir Senha do Proprietário
            </DialogTitle>
            <DialogDescription>
              Estabelecimento: <strong>{quickResetTenant?.name}</strong> (/{quickResetTenant?.slug})
            </DialogDescription>
          </DialogHeader>

          {quickResetTenant && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proprietário:</span>
                  <span className="font-semibold text-foreground">{quickResetTenant.ownerName || 'Administrador'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail / Usuário:</span>
                  <span className="font-mono text-foreground">{quickResetTenant.ownerEmail || '—'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quick-pass">Nova Senha</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2"
                    onClick={() => setQuickPassword(generateRandomPassword(10))}
                  >
                    Gerar outra senha
                  </Button>
                </div>

                <div className="relative">
                  <Input
                    id="quick-pass"
                    type={showQuickPass ? 'text' : 'password'}
                    value={quickPassword}
                    onChange={e => setQuickPassword(e.target.value)}
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
                      onClick={() => setShowQuickPass(p => !p)}
                      title={showQuickPass ? 'Ocultar' : 'Mostrar'}
                    >
                      {showQuickPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(quickPassword);
                        setCopiedQuickPass(true);
                        toast.success('Senha copiada!');
                        setTimeout(() => setCopiedQuickPass(false), 2000);
                      }}
                      title="Copiar senha"
                    >
                      {copiedQuickPass ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Você pode copiar essa senha e enviá-la diretamente para o proprietário.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickResetTenant(null)} disabled={resettingQuick}>
              Cancelar
            </Button>
            <Button onClick={handleExecuteQuickReset} disabled={resettingQuick || !quickPassword || quickPassword.length < 6}>
              {resettingQuick ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tenant Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Estabelecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o tenant <strong>{deleting?.name}</strong>?
              Esta ação removerá o tenant e todos os dados associados (usuários, produtos, vendas). Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir Estabelecimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─────────── Comprehensive Edit & View Tenant Dialog ─────────── */
function EditTenantDialog({
  tenant,
  onClose,
  onSaved
}: {
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Store fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [loginIcon, setLoginIcon] = useState('');

  // Owner fields
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');

  // Password reset inside modal
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showInitialPass, setShowInitialPass] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Validation & status
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setSlug(tenant.slug || '');
      setLogo(tenant.logo || '');
      setLoginIcon(tenant.login_icon || '');
      setOwnerName(tenant.ownerName && tenant.ownerName !== '—' ? tenant.ownerName : '');
      setOwnerEmail(tenant.ownerEmail && tenant.ownerEmail !== '—' ? tenant.ownerEmail : '');
      setOwnerPhone(tenant.ownerPhone || '');
      setOwnerUserId(tenant.ownerUserId || '');
      setInitialPassword(tenant.initialPassword || '');
      setNewPassword('');
      setAvailable(null);
      setServerError(null);

      // Async fetch owner details and initial password if not loaded yet
      (async () => {
        try {
          // Check audit log for initial creation details
          const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('details')
            .eq('entity_type', 'tenant')
            .eq('entity_id', tenant.id)
            .limit(10);

          let foundPass = '';
          let foundName = '';
          let foundEmail = '';

          (auditLogs || []).forEach((a: any) => {
            const d = a.details || {};
            if (d.initial_password && !foundPass) foundPass = d.initial_password;
            if (d.new_password_set && !foundPass) foundPass = d.new_password_set;
            if (d.owner_name && !foundName) foundName = d.owner_name;
            if (d.admin_name && !foundName) foundName = d.admin_name;
            if (d.owner_email && !foundEmail) foundEmail = d.owner_email;
            if (d.admin_email && !foundEmail) foundEmail = d.admin_email;
          });

          if (foundPass) setInitialPassword(foundPass);
          if (foundName && !tenant.ownerName) setOwnerName(foundName);
          if (foundEmail && !tenant.ownerEmail) setOwnerEmail(foundEmail);

          // Find admin user ID if not present
          if (!tenant.ownerUserId) {
            const { data: member } = await supabase
              .from('tenant_members')
              .select('user_id')
              .eq('tenant_id', tenant.id)
              .eq('role', 'admin')
              .maybeSingle();

            if (member?.user_id) {
              setOwnerUserId(member.user_id);
              // fetch profile
              const { data: prof } = await supabase
                .from('profiles')
                .select('name, email, phone')
                .eq('id', member.user_id)
                .maybeSingle();

              if (prof?.name && !tenant.ownerName) setOwnerName(prof.name);
              if (prof?.email && !tenant.ownerEmail) setOwnerEmail(prof.email);
              if (prof?.phone && !tenant.ownerPhone) setOwnerPhone(prof.phone);
            }
          }
        } catch (e) {
          console.warn('Erro ao carregar dados adicionais do tenant:', e);
        }
      })();
    }
  }, [tenant]);

  const formatError = validateSlugFormat(slug);

  useEffect(() => {
    if (!tenant) return;
    if (slug === tenant.slug) { setAvailable(null); return; }
    if (formatError) { setAvailable(null); return; }
    setChecking(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase.from('tenants').select('id').eq('slug', slug).neq('id', tenant.id).maybeSingle();
      setAvailable(!data);
      setChecking(false);
    }, 400);
    return () => { clearTimeout(handle); setChecking(false); };
  }, [slug, tenant, formatError]);

  const hasStoreChanges = !!tenant && (
    name !== tenant.name ||
    slug !== tenant.slug ||
    logo !== (tenant.logo || '') ||
    loginIcon !== (tenant.login_icon || '')
  );

  const hasOwnerChanges = !!tenant && (
    ownerName !== (tenant.ownerName || '') ||
    ownerEmail !== (tenant.ownerEmail || '') ||
    ownerPhone !== (tenant.ownerPhone || '')
  );

  const canSave = !!tenant && !formatError && (available === true || slug === tenant.slug) && (hasStoreChanges || hasOwnerChanges) && !saving;

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setServerError(null);

    try {
      const oldSlug = tenant.slug;

      // 1. Update tenant table
      if (hasStoreChanges) {
        const { error } = await supabase.from('tenants').update({
          name,
          slug,
          logo: logo || null,
          login_icon: loginIcon || null,
        }).eq('id', tenant.id);

        if (error) throw error;

        if (slug !== oldSlug) {
          await supabase.rpc('log_audit_event' as any, {
            p_action: 'tenant.slug_updated',
            p_entity_type: 'tenant',
            p_entity_id: tenant.id,
            p_details: { old_slug: oldSlug, new_slug: slug } as any,
          });
        }
      }

      // 2. Update owner profile / user if changed and user_id is known
      if (hasOwnerChanges && ownerUserId) {
        try {
          await supabase.functions.invoke('manage-users', {
            body: {
              action: 'update',
              user_id: ownerUserId,
              name: ownerName,
              email: ownerEmail,
              phone: ownerPhone || null,
            }
          });
        } catch (e) {
          // Direct fallback update
          await supabase.from('profiles').update({
            name: ownerName,
            email: ownerEmail,
            phone: ownerPhone || '',
          } as any).eq('id', ownerUserId);
        }
      }

      toast.success('Dados do estabelecimento e proprietário salvos com sucesso!');
      onSaved();
    } catch (err: any) {
      setServerError(err.message || 'Erro ao salvar alterações');
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPasswordInModal = async () => {
    if (!tenant) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Informe uma senha com no mínimo 6 caracteres');
      return;
    }
    setResettingPassword(true);
    try {
      let uid = ownerUserId;
      if (!uid) {
        const { data: member } = await supabase
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', tenant.id)
          .eq('role', 'admin')
          .maybeSingle();
        uid = member?.user_id;
      }

      if (!uid) {
        throw new Error('Nenhum usuário administrador encontrado para redefinir senha.');
      }

      let resetOk = false;
      try {
        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset_password', user_id: uid, new_password: newPassword },
        });
        if (!error && !data?.error) resetOk = true;
      } catch {}

      if (!resetOk) {
        const { data, error } = await supabase.functions.invoke('reset-user-password', {
          body: { user_id: uid, new_password: newPassword },
        });
        if (error || data?.error) throw error || new Error(data?.error || 'Erro ao redefinir senha');
      }

      // Log audit
      await supabase.rpc('log_audit_event' as any, {
        p_action: 'tenant.owner_password_reset',
        p_entity_type: 'tenant',
        p_entity_id: tenant.id,
        p_details: {
          tenant_name: tenant.name,
          owner_name: ownerName,
          owner_email: ownerEmail,
          new_password_set: newPassword,
        } as any,
      });

      setInitialPassword(newPassword);
      toast.success('Senha do proprietário redefinida com sucesso!');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" /> Visualizar & Editar Estabelecimento
            </DialogTitle>
          </div>
          <DialogDescription>
            Exibição completa de todos os dados informados no cadastro (loja, proprietário, credenciais de acesso e senha).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Header Summary Box */}
          <div className="p-3.5 rounded-xl bg-muted/60 border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Estabelecimento:</p>
              <p className="font-bold text-sm text-foreground">{tenant?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cadastrado em:</p>
              <p className="font-medium text-foreground">
                {tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status Atual:</p>
              <Badge variant={tenant?.active ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 mt-0.5">
                {tenant?.active ? 'Loja Ativa' : 'Loja Inativa'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Plano / Licença:</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 bg-primary/10 text-primary border-primary/30">
                {tenant?.planName || 'PRO'}
              </Badge>
            </div>
          </div>

          {/* Section 1: Dados da Loja */}
          <div className="p-4 rounded-xl border bg-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Dados do Estabelecimento (Loja)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-name">Nome do Estabelecimento</Label>
                <Input
                  id="tenant-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Pastelaria Central"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-slug">Slug (URL de Acesso)</Label>
                <Input
                  id="tenant-slug"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase())}
                  className="font-mono"
                  placeholder="pastelaria-central"
                />
                <div className="min-h-[1.25rem] text-xs">
                  {formatError && <span className="text-destructive">{formatError}</span>}
                  {!formatError && tenant && slug !== tenant.slug && (
                    checking ? <span className="text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> verificando…</span>
                    : available === true ? <span className="text-success inline-flex items-center gap-1"><Check className="h-3 w-3" /> disponível</span>
                    : available === false ? <span className="text-destructive inline-flex items-center gap-1"><X className="h-3 w-3" /> já em uso</span>
                    : null
                  )}
                  {serverError && <span className="text-destructive">{serverError}</span>}
                </div>
              </div>
            </div>

            {/* URL info with copy and open buttons */}
            <div className="p-2.5 rounded-lg bg-muted/40 border text-xs flex items-center justify-between gap-2">
              <span className="text-muted-foreground">URL da Loja: <strong className="font-mono text-foreground">/{slug || '…'}</strong></span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
                    toast.success('Link copiado!');
                  }}
                >
                  <Copy className="h-3 w-3" /> Copiar Link
                </Button>
                <a
                  href={`/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  Abrir Loja <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label>Logo (URL)</Label>
                <Input value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://..." />
                {logo && <img src={logo} alt="Logo" className="h-10 object-contain rounded border mt-1.5" />}
              </div>
              <div className="space-y-1.5">
                <Label>Ícone de Login (URL)</Label>
                <Input value={loginIcon} onChange={e => setLoginIcon(e.target.value)} placeholder="https://..." />
                {loginIcon && <img src={loginIcon} alt="Ícone de Login" className="h-10 object-contain rounded border mt-1.5" />}
              </div>
            </div>
          </div>

          {/* Section 2: Dados do Proprietário */}
          <div className="p-4 rounded-xl border bg-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Dados do Proprietário / Administrador
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Nome do Proprietário</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-email">E-mail / Usuário de Acesso</Label>
                <div className="relative">
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={e => setOwnerEmail(e.target.value)}
                    placeholder="email@loja.com"
                    className="pr-9"
                  />
                  {ownerEmail && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(ownerEmail);
                        toast.success('Email copiado!');
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title="Copiar email de login"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner-phone">Telefone / WhatsApp</Label>
                <Input
                  id="owner-phone"
                  value={ownerPhone}
                  onChange={e => setOwnerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Função no Sistema</Label>
                <Input value="Administrador da Loja (Proprietário)" disabled className="bg-muted text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Section 3: Credenciais & Gestão de Senha */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Credenciais de Acesso & Redefinição de Senha
              </h3>
              <Badge variant="outline" className="text-[10px] bg-background">
                SuperAdmin Control
              </Badge>
            </div>

            {/* Recorded Initial Password if available */}
            {initialPassword && (
              <div className="p-3 rounded-lg bg-background border space-y-1 text-xs">
                <span className="text-muted-foreground font-medium">Senha Registrada / Anotada no Cadastro:</span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {showInitialPass ? initialPassword : '••••••••••••'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => setShowInitialPass(p => !p)}
                      title={showInitialPass ? 'Ocultar' : 'Mostrar'}
                    >
                      {showInitialPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(initialPassword);
                        toast.success('Senha inicial copiada!');
                      }}
                      title="Copiar senha registrada"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Reset Password Form */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="modal-new-pass" className="text-xs font-semibold">
                  Definir / Redefinir Nova Senha do Proprietário:
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary px-2"
                  onClick={() => {
                    const pass = generateRandomPassword(10);
                    setNewPassword(pass);
                    setShowNewPass(true);
                  }}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Gerar Senha Forte
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="modal-new-pass"
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Digite nova senha (mínimo 6 caracteres)"
                    className="pr-20 font-mono text-sm bg-background"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setShowNewPass(p => !p)}
                      title={showNewPass ? 'Ocultar' : 'Mostrar'}
                    >
                      {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        if (!newPassword) return;
                        navigator.clipboard.writeText(newPassword);
                        setCopiedPass(true);
                        toast.success('Nova senha copiada!');
                        setTimeout(() => setCopiedPass(false), 2000);
                      }}
                      title="Copiar senha"
                    >
                      {copiedPass ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleResetPasswordInModal}
                  disabled={resettingPassword || !newPassword || newPassword.length < 6}
                  className="gap-1.5 shrink-0"
                >
                  {resettingPassword ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    <><KeyRound className="h-4 w-4" /> Salvar Senha</>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A nova senha entrará em vigor imediatamente para o usuário administrador deste estabelecimento.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando Alterações…</>
            ) : (
              'Salvar Dados'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Create Tab ─────────── */
function CreateTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', slug: '', admin_name: '', admin_email: '', admin_password: '',
  });
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const slugify = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, slug: slugify(name) }));
  };

  const slugError = form.slug ? validateSlugFormat(form.slug) : null;

  useEffect(() => {
    if (!form.slug || slugError) { setAvailable(null); return; }
    setChecking(true);
    const handle = setTimeout(async () => {
      const { data } = await supabase.from('tenants').select('id').eq('slug', form.slug).maybeSingle();
      setAvailable(!data);
      setChecking(false);
    }, 400);
    return () => { clearTimeout(handle); setChecking(false); };
  }, [form.slug, slugError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.admin_email || !form.admin_password || !form.admin_name) {
      setFeedback({ type: 'error', text: 'Preencha todos os campos obrigatórios' });
      return;
    }
    if (slugError) { setFeedback({ type: 'error', text: slugError }); return; }
    if (available === false) { setFeedback({ type: 'error', text: 'Este slug já está em uso' }); return; }
    if (form.admin_password.length < 6) {
      setFeedback({ type: 'error', text: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    setFeedback(null);
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: form,
      });
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      // Persist audit event with credentials so SuperAdmin can view all registered info later
      try {
        await supabase.rpc('log_audit_event' as any, {
          p_action: 'tenant.created',
          p_entity_type: 'tenant',
          p_entity_id: data.tenant?.id,
          p_details: {
            tenant_name: form.name,
            tenant_slug: form.slug,
            owner_name: form.admin_name,
            owner_email: form.admin_email,
            initial_password: form.admin_password,
          } as any,
        });
      } catch (e) {
        console.warn('Audit log warning:', e);
      }

      setFeedback({ type: 'ok', text: `Estabelecimento "${data.tenant.name}" criado com sucesso!` });
      setForm({ name: '', slug: '', admin_name: '', admin_email: '', admin_password: '' });
      setTimeout(onCreated, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao criar tenant' });
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = !creating && !slugError && available !== false && !checking;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" /> Criar Novo Estabelecimento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cadastre o estabelecimento e configure a conta de acesso inicial do proprietário.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Estabelecimento</Label>
            <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ex: Pizzaria Forno Nobre" />
          </div>
          <div className="space-y-2">
            <Label>Slug (URL)</Label>
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} placeholder="pizzaria-forno-nobre" className="font-mono" />
            <div className="min-h-[1.25rem] text-xs">
              {slugError && <span className="text-destructive">{slugError}</span>}
              {!slugError && form.slug && (
                checking ? <span className="text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> verificando…</span>
                : available === true ? <span className="text-success inline-flex items-center gap-1"><Check className="h-3 w-3" /> disponível</span>
                : available === false ? <span className="text-destructive inline-flex items-center gap-1"><X className="h-3 w-3" /> já em uso</span>
                : null
              )}
            </div>
            <p className="text-xs text-muted-foreground">Será usado na URL: /{form.slug || 'slug'}</p>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Conta do Proprietário / Administrador
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome Completo do Proprietário</Label>
                <Input value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} placeholder="Ex: Carlos Alberto da Silva" />
              </div>
              <div className="space-y-2">
                <Label>E-mail / Usuário de Acesso</Label>
                <Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="carlos@pizzaria.com" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Senha Inicial</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2"
                    onClick={() => setForm(f => ({ ...f, admin_password: generateRandomPassword(10) }))}
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> Gerar Senha
                  </Button>
                </div>
                <Input type="text" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} placeholder="Mínimo 6 caracteres" className="font-mono" />
              </div>
            </div>
          </div>

          {feedback && (
            <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${feedback.type === 'ok' ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
              {feedback.text}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando Estabelecimento...</> : <><Plus className="h-4 w-4 mr-2" /> Criar Estabelecimento</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─────────── Reusable Super Admin content ─────────── */
export function SuperAdminContent({ withHeader = true, initialTab = 'dashboard', hideTabs = false }: { withHeader?: boolean; initialTab?: Tab; hideTabs?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalTenants: 0, totalUsers: 0, totalSales: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenantsRes, membersRes, profilesRes, salesRes, plansRes, auditRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at'),
        supabase.from('tenant_members').select('user_id, tenant_id, role'),
        supabase.from('profiles').select('id, name, email, phone'),
        supabase.from('sales').select('total'),
        supabase.from('tenant_plans' as any).select('tenant_id, plan, status, current_period_end, trial_ends_at'),
        supabase.from('audit_logs')
          .select('entity_id, details')
          .eq('entity_type', 'tenant')
          .limit(100),
      ]);

      const rawTenants = (tenantsRes.data || []) as any[];
      const members = membersRes.data || [];
      const profiles = profilesRes.data || [];
      const sales = salesRes.data || [];
      const plans = (plansRes.data || []) as any[];
      const auditLogs = auditRes.data || [];

      // Link owner details and plans to each tenant
      const enrichedTenants: Tenant[] = rawTenants.map(t => {
        const adminMember = members.find(m => m.tenant_id === t.id && m.role === 'admin')
          || members.find(m => m.tenant_id === t.id);

        const prof = adminMember ? profiles.find(p => p.id === adminMember.user_id) : null;
        const tenantAudit = auditLogs.find(a => a.entity_id === t.id);
        const details = (tenantAudit?.details as any) || {};

        const plan = plans.find(p => p.tenant_id === t.id);

        const ownerName = prof?.name || details.owner_name || details.admin_name || '—';
        const ownerEmail = prof?.email || details.owner_email || details.admin_email || '—';
        const ownerPhone = prof?.phone || details.owner_phone || '';
        const initialPassword = details.initial_password || details.new_password_set || '';

        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          active: t.active,
          created_at: t.created_at,
          logo: t.logo,
          login_icon: t.login_icon,
          ownerName,
          ownerEmail,
          ownerPhone,
          ownerUserId: adminMember?.user_id,
          initialPassword,
          planName: plan?.plan ? (plan.plan === 'trial' ? 'Trial' : plan.plan === 'pro_yearly' ? 'PRO Anual' : 'PRO Mensal') : 'PRO',
          planStatus: plan?.status || 'active',
          planEnd: plan?.current_period_end || plan?.trial_ends_at || null,
        };
      });

      setTenants(enrichedTenants);

      const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);

      setMetrics({
        totalTenants: enrichedTenants.filter(t => t.active).length,
        totalUsers: members.length,
        totalSales: sales.length,
        totalRevenue,
      });
    } catch (err) {
      console.error('Error fetching superadmin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleTenant = async (id: string, active: boolean) => {
    const { error } = await supabase.from('tenants').update({ active }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status do estabelecimento');
      return;
    }
    toast.success(active ? 'Estabelecimento ativado' : 'Estabelecimento desativado');
    fetchData();
  };

  return (
    <div className="space-y-4">
      {withHeader && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Painel Super Admin</h1>
        </div>
      )}

      {!hideTabs && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant={activeTab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(t.key)}
              className="shrink-0"
            >
              <t.icon className="h-4 w-4 mr-1.5" />
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {activeTab === 'dashboard' && <DashboardTab metrics={metrics} loading={loading} />}
      {activeTab === 'tenants' && (
        <TenantsTab
          tenants={tenants}
          onToggle={handleToggleTenant}
          onUpdated={fetchData}
          onDeleted={fetchData}
        />
      )}
      {activeTab === 'usuarios' && <SuperAdminUsersTab />}
      {activeTab === 'criar' && <CreateTab onCreated={() => { setActiveTab('tenants'); fetchData(); }} />}
    </div>
  );
}

/* ─────────── Main Page ─────────── */
const SuperAdmin = () => (
  <div className="p-4 md:p-6">
    <SuperAdminContent />
  </div>
);

export default SuperAdmin;
