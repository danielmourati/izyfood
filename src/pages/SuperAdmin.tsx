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
  LayoutDashboard, Building2, Plus, Store, Users, DollarSign, TrendingUp, Loader2, Pencil, Check, X
} from 'lucide-react';
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

type Tab = 'dashboard' | 'tenants' | 'usuarios' | 'criar';

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'usuarios', label: 'Usuários', icon: Users },
  { key: 'criar', label: 'Novo Tenant', icon: Plus },
];

interface Tenant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
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
function TenantsTab({ tenants, onToggle, onSlugUpdated }: { tenants: Tenant[]; onToggle: (id: string, active: boolean) => void; onSlugUpdated: () => void }) {
  const [editing, setEditing] = useState<Tenant | null>(null);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todos os Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum tenant encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Criado em</th>
                    <th className="py-2">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">{t.slug}</Badge>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(t)} aria-label="Editar slug">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={t.active ? 'default' : 'destructive'}>
                          {t.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3">
                        <Switch checked={t.active} onCheckedChange={(v) => onToggle(t.id, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditSlugDialog tenant={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSlugUpdated(); }} />
    </>
  );
}

/* ─────────── Edit Slug Dialog ─────────── */
function EditSlugDialog({ tenant, onClose, onSaved }: { tenant: Tenant | null; onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) { setSlug(tenant.slug); setAvailable(null); setServerError(null); }
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

  const canSave = !!tenant && !formatError && slug !== tenant.slug && available === true && !saving;

  const handleSave = async () => {
    if (!tenant || !canSave) return;
    setSaving(true);
    setServerError(null);
    const oldSlug = tenant.slug;
    const { error } = await supabase.from('tenants').update({ slug }).eq('id', tenant.id);
    if (error) {
      setServerError(error.message);
      setSaving(false);
      return;
    }
    await supabase.rpc('log_audit_event' as any, {
      p_action: 'tenant.slug_updated',
      p_entity_type: 'tenant',
      p_entity_id: tenant.id,
      p_details: { old_slug: oldSlug, new_slug: slug } as any,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar slug do tenant</DialogTitle>
          <DialogDescription>
            URLs antigas com o slug anterior <b>deixarão de funcionar</b>. Usuários logados podem precisar entrar novamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Novo slug</Label>
          <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} className="font-mono" autoFocus />
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
          <p className="text-xs text-muted-foreground">Nova URL: /{slug || '…'}/pdv</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</> : 'Salvar'}
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
      toast.error('Preencha todos os campos');
      return;
    }
    if (slugError) { toast.error(slugError); return; }
    if (available === false) { toast.error('Este slug já está em uso'); return; }
    if (form.admin_password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tenant', {
        body: form,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Tenant "${data.tenant.name}" criado com slug "${data.tenant.slug}"!`);
      setForm({ name: '', slug: '', admin_name: '', admin_email: '', admin_password: '' });
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar tenant');
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = !creating && !slugError && available !== false && !checking;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Criar Novo Estabelecimento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Estabelecimento</Label>
            <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Ex: Açaíteria do Centro" />
          </div>
          <div className="space-y-2">
            <Label>Slug (URL)</Label>
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} placeholder="acaiteria-do-centro" className="font-mono" />
            <div className="min-h-[1.25rem] text-xs">
              {slugError && <span className="text-destructive">{slugError}</span>}
              {!slugError && form.slug && (
                checking ? <span className="text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> verificando…</span>
                : available === true ? <span className="text-success inline-flex items-center gap-1"><Check className="h-3 w-3" /> disponível</span>
                : available === false ? <span className="text-destructive inline-flex items-center gap-1"><X className="h-3 w-3" /> já em uso</span>
                : null
              )}
            </div>
            <p className="text-xs text-muted-foreground">Será usado na URL: /{form.slug || 'slug'}/pdv</p>
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-semibold text-foreground mb-3">Administrador do Tenant</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@loja.com" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : <><Plus className="h-4 w-4 mr-2" /> Criar Estabelecimento</>}
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
      const [tenantsRes, membersRes, salesRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at'),
        supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
        supabase.from('sales').select('total'),
      ]);

      const allTenants = (tenantsRes.data || []) as Tenant[];
      setTenants(allTenants);

      const totalRevenue = (salesRes.data || []).reduce((sum, s) => sum + Number(s.total), 0);

      setMetrics({
        totalTenants: allTenants.filter(t => t.active).length,
        totalUsers: membersRes.count || 0,
        totalSales: (salesRes.data || []).length,
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
      toast.error('Erro ao atualizar tenant');
      return;
    }
    toast.success(active ? 'Tenant ativado' : 'Tenant desativado');
    fetchData();
  };

  return (
    <div className="space-y-4">
      {withHeader && <h1 className="text-2xl font-bold text-foreground">Painel Super Admin</h1>}

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
      {activeTab === 'tenants' && <TenantsTab tenants={tenants} onToggle={handleToggleTenant} onSlugUpdated={fetchData} />}
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
