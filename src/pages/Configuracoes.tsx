import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/contexts/StoreContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { DiscountCoupon } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { fmt } from '@/lib/utils';
import {
  Settings, Users, Grid3X3, Ticket, Printer, Plus, Trash2, Edit2, Check, X, KeyRound, User, Loader2, FileText, Image, Upload
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MeuPerfilTab } from '@/components/MeuPerfilTab';
import { AuditLogsTab } from '@/components/AuditLogsTab';
import { ImpressoraTab } from '@/components/ImpressoraTab';

type Tab = 'perfil' | 'geral' | 'usuarios' | 'permissoes' | 'cupons' | 'impressora' | 'logs';

const allTabs: { key: Tab; label: string; icon: React.ElementType; adminOnly: boolean }[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User, adminOnly: false },
  { key: 'geral', label: 'Geral', icon: Settings, adminOnly: true },
  { key: 'usuarios', label: 'Usuários', icon: Users, adminOnly: true },
  { key: 'permissoes', label: 'Permissões', icon: KeyRound, adminOnly: true },
  { key: 'cupons', label: 'Cupons', icon: Ticket, adminOnly: true },
  { key: 'impressora', label: 'Impressora', icon: Printer, adminOnly: true },
  { key: 'logs', label: 'Auditoria', icon: FileText, adminOnly: true },
];

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
  superadmin: 'Super Admin',
};

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');
  const { isAdmin } = useAuth();
  const tabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <Button
            key={t.key}
            variant={activeTab === t.key ? 'default' : 'outline'}
            className="gap-2 shrink-0"
            onClick={() => setActiveTab(t.key)}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === 'perfil' && <MeuPerfilTab />}
      {activeTab === 'geral' && <GeralTab />}
      {activeTab === 'usuarios' && <UsuariosTab />}
      {activeTab === 'permissoes' && <PermissoesTab />}
      {activeTab === 'cupons' && <CuponsTab />}
      {activeTab === 'impressora' && <ImpressoraTab />}
      {activeTab === 'logs' && <AuditLogsTab />}
    </div>
  );
};

function GeralTab() {
  const { settings, updateTableCount } = useStore();
  const { user } = useAuth();
  const [tableCount, setTableCount] = useState(settings.tableCount.toString());
  const [serviceFee, setServiceFee] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [loginIcon, setLoginIcon] = useState<string | null>(null);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingCarousel, setUploadingCarousel] = useState(false);

  useEffect(() => {
    supabase.from('store_settings').select('service_fee_percentage').limit(1).then(({ data }) => {
      if (data && data.length > 0) setServiceFee((data[0] as any).service_fee_percentage?.toString() || '0');
    });
    if (user?.tenantId) {
      supabase.from('tenants').select('name, logo, login_icon, login_carousel_images').eq('id', user.tenantId).single().then(({ data }) => {
        if (data) {
          setTenantName(data.name);
          setTenantLogo(data.logo);
          setLoginIcon(data.login_icon);
          const imgs = data.login_carousel_images as string[] | null;
          if (imgs && Array.isArray(imgs)) setCarouselImages(imgs);
        }
      });
    }
  }, [user?.tenantId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.tenantId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.tenantId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar logo');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    const logoUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('tenants').update({ logo: logoUrl }).eq('id', user.tenantId);
    setTenantLogo(logoUrl);
    toast.success('Logo atualizada!');
    setUploading(false);
  };

  const handleLoginIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.tenantId) return;
    setUploadingIcon(true);
    const ext = file.name.split('.').pop();
    const path = `${user.tenantId}/login-icon.${ext}`;
    const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar ícone');
      setUploadingIcon(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    const iconUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('tenants').update({ login_icon: iconUrl } as any).eq('id', user.tenantId);
    setLoginIcon(iconUrl);
    toast.success('Ícone do login atualizado!');
    setUploadingIcon(false);
  };

  const handleCarouselUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.tenantId) return;
    setUploadingCarousel(true);
    const newImages = [...carouselImages];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const path = `${user.tenantId}/carousel-${Date.now()}-${i}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      newImages.push(urlData.publicUrl + '?t=' + Date.now());
    }
    await supabase.from('tenants').update({ login_carousel_images: newImages } as any).eq('id', user.tenantId);
    setCarouselImages(newImages);
    toast.success('Imagens do carrossel atualizadas!');
    setUploadingCarousel(false);
  };

  const removeCarouselImage = async (index: number) => {
    const newImages = carouselImages.filter((_, i) => i !== index);
    await supabase.from('tenants').update({ login_carousel_images: newImages } as any).eq('id', user?.tenantId!);
    setCarouselImages(newImages);
    toast.success('Imagem removida');
  };

  const handleSave = async () => {
    const count = parseInt(tableCount);
    if (isNaN(count) || count < 5 || count > 100) {
      toast.error('Mínimo de 5 mesas');
      return;
    }
    updateTableCount(count);

    if (user?.tenantId && tenantName.trim()) {
      await supabase.from('tenants').update({ name: tenantName.trim() }).eq('id', user.tenantId);
    }

    const fee = parseFloat(serviceFee.replace(',', '.')) || 0;
    const { data: existing } = await supabase.from('store_settings').select('id').limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('store_settings').update({ service_fee_percentage: fee, table_count: count } as any).eq('id', existing[0].id);
    } else {
      await supabase.from('store_settings').insert({ table_count: count, service_fee_percentage: fee } as any);
    }
    toast.success('Configuração salva!');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="relative h-20 w-20 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted flex items-center justify-center">
                {tenantLogo ? (
                  <img src={tenantLogo} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl text-muted-foreground">{tenantName?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <label className="cursor-pointer">
                <span className="text-xs text-primary hover:underline">{uploading ? 'Enviando...' : 'Alterar logo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome do Estabelecimento</Label>
              <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Nome da sua loja" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Tela de Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Login Icon */}
          <div className="space-y-2">
            <Label>Ícone do Login</Label>
            <p className="text-xs text-muted-foreground">Imagem exibida acima do formulário de login (diferente da logo da sidebar).</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted flex items-center justify-center">
                {loginIcon ? (
                  <img src={loginIcon} alt="Login Icon" className="h-full w-full object-contain" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>{uploadingIcon ? 'Enviando...' : 'Alterar ícone'}</span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLoginIconUpload} disabled={uploadingIcon} />
              </label>
            </div>
          </div>

          {/* Carousel Images */}
          <div className="space-y-2">
            <Label>Imagens do Carrossel</Label>
            <p className="text-xs text-muted-foreground">Imagens exibidas no lado esquerdo da tela de login. Se vazio, serão usadas as imagens padrão.</p>
            <div className="flex flex-wrap gap-3">
              {carouselImages.map((img, i) => (
                <div key={i} className="relative h-20 w-32 rounded-lg overflow-hidden border bg-muted group">
                  <img src={img} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeCarouselImage(i)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-20 w-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">{uploadingCarousel ? 'Enviando...' : 'Adicionar'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleCarouselUpload} disabled={uploadingCarousel} />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Grid3X3 className="h-5 w-5" /> Configurações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-2">
              <Label>Quantidade de mesas (mín. 5)</Label>
              <Input type="number" min={5} max={100} value={tableCount} onChange={e => setTableCount(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-2">
              <Label>Taxa de serviço / comissão (%)</Label>
              <p className="text-xs text-muted-foreground">Aplicada apenas em pedidos do tipo Mesa</p>
              <Input type="text" inputMode="decimal" placeholder="Ex: 10" value={serviceFee} onChange={e => setServiceFee(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave}>Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  commission: number;
}

function UsuariosTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'atendente' as AppRole, password: '', commission: '' });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    // tenant_members is already filtered by RLS to current tenant
    const { data: members } = await supabase.from('tenant_members').select('user_id, commission_percentage');
    if (!members || members.length === 0) { setUsers([]); setLoadingUsers(false); return; }

    const memberUserIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, name, email, phone').in('id', memberUserIds);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', memberUserIds);

    if (profiles) {
      const userList: UserRow[] = profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        const member = members.find(m => m.user_id === p.id);
        return { id: p.id, name: p.name, email: p.email, phone: p.phone || '', role: (userRole?.role as AppRole) || 'atendente', commission: Number((member as any)?.commission_percentage || 0) };
      });
      setUsers(userList);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const resetForm = () => {
    setForm({ name: '', email: '', role: 'atendente', password: '', commission: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error('Preencha nome e email');
      return;
    }

    const commissionVal = parseFloat(form.commission.replace(',', '.')) || 0;

    if (editingId) {
      // Update profile name
      await supabase.from('profiles').update({ name: form.name }).eq('id', editingId);
      // Update role
      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', editingId).single();
      if (existingRole) {
        await supabase.from('user_roles').update({ role: form.role }).eq('user_id', editingId);
      } else {
        await supabase.from('user_roles').insert({ user_id: editingId, role: form.role });
      }
      // Update commission
      await supabase.from('tenant_members').update({ commission_percentage: commissionVal } as any).eq('user_id', editingId);
      toast.success('Usuário atualizado!');
    } else {
      if (!form.password || form.password.length < 4) {
        toast.error('Senha deve ter no mínimo 4 caracteres');
        return;
      }
      // Create new user via signUp
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name, tenant_id: user?.tenantId, role: form.role } },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (signUpData.user) {
        // Assign role
        await supabase.from('user_roles').insert({ user_id: signUpData.user.id, role: form.role });
        toast.success('Usuário criado!');
      }
    }
    resetForm();
    // Refetch after a short delay to allow trigger to create profile
    setTimeout(fetchUsers, 500);
  };

  const handleEdit = (u: UserRow) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '', commission: u.commission.toString() });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Note: deleting auth users requires admin API (service role).
    // For now, we just remove the role so they can't access.
    await supabase.from('user_roles').delete().eq('user_id', id);
    toast.success('Acesso do usuário removido');
    fetchUsers();
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuários</CardTitle>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" disabled={!!editingId} />
              </div>
              <div className="space-y-1">
                <Label>Função</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as AppRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="atendente">Atendente</SelectItem>
                    <SelectItem value="motoboy">Motoboy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editingId && (
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" />
                </div>
              )}
              {(form.role === 'atendente') && (
                <div className="space-y-1">
                  <Label>Comissão (%)</Label>
                  <Input type="text" inputMode="decimal" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="Ex: 5" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}><Check className="h-4 w-4 mr-1" /> {editingId ? 'Atualizar' : 'Criar'}</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            </div>
          </div>
        )}

        {loadingUsers ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                <div>
                  <p className="font-medium text-foreground">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{roleLabels[u.role]}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(u)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetModal(u)} title="Redefinir senha">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
        <Button onClick={async () => {
          if (!resetModal || !newPassword || newPassword.length < 6) {
            toast.error('Senha deve ter pelo menos 6 caracteres');
            return;
          }
          setResetting(true);
          try {
            const { data, error } = await supabase.functions.invoke('reset-user-password', {
              body: { user_id: resetModal.id, new_password: newPassword },
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
        }} disabled={resetting} className="w-full">
          {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redefinindo...</> : 'Redefinir Senha'}
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}

function CuponsTab() {
  const { coupons, setCoupons } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: '', minOrder: '', expiresAt: '' });

  const resetForm = () => {
    setForm({ code: '', type: 'percentage', value: '', minOrder: '', expiresAt: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.code || !form.value) return;
    const val = parseFloat(form.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    const coupon: DiscountCoupon = {
      id: editingId || crypto.randomUUID(),
      code: form.code.toUpperCase(),
      type: form.type,
      value: val,
      active: true,
      minOrder: form.minOrder ? parseFloat(form.minOrder.replace(',', '.')) : undefined,
      expiresAt: form.expiresAt || undefined,
    };

    if (editingId) {
      setCoupons(prev => prev.map(c => c.id === editingId ? coupon : c));
    } else {
      setCoupons(prev => [...prev, coupon]);
    }
    resetForm();
  };

  const toggleActive = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleDelete = (id: string) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const handleEdit = (coupon: DiscountCoupon) => {
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      minOrder: coupon.minOrder?.toString() || '',
      expiresAt: coupon.expiresAt || '',
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Cupons de Desconto</CardTitle>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EX: DESCONTO10" className="uppercase" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'percentage' | 'fixed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor {form.type === 'percentage' ? '(%)' : '(R$)'}</Label>
                <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'percentage' ? '10' : '5,00'} />
              </div>
              <div className="space-y-1">
                <Label>Pedido mínimo (R$)</Label>
                <Input value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}><Check className="h-4 w-4 mr-1" /> {editingId ? 'Atualizar' : 'Criar'}</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {coupons.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom cadastrado.</p>}
          {coupons.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-foreground">{c.code}</p>
                  <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.type === 'percentage' ? `${c.value}%` : `R$ ${fmt(c.value)}`} de desconto
                  {c.minOrder ? ` · Mín. R$ ${fmt(c.minOrder)}` : ''}
                  {c.expiresAt ? ` · Até ${new Date(c.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.active} onCheckedChange={() => toggleActive(c.id)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const permissionLabels: Record<string, string> = {
  manage_categories: 'Cadastrar/editar categorias',
  manage_products: 'Cadastrar/editar produtos',
  edit_prices: 'Alterar preços e descrições',
  manage_stock: 'Dar entrada no estoque',
  remove_order_items: 'Remover itens do pedido',
  cancel_orders: 'Cancelar pedidos',
  apply_discounts: 'Aplicar descontos',
  manage_customers: 'Gerenciar clientes',
  manage_cash: 'Movimentar caixa (entradas/saídas)',
};

const permissionKeys = Object.keys(permissionLabels);

interface AttendantPermissions {
  id?: string;
  user_id: string;
  [key: string]: any;
}

function PermissoesTab() {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [permissions, setPermissions] = useState<Record<string, AttendantPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copySource, setCopySource] = useState('');

  const fetchData = useCallback(async () => {
    // Filter by tenant via tenant_members (RLS-filtered)
    const { data: members } = await supabase.from('tenant_members').select('user_id');
    if (!members || members.length === 0) { setUsers([]); setLoading(false); return; }
    const memberIds = members.map(m => m.user_id);

    const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', memberIds);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', memberIds);
    const { data: perms } = await supabase.from('attendant_permissions').select('*');

    const attendants = (profiles || []).filter(p => {
      const role = roles?.find(r => r.user_id === p.id);
      return role?.role === 'atendente';
    }).map(p => ({ id: p.id, name: p.name, email: p.email, role: 'atendente' }));

    setUsers(attendants);

    const permMap: Record<string, AttendantPermissions> = {};
    for (const perm of (perms || [])) {
      permMap[perm.user_id] = perm;
    }
    setPermissions(permMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = async (userId: string, key: string) => {
    setSaving(userId);
    const existing = permissions[userId];
    const currentVal = existing?.[key] ?? false;
    const newVal = !currentVal;

    if (existing?.id) {
      await supabase.from('attendant_permissions').update({ [key]: newVal } as any).eq('id', existing.id);
    } else {
      const newPerms: any = { user_id: userId };
      permissionKeys.forEach(k => newPerms[k] = k === key ? newVal : false);
      const { data } = await supabase.from('attendant_permissions').insert(newPerms).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [userId]: data }));
        setSaving(null);
        return;
      }
    }

    setPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, [key]: newVal },
    }));
    setSaving(null);
  };

  const toggleAll = async (userId: string, enable: boolean) => {
    setSaving(userId);
    const updates: any = {};
    permissionKeys.forEach(k => updates[k] = enable);

    const existing = permissions[userId];
    if (existing?.id) {
      await supabase.from('attendant_permissions').update(updates).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('attendant_permissions').insert({ user_id: userId, ...updates }).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [userId]: data }));
        setSaving(null);
        return;
      }
    }
    setPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, ...updates },
    }));
    setSaving(null);
  };

  const copyPermissions = async (targetUserId: string) => {
    if (!copySource) return;
    const source = permissions[copySource];
    if (!source) return;

    setSaving(targetUserId);
    const updates: any = {};
    permissionKeys.forEach(k => updates[k] = source[k] ?? false);

    const existing = permissions[targetUserId];
    if (existing?.id) {
      await supabase.from('attendant_permissions').update(updates).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('attendant_permissions').insert({ user_id: targetUserId, ...updates }).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [targetUserId]: data }));
        setSaving(null);
        toast.success('Permissões copiadas!');
        return;
      }
    }
    setPermissions(prev => ({
      ...prev,
      [targetUserId]: { ...prev[targetUserId], user_id: targetUserId, ...updates },
    }));
    setSaving(null);
    toast.success('Permissões copiadas!');
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Permissões de Atendentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendente cadastrado.</p>
        )}
        {users.map(u => (
          <div key={u.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toggleAll(u.id, true)}>
                  Marcar todos
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAll(u.id, false)}>
                  Desmarcar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissionKeys.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={permissions[u.id]?.[key] ?? false}
                    onCheckedChange={() => togglePermission(u.id, key)}
                    disabled={saving === u.id}
                  />
                  <span className="text-foreground">{permissionLabels[key]}</span>
                </label>
              ))}
            </div>

            {/* Copy from another attendant */}
            {users.length > 1 && (
              <div className="flex gap-2 items-center pt-1 border-t">
                <span className="text-xs text-muted-foreground">Copiar de:</span>
                <Select value={copySource} onValueChange={setCopySource}>
                  <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(x => x.id !== u.id).map(x => (
                      <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => copyPermissions(u.id)} disabled={!copySource}>
                  Copiar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ImpressoraTab is now imported from @/components/ImpressoraTab

export default Configuracoes;
